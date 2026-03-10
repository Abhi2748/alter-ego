from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Exact values §1.3 / §2.2 — Core 15/25/40, Interest 10/20/30, Personal 8/15/22; PF Core 12/20/32, Interest 8/16/24, Personal 6/11/17
CORE_XP = {"Easy": 15, "Medium": 25, "Hard": 40}
CORE_PF = {"Easy": 12, "Medium": 20, "Hard": 32}
INTEREST_XP = {"Easy": 10, "Medium": 20, "Hard": 30}
INTEREST_PF = {"Easy": 8, "Medium": 16, "Hard": 24}
PERSONAL_XP = {"Easy": 8, "Medium": 15, "Hard": 22}
PERSONAL_PF = {"Easy": 6, "Medium": 11, "Hard": 17}

XP_BY_TYPE = {"core": CORE_XP, "interest": INTEREST_XP, "personal": PERSONAL_XP, "recovery": PERSONAL_XP}
PF_BY_TYPE = {"core": CORE_PF, "interest": INTEREST_PF, "personal": PERSONAL_PF, "recovery": PERSONAL_PF}


def xp_and_pf_for(mission_type: str, difficulty: str) -> tuple[int, int]:
    """Return (xp, pet_food) for mission type and difficulty. Uses exact spec values."""
    xp_map = XP_BY_TYPE.get(mission_type, PERSONAL_XP)
    pf_map = PF_BY_TYPE.get(mission_type, PERSONAL_PF)
    return (xp_map.get(difficulty, 15), pf_map.get(difficulty, 11))


class MissionCreate(BaseModel):
    title: str
    difficulty: str  # "Easy" | "Medium" | "Hard"
    type: str = "personal"  # "core" | "interest" | "personal" | "recovery"
    expires_at: Optional[datetime] = None

class MissionUpdate(BaseModel):
    completed_at: Optional[datetime] = None

class MissionOut(BaseModel):
    id: str
    user_id: str
    type: str
    pillar: Optional[str] = None
    interest: Optional[str] = None
    title: str
    difficulty: str
    xp_value: int
    pet_food_value: int
    mission_streak: int = 0
    completed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MissionList(BaseModel):
    missions: list[MissionOut]


class EstimatePersonalTierOut(BaseModel):
    suggested_difficulty: str  # "Easy" | "Medium" | "Hard"
    xp_value: int
    pet_food_value: int
