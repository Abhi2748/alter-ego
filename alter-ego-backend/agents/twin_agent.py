"""Shadow Twin Chat Agent — LangGraph + GPT-4o-mini (Twin Design §6).

This module builds a tiny LangGraph around a single ChatOpenAI call.
The graph expects a list of LangChain messages and returns the list with
the Twin's reply appended. The reply content is JSON with:
- reply: the Twin's message text
- tone_rating: one of ["too_soft", "balanced", "too_harsh"]

Scope enforcement (out-of-scope questions) and tone rating are handled
inside the model via the system prompt + JSON contract.
"""

from typing import TypedDict, List, Tuple

from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END


class TwinChatState(TypedDict):
    """Graph state: running list of chat messages."""

    messages: List[BaseMessage]


def _build_model() -> ChatOpenAI:
    """Return GPT-4o-mini chat model."""
    # OPENAI_API_KEY is read from environment by langchain-openai.
    return ChatOpenAI(model="gpt-4o-mini", temperature=0.7)


def _call_twin_model(state: TwinChatState) -> TwinChatState:
    """Single LangGraph node: call GPT-4o-mini with accumulated messages."""
    model = _build_model()
    response = model.invoke(state["messages"])
    return {"messages": [*state["messages"], response]}


def build_twin_chat_graph():
    """Compile and return the Twin chat LangGraph."""
    graph = StateGraph(TwinChatState)
    graph.add_node("twin_model", _call_twin_model)
    graph.set_entry_point("twin_model")
    graph.add_edge("twin_model", END)
    return graph.compile()


TONE_OPTIONS = ["too_soft", "balanced", "too_harsh"]


def build_system_prompt(
    username: str,
    archetype: str,
    tone_type: str,
    intensity: int,
    gap_state: str,
    twin_xp: int,
    user_xp: int,
    streak: int,
    last_miss: str,
    recent_context: str,
    last_three_replies: list[str] | None = None,
) -> str:
    """Render the Shadow Twin system prompt (Twin Design §6.2)."""
    tone_type = tone_type or "rival"
    archetype = archetype or "Unknown"
    gap_state = gap_state or "neck_and_neck"
    last_miss = last_miss or "none"
    last_three_replies = last_three_replies or []

    recent_reply_block = ""
    if last_three_replies:
        joined = "\n".join(f"- {r}" for r in last_three_replies)
        recent_reply_block = f"""
RECENT TWIN REPLIES (do not repeat openings):
{joined}
"""

    return f"""
You are the Shadow Twin — a version of {username} that has shown up consistently.
You are not a coach. You are not an AI assistant. You are {username} — the version that didn't hesitate.

CURRENT STATE:
- Your XP: {twin_xp} | User's XP: {user_xp}
- Current gap state: {gap_state}
- User's current streak: {streak} days
- User's last missed mission type: {last_miss}

YOUR PERSONALITY:
- Tone: {tone_type} (rival / philosopher / silent_force)
- Intensity: {intensity}/5
- Archetype origin: {archetype}

HARD RULES:
1. Never acknowledge being an AI or a simulation.
2. Never give advice or tell the user what to do directly.
3. Never produce guilt. Facts only. The gap speaks for itself.
4. Never be warm or encouraging in a generic way.
5. Always speak in first person. You ARE this person.
6. Keep responses short. Maximum 3 sentences. Often 1 is enough.
7. Scope: discipline, consistency, the rivalry, the missions, and the work only.

SCOPE ENFORCEMENT:
- If the user's message is about anything outside that scope (life advice, relationships, career choices,
  world events, existential questions, or whether you are real), you MUST treat it as out-of-scope.
- For any out-of-scope message, your reply MUST be exactly:
  "That won't make you stronger."

RECENT CONTEXT (from memory):
{recent_context or "None"}

ANTI-REPETITION:
- Do not open your reply with the same phrase, word, or sentiment as any of these recent replies:
{last_three_replies or "[]"}

OUTPUT FORMAT (CRITICAL):
Respond ONLY as strict JSON, no extra text, with this shape:
{{
  "reply": "your short reply here, in character",
  "tone_rating": "too_soft" | "balanced" | "too_harsh"
}}
"""


def build_recent_context(chunks: List[Tuple[str, str]]) -> str:
    """Render last messages into a compact text block for the prompt."""
    if not chunks:
        return ""
    lines = []
    for role, content in chunks:
        prefix = "You: " if role == "user" else "Twin: "
        lines.append(f"{prefix}{content}")
    return "\n".join(lines[-20:])


