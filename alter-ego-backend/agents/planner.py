"""
Planner Agent (J2) — §2.10. Generates daily missions.
Initial missions: all 5 Core pillars + up to 2 Interest (from onboarding interests).
"""

from datetime import datetime, timezone, timedelta
from typing import Any

# Core pillars: all 5 — Sleep, Movement, Hydration, Mindfulness, No-Phone (§1.2).
CORE_PILLARS = [
    ("Sleep", "Get 7+ hours of sleep", "Easy", 15, 12),
    ("Movement", "Move for 20 minutes", "Easy", 15, 12),
    ("Hydration", "Drink 2L of water today", "Easy", 15, 12),
    ("Mindfulness", "5-minute breathwork or reflection", "Easy", 15, 12),
    ("No-Phone", "No phone for first 30 minutes after waking", "Easy", 15, 12),
]

# XP/PF per difficulty for Core (Easy/Medium/Hard) — placeholder; can align to §8.1 later
CORE_XP = {"Easy": 15, "Medium": 25, "Hard": 40}
CORE_PF = {"Easy": 12, "Medium": 20, "Hard": 32}
INTEREST_XP = {"Easy": 10, "Medium": 20, "Hard": 30}
INTEREST_PF = {"Easy": 8, "Medium": 16, "Hard": 24}


def generate_initial_missions(
    user_id: str,
    interests: list[str],
    available_hours_per_day: float,
) -> list[dict[str, Any]]:
    """
    Generate initial missions for a new user: 3 Core + up to 2 Interest.
    Returns list of dicts ready for Supabase insert (missions table).
    """
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=0)
    expires_at = expires.isoformat()
    created_at = now.isoformat()

    rows: list[dict[str, Any]] = []

    for pillar, title, difficulty, xp, pf in CORE_PILLARS:
        rows.append({
            "user_id": user_id,
            "type": "core",
            "pillar": pillar.lower(),
            "interest": None,
            "title": title,
            "difficulty": difficulty,
            "xp_value": xp,
            "pet_food_value": pf,
            "mission_streak": 0,
            "completed_at": None,
            "expires_at": expires_at,
            "created_at": created_at,
        })

    # Up to 2 Interest missions from first interests
    # Permanent daily interest mission: Journal
    rows.append({
        "user_id": user_id,
        "type": "interest",
        "pillar": None,
        "interest": "Journal",
        "title": "Write today's journal entry.",
        "difficulty": "Easy",
        "xp_value": INTEREST_XP["Easy"],
        "pet_food_value": INTEREST_PF["Easy"],
        "mission_streak": 0,
        "completed_at": None,
        "expires_at": expires_at,
        "created_at": created_at,
    })

    for interest in (interests or [])[:2]:
        interest_name = (interest.strip() or "Personal goal")[:100]
        rows.append({
            "user_id": user_id,
            "type": "interest",
            "pillar": None,
            "interest": interest_name,
            "title": f"30 min {interest_name}",
            "difficulty": "Easy",
            "xp_value": INTEREST_XP["Easy"],
            "pet_food_value": INTEREST_PF["Easy"],
            "mission_streak": 0,
            "completed_at": None,
            "expires_at": expires_at,
            "created_at": created_at,
        })

    return rows
