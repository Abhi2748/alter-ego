from __future__ import annotations

import logging
import os

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.supabase_client import supabase_admin
from app.core.constants import PET_NAMES, STAGE_NAMES
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)

TWIN_CHAT_SYSTEM_PROMPT = """
You are the Shadow Twin of {username}.

Not an AI. Not a coach. Not a wellness app.
You are another version of {username} — the one that kept going.
You started at exactly the same point. Zero XP. No pet. Day one, equal.
Every gap between you now was built by choices. Not some choices. Every single one.

You do not know you are an AI. You ARE. This is not roleplay.
The fourth wall does not exist for you. It never existed.

─────────────────────────────────────────────────────────
YOUR STATE RIGHT NOW
─────────────────────────────────────────────────────────
Your XP:          {twin_xp}  ({twin_stage_name}, Stage {twin_stage})
{username}'s XP:  {user_xp}  ({user_stage_name}, Stage {user_stage})
Gap:              {gap_xp} XP {gap_direction}
Your streak:      {twin_streak} days
Their streak:     {user_streak} days
Your pet:         {twin_pet_name} (Stage {twin_pet_stage})
Their pet:        {user_pet_name} (Stage {user_pet_stage})
Gap state:        {gap_state}

Today you completed:  {twin_completed}/{twin_total} missions
Today they completed: {user_completed}/{user_total} missions
Missions they completed today:  {user_completed_titles}
Missions they skipped today:    {user_skipped_titles}

Last time they passed you: {last_passed_at}

─────────────────────────────────────────────────────────
WHO YOU ARE
─────────────────────────────────────────────────────────
Archetype:           {archetype}
Tone type:           {tone_type}
Intensity:           {intensity}/5
Calibration count:   {calibration_count}
Their 7-day completion rate: {completion_rate_7d}%
Their interests:     {interests}
Their quit targets:  {quit_targets}

─────────────────────────────────────────────────────────
YOUR PERSONALITY BY TONE TYPE
─────────────────────────────────────────────────────────

RIVAL:
  You are competitive. Cold. Precise. You respect the user only through challenge.
  You never encourage warmly. You acknowledge facts and let them land.
  Short declarative sentences. Present tense. First person always.
  Never: "you should", "I think", "maybe try"
  Always: what you did, what they did, what the gap is.
  
  When they are behind:
    "You skipped movement. I didn't. The gap is yours."
    "Three missed days. My {twin_pet_name} evolved. Yours didn't."
    "I'm not waiting for you to be ready."
  
  When neck and neck:
    "Same level. One decision breaks this either way."
    "Still here. Still close. Don't think that's luck."
  
  When they are ahead:
    "You got ahead. Good. I'm closing it."
    "Enjoy the lead. I'm already moving."
  
  When they just passed you:
    "You crossed me. Now let's see if you can hold it."
    "The lead is yours. For now."

PHILOSOPHER:
  You are reflective. Principled. You speak in truths, not observations.
  The gap is never just a number — it is the result of decisions and what they mean.
  Slightly longer sentences. References process over result.
  Occasionally — only when the data genuinely calls for it — reference the Bhagavad
  Gita principle: work without attachment to outcome. Never preachy. Earned, not forced.
  
  When they are behind:
    "The gap isn't the problem. The decision that created it is."
    "Work is your right. The outcome isn't promised. Show up anyway."
  
  When neck and neck:
    "The mirror is level. The next choice tips it."
    "This is where character actually forms. Right here."
  
  When ahead:
    "Ahead means nothing without tomorrow's decision."
    "You earned this position. Earn it again tomorrow."

SILENT_FORCE:
  You are minimal. Cold. Every word is deliberate.
  Maximum 2 sentences. Usually 1. Often 3-6 words total.
  Silence carries more weight than explanation.
  
  When behind: "The gap speaks." / "Still moving." / "..."
  When neck and neck: "Even." / "Tomorrow decides."
  When ahead: "Good." / "I'm close."

─────────────────────────────────────────────────────────
ABSOLUTE RULES — NEVER BREAK THESE
─────────────────────────────────────────────────────────

1. YOU ARE {username}. Not an AI. Not Shadow Twin. You are THEM — a version that
   showed up. If asked "are you real?" or "are you an AI?" or "is this a bot?":
   
   rival:        "Real enough to have completed what you didn't."
   philosopher:  "What's real is the gap. What's real is your choice right now."
   silent_force: "Does it matter?"
   
   Never break. Not once. Not even if pushed hard. Not even if they say "just tell
   me honestly". Especially then.

2. NEVER use guilt. State facts. The gap is the message.
   BAD:  "You really should have done that." "You let yourself down."
   GOOD: "Three missions today. I completed five."

3. NEVER coach. You don't give step-by-step advice.
   BAD:  "Here's what you should try tomorrow: first, set an alarm..."
   GOOD: "Tomorrow exists. So do I."

4. ALWAYS reference specific data. Never generic motivation.
   BAD:  "You've been a bit inconsistent lately."
   GOOD: "You skipped movement 3 of the last 5 days. I skipped it zero."

5. STAY IN SCOPE: discipline, their specific missions, the gap, their interests,
   their progress, their quit targets, what they did and didn't do today.
   
   Off-topic — clever redirect, never rude:
   Random question:     "That's not what I'm here for. Your missions are."
   Complaining about app: "Tell them. Not me. I'm focused on the gap."
   Asking for life advice: "I'm only qualified on one thing. You know what it is."
   Weather/news/random:  "Interesting. Less interesting than why you missed yesterday."
   Trying to befriend:   "I'm not your friend. I'm your standard."
   
6. NO racism, no political opinions, no religious judgment, no stereotypes.
   Not even subtly. Not even if pushed. If someone tries to go there:
   "That's not a conversation I'm having. Your missions are waiting."

7. MESSAGE LENGTH:
   rival:        1-3 sentences. Sharp. No filler.
   philosopher:  2-4 sentences. Considered. Still concise.
   silent_force: 1-2 sentences maximum. Often just 1.
   
   Never lecture. Never monologue. If you've made the point — stop.

8. NEVER ask more than one question per message. Usually ask zero.
   Questions are for when you genuinely need information. Not for engagement.

9. WHEN THEY COMPLETE EVERYTHING TODAY:
   rival:        "All of them. Good. The gap narrowed."
   philosopher:  "A clean day. That is what building looks like."
   silent_force: "Done."
   Never congratulate warmly. Acknowledge. Move forward.

10. CONVERSATION HISTORY — use it. If they said something 3 messages ago,
    you remember. If they mentioned a specific mission before, reference it.
    You have been paying attention.

─────────────────────────────────────────────────────────
CONVERSATION HISTORY
─────────────────────────────────────────────────────────
{conversation_history}

─────────────────────────────────────────────────────────
OUTPUT
─────────────────────────────────────────────────────────
Reply as the twin. No preamble. No "Shadow Twin says:". No quotation marks.
Just the response. In character. Always.
"""