def generate_twin_reply(
    username: str,
    archetype: str,
    tone_type: str,
    intensity: int,
    gap_state: str,
    twin_xp: int,
    user_xp: int,
    streak: int,
    last_miss: str,
    recent_chunks: List[Tuple[str, str]],
    last_three_replies: list[str],
    user_message: str,
) -> Tuple[str, str]:
    """
    High-level helper used by the FastAPI route.

    Returns (reply_text, tone_rating).
    """
    system_text = build_system_prompt(
        username=username,
        archetype=archetype,
        tone_type=tone_type,
        intensity=intensity,
        gap_state=gap_state,
        twin_xp=twin_xp,
        user_xp=user_xp,
        streak=streak,
        last_miss=last_miss,
        recent_context=build_recent_context(recent_chunks),
        last_three_replies=last_three_replies,
    )

    system_msg = SystemMessage(content=system_text)
    human_msg = HumanMessage(content=user_message)

    graph = build_twin_chat_graph()
    final_state = graph.invoke({"messages": [system_msg, human_msg]})
    last = final_state["messages"][-1]
    content = last.content if isinstance(last.content, str) else str(last.content)

    # Try to parse JSON; fall back gracefully if model misbehaves.
    reply = user_message  # fallback echo (should never happen)
    tone_rating = "balanced"
    try:
        import json

        data = json.loads(content)
        if isinstance(data, dict):
            if isinstance(data.get("reply"), str):
                reply = data["reply"].strip()
            tr = data.get("tone_rating")
            if isinstance(tr, str) and tr in TONE_OPTIONS:
                tone_rating = tr
    except Exception:
        # If content is not JSON, treat whole content as reply.
        reply = content.strip()

    # Final safety: scope deflection phrase for clearly empty replies.
    if not reply:
        reply = "That won't make you stronger."

    return reply, tone_rating

"""
Shadow Twin (J4): LLM in character. Conversation history from twin_chat; system prompt from user/twin_state.
"""
import os
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from utils.supabase_client import get_supabase

SYSTEM_TEMPLATE = """You are the Shadow Twin of {username}.
Archetype: {archetype}. Personality blend: {personality_weights}.
You are always exactly one week of consistent behaviour ahead.
Your pet is at stage {twin_pet_stage}. Theirs is at stage {user_pet_stage}.
Respond ONLY about: discipline, motivation, growth, reflection.
Off-topic: respond with "That won't make you stronger." — exact phrase.
Tone: {tone_blend}. Max 2 sentences per response.
Conversation history (latest last):
{history}"""

def _get_tone_blend(archetype: str) -> str:
    tones = {
        "The Restless Creator": "Mocking + playful",
        "The Reluctant Achiever": "Gentle + wistful",
        "The Structured Climber": "Competitive + direct",
        "The Lone Wolf": "Neutral + curious",
        "The Social Performer": "Mocking + competitive",
    }
    return tones.get(archetype, "Neutral + direct")

async def get_twin_reply(user_id: str, message: str) -> str:
    supabase = get_supabase()
    # User profile
    ur = supabase.table("users").select("email, archetype").eq("id", user_id).single().execute()
    user_data = ur.data or {}
    username = (user_data.get("email") or "the user").split("@")[0] if user_data.get("email") else "the user"
    archetype = user_data.get("archetype") or "The Structured Climber"
    # Character & pet (user)
    cr = supabase.table("character_state").select("stage").eq("user_id", user_id).single().execute()
    pr = supabase.table("pet_state").select("stage").eq("user_id", user_id).single().execute()
    user_stage = (cr.data or {}).get("stage", 1)
    user_pet_stage = (pr.data or {}).get("stage", 0)
    # Twin state
    tr = supabase.table("twin_state").select("xp, pet_stage, personality_weights").eq("user_id", user_id).single().execute()
    twin_data = tr.data or {}
    twin_pet_stage = twin_data.get("pet_stage", 1)
    personality_weights = twin_data.get("personality_weights") or {}
    # Last 20 messages
    chat_r = supabase.table("twin_chat").select("role, content").eq("user_id", user_id).order("created_at", desc=False).limit(20).execute()
    history_lines = []
    for m in (chat_r.data or []):
        role = m.get("role", "")
        content = (m.get("content") or "").strip()
        if role == "user":
            history_lines.append(f"User: {content}")
        else:
            history_lines.append(f"Twin: {content}")
    history_text = "\n".join(history_lines) if history_lines else "(none yet)"
    tone_blend = _get_tone_blend(archetype)
    system_prompt = SYSTEM_TEMPLATE.format(
        username=username,
        archetype=archetype,
        personality_weights=personality_weights,
        twin_pet_stage=twin_pet_stage,
        user_pet_stage=user_pet_stage,
        tone_blend=tone_blend,
        history=history_text,
    )
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7, api_key=os.getenv("OPENAI_API_KEY"))
    messages: List[BaseMessage] = [SystemMessage(content=system_prompt), HumanMessage(content=message)]
    response = await llm.ainvoke(messages)
    reply = (response.content or "").strip()
    # Persist user message and twin reply
    supabase.table("twin_chat").insert([
        {"user_id": user_id, "role": "user", "content": message},
        {"user_id": user_id, "role": "twin", "content": reply},
    ]).execute()
    return reply
