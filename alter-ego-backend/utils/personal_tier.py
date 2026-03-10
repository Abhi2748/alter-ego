"""
Personal mission XP tier estimation (Mission System §5.2). Uses GPT-4o-mini to classify
user-written goal title as Easy / Medium / Hard for fair XP assignment.
"""
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

SYSTEM = """You classify personal habit/goal titles by estimated effort for a daily task app.
Reply with exactly one word: Easy, Medium, or Hard.

- Easy: quick or very low effort (e.g. under ~15 min, or trivial). Examples: "Drink a glass of water", "Take vitamins", "Stretch for 5 min".
- Medium: moderate effort or time (~15–45 min) or clear commitment. Examples: "Read for 20 minutes", "30 min walk", "Meditate 10 min".
- Hard: demanding effort, 45+ min, or high discipline. Examples: "Complete a full workout", "Study for 2 hours", "No social media all day".

Consider only the title. No explanation, only the word."""


async def estimate_personal_tier(title: str) -> str:
    """Return 'Easy', 'Medium', or 'Hard' for a mission title. Defaults to Medium on error."""
    if not title or not title.strip():
        return "Medium"
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "Medium"
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=api_key)
        msg = await llm.ainvoke([SystemMessage(content=SYSTEM), HumanMessage(content=title.strip())])
        text = (msg.content or "").strip().upper()
        if "EASY" in text:
            return "Easy"
        if "HARD" in text:
            return "Hard"
        return "Medium"
    except Exception:
        return "Medium"