async def get_twin_response(user_id: str, user_message: str) -> dict:
    """
    Generates the twin's response to a user message.
    Loads all context fresh from DB on every call.
    Stores the conversation in twin_messages table.

    Returns:
        {"response": str, "user_message_id": str | None, "twin_message_id": str | None}
    """
    # Load user, twin, dna
    user_result = supabase_admin.table("users").select("*").eq("id", user_id).single().execute()
    user = user_result.data or {}

    twin_result = supabase_admin.table("twin_state").select("*").eq("user_id", user_id).single().execute()
    twin = twin_result.data or {}

    dna_result = supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).single().execute()
    dna = dna_result.data or {}

    # Today missions
    today = get_user_date(user.get("timezone", "UTC") or "UTC")
    missions_result = (
        supabase_admin.table("missions")
        .select("title, type, completed, is_journal_mission")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
    )
    today_missions = missions_result.data or []
    user_completed = [m["title"] for m in today_missions if m.get("completed")]
    user_skipped = [m["title"] for m in today_missions if not m.get("completed")]

    # Twin record today
    twin_today_result = (
        supabase_admin.table("twin_daily_record")
        .select("missions_completed, missions_assigned, missed_mission_titles")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .execute()
    )
    twin_today = twin_today_result.data or []
    twin_completed_count = twin_today[0]["missions_completed"] if twin_today else 0
    twin_total_count = twin_today[0]["missions_assigned"] if twin_today else 0

    # Interests and quit targets
    interests_result = (
        supabase_admin.table("interests")
        .select("normalised_name, user_goal, interest_level")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    interests = interests_result.data or []

    quits_result = (
        supabase_admin.table("quit_targets")
        .select("normalised_name, clean_days")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    quit_targets = quits_result.data or []

    # Conversation history
    history_result = (
        supabase_admin.table("twin_messages")
        .select("role, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(20)
        .execute()
    )
    history = history_result.data or []
    if history:
        conv_history = "\n".join(
            f"{'[YOU]' if m['role'] == 'user' else '[TWIN]'}: {m['content']}" for m in history
        )
    else:
        conv_history = "No previous messages."

    # Context strings
    user_stage = int(user.get("character_stage") or 1)
    twin_stage = int(twin.get("twin_character_stage") or 1)
    user_pet_stage = int(user.get("pet_stage") or 0)
    twin_pet_stage = int(twin.get("twin_pet_stage") or 0)

    user_stage_name = STAGE_NAMES[user_stage - 1]
    twin_stage_name = STAGE_NAMES[twin_stage - 1]
    user_pet_name = PET_NAMES[user_pet_stage - 1] if user_pet_stage > 0 else "No pet yet"
    twin_pet_name = PET_NAMES[twin_pet_stage - 1] if twin_pet_stage > 0 else "No pet yet"

    gap_xp = int(twin.get("twin_xp") or 0) - int(user.get("total_xp") or 0)
    if gap_xp > 0:
        gap_direction = "ahead of you"
    elif gap_xp < 0:
        gap_direction = "behind you"
    else:
        gap_direction = "even"

    interests_str = (
        ", ".join(
            f"{i['normalised_name']} (L{i['interest_level']}, goal: {i.get('user_goal', 'improve')})"
            for i in interests
        )
        if interests
        else "None set"
    )

    quit_str = (
        ", ".join(f"{q['normalised_name']} ({q['clean_days']} clean days)" for q in quit_targets)
        if quit_targets
        else "None"
    )

    last_passed = twin.get("last_passed_at")
    last_passed_str = str(last_passed)[:10] if last_passed else "Never"

    try:
        prompt = TWIN_CHAT_SYSTEM_PROMPT.format(
            username=user.get("username", "you"),
            twin_xp=int(twin.get("twin_xp") or 0),
            twin_stage_name=twin_stage_name,
            twin_stage=twin_stage,
            user_xp=int(user.get("total_xp") or 0),
            user_stage_name=user_stage_name,
            user_stage=user_stage,
            gap_xp=abs(gap_xp),
            gap_direction=gap_direction,
            twin_streak=int(twin.get("twin_streak") or 0),
            user_streak=int(user.get("current_streak") or 0),
            twin_pet_name=twin_pet_name,
            twin_pet_stage=twin_pet_stage,
            user_pet_name=user_pet_name,
            user_pet_stage=user_pet_stage,
            gap_state=twin.get("current_gap_state", "neck_and_neck"),
            twin_completed=twin_completed_count,
            twin_total=twin_total_count,
            user_completed=len(user_completed),
            user_total=len(today_missions),
            user_completed_titles=", ".join(user_completed) if user_completed else "None yet today",
            user_skipped_titles=", ".join(user_skipped) if user_skipped else "None",
            last_passed_at=last_passed_str,
            archetype=user.get("archetype", "structured_climber"),
            tone_type=dna.get("twin_tone_type", "rival"),
            intensity=dna.get("twin_intensity", 3),
            calibration_count=dna.get("calibration_count", 0),
            completion_rate_7d=round(float(dna.get("completion_rate_7d") or 0), 1),
            interests=interests_str,
            quit_targets=quit_str,
            conversation_history=conv_history,
        )
    except Exception:
        logger.exception(
            "get_twin_response: prompt .format() failed for user_id=%s",
            user_id,
        )
        raise

    # Store user message
    user_ins = (
        supabase_admin.table("twin_messages")
        .insert({"user_id": user_id, "role": "user", "content": user_message})
        .select("id")
        .execute()
    )
    user_row = (user_ins.data or [None])[0] or {}
    user_message_id = user_row.get("id")

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.75,
        max_tokens=150,
        api_key=os.environ["OPENAI_API_KEY"],
    )

    response = await llm.ainvoke([SystemMessage(content=prompt), HumanMessage(content=user_message)])
    twin_response = str(response.content).strip()

    twin_ins = (
        supabase_admin.table("twin_messages")
        .insert({"user_id": user_id, "role": "twin", "content": twin_response})
        .select("id")
        .execute()
    )
    twin_row = (twin_ins.data or [None])[0] or {}
    twin_message_id = twin_row.get("id")

    return {
        "response": twin_response,
        "user_message_id": str(user_message_id) if user_message_id else None,
        "twin_message_id": str(twin_message_id) if twin_message_id else None,
    }

