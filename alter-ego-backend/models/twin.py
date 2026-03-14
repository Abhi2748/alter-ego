"""Twin comparison payload and gap logic (Twin Design §5.1, §5.2)."""
from pydantic import BaseModel
from typing import Optional

from models.home import pet_stage_for, PET_STAGE_THRESHOLDS

# Pet stage names 1–8 (Cub → Dragon) — same as mobile PET_STAGE_NAMES
PET_STAGE_NAMES: dict[int, str] = {
    1: "Cub",
    2: "Cat",
    3: "Fox",
    4: "Wolf",
    5: "Snow Leopard",
    6: "Panther",
    7: "Griffin",
    8: "Dragon",
}


def min_pet_food_for_stage(stage: int) -> int:
    """Minimum total_pet_food to be at this stage (for legacy twin_state without twin_pet_food)."""
    if stage <= 0:
        return 0
    idx = stage - 1
    if idx >= len(PET_STAGE_THRESHOLDS):
        return PET_STAGE_THRESHOLDS[-1] if PET_STAGE_THRESHOLDS else 0
    return PET_STAGE_THRESHOLDS[idx]


def pet_stage_name(stage: int) -> str:
    """Return display name for pet stage; 0 = no pet."""
    if stage <= 0:
        return "—"
    return PET_STAGE_NAMES.get(stage, "—")


# Gap states (Twin Design §5.2)
GAP_USER_AHEAD = "user_ahead"
GAP_NECK_AND_NECK = "neck_and_neck"
GAP_SLIGHTLY_BEHIND = "slightly_behind"
GAP_SIGNIFICANTLY_BEHIND = "significantly_behind"


def compute_gap_state(user_xp: int, twin_xp: int) -> str:
    """
    Compare user vs twin XP; return current_gap_state.
    USER AHEAD: user > twin
    NECK AND NECK: within 5%
    USER SLIGHTLY BEHIND: twin 5–25% higher
    USER SIGNIFICANTLY BEHIND: twin >25% higher
    """
    if user_xp > twin_xp:
        return GAP_USER_AHEAD
    if twin_xp <= 0:
        return GAP_NECK_AND_NECK
    ratio = user_xp / twin_xp
    if ratio >= 0.95:
        return GAP_NECK_AND_NECK
    if ratio >= 0.75:
        return GAP_SLIGHTLY_BEHIND
    return GAP_SIGNIFICANTLY_BEHIND


def consistency_ceiling_for(gap_behavior: Optional[str], user_xp: int, twin_xp: int) -> float:
    """
    chase=0.95, steady=0.80, rubber_band=dynamic 0.6–0.9.
    Rubber band: if user significantly behind and disengaged, lower ceiling to close gap.
    """
    if gap_behavior == "chase":
        return 0.95
    if gap_behavior == "steady":
        return 0.80
    if gap_behavior == "rubber_band":
        if twin_xp <= 0:
            return 0.75
        ratio = user_xp / twin_xp
        if ratio < 0.75:
            return 0.60
        if ratio < 0.95:
            return 0.75
        return 0.90
    return 0.80


# Daily XP by intensity 1–5 (Twin earns at fixed rate; ceiling applied on top)
DAILY_TWIN_XP_BY_INTENSITY = [120, 160, 200, 240, 280]
# Daily pet food by intensity (same scale as XP)
DAILY_TWIN_PF_BY_INTENSITY = [96, 128, 160, 192, 224]


def daily_twin_xp(intensity: int, ceiling: float) -> int:
    """Twin XP earned per simulated day (before ceiling)."""
    idx = max(0, min(intensity - 1, 4))
    base = DAILY_TWIN_XP_BY_INTENSITY[idx]
    return int(base * ceiling)


def daily_twin_pet_food(intensity: int, ceiling: float) -> int:
    """Twin pet food earned per simulated day."""
    idx = max(0, min(intensity - 1, 4))
    base = DAILY_TWIN_PF_BY_INTENSITY[idx]
    return int(base * ceiling)


class TwinActivityOut(BaseModel):
    """Single activity in Twin's Day timeline."""
    mission_title: str
    mission_type: str  # "core" | "focus" | "personal"
    difficulty: str  # "Easy" | "Medium" | "Hard"
    xp_earned: int
    completed_at: Optional[str] = None  # ISO time string, null = pending


class TwinComparisonOut(BaseModel):
    """Response for GET /twin/comparison — real twin_state + user state + gap line."""
    user_xp: int
    user_pet_stage: int
    user_pet_stage_name: str
    user_streak: int
    user_power_score: Optional[float] = None
    twin_xp: int
    twin_pet_stage: int
    twin_pet_stage_name: str
    twin_streak: int
    twin_power_score: Optional[float] = None
    current_gap_state: str
    gap_line: str
    strip_message: Optional[str] = None
    gap_days: Optional[int] = None
    username: Optional[str] = None
    twin_today_activities: list[TwinActivityOut] = []
