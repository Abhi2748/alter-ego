"""Home screen payload: character_state, pet_state, missions (today), twin strip."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from models.missions import MissionOut

# Character stage thresholds (CLAUDE §9) — S1=0, S2=800, S3=5000, S4=20000, S5=60000, S6=200000
STAGE_THRESHOLDS = [0, 800, 5_000, 20_000, 60_000, 200_000]
STAGE_NAMES = [
    "The Awakened",
    "The Focused",
    "The Burning",
    "The Relentless",
    "The Formidable",
    "The Sovereign",
]


def next_stage_for(total_xp: int) -> tuple[int, str]:
    """Return (next_stage_xp, next_stage_name) for the bar."""
    for i, thresh in enumerate(STAGE_THRESHOLDS):
        if total_xp < thresh:
            return (thresh, STAGE_NAMES[i])
    return (STAGE_THRESHOLDS[-1], STAGE_NAMES[-1])


class CharacterStateOut(BaseModel):
    stage: int
    total_xp: int
    next_stage_xp: int
    next_stage_name: str
    gender: Optional[str] = None  # "male" | "female" for character image


class PetStateOut(BaseModel):
    stage: int
    pet_health_state: str
    total_pet_food: int


class HomeOut(BaseModel):
    character_state: CharacterStateOut
    pet_state: PetStateOut
    missions: List[MissionOut]
    twin_strip_message: Optional[str] = None
    power_score: Optional[float] = None
    username: Optional[str] = None
    streak: int = 0
    week_dots: Optional[List[bool]] = None  # Mon–Sun: True if that day had core_completed >= 3


# Pet stage by total_pet_food (CLAUDE §9): Cub 0+, Cat 400+, Fox 2k+, Wolf 7k+, Snow Leopard 18k+, Panther 40k+, Griffin 80k+, Dragon 150k
PET_STAGE_THRESHOLDS = [0, 400, 2_000, 7_000, 18_000, 40_000, 80_000, 150_000]


def pet_stage_for(total_pet_food: int) -> int:
    """Return pet stage 1-8 from total_pet_food. 0 food = stage 0 (no pet)."""
    if total_pet_food <= 0:
        return 0
    stage = 1
    for i, thresh in enumerate(PET_STAGE_THRESHOLDS):
        if total_pet_food >= thresh:
            stage = i + 1
    return min(stage, 8)


class EarnedMilestoneOut(BaseModel):
    """Interest milestone just earned (for MilestoneAchievementCard)."""
    interest: str
    milestone_name: str
    milestone_number: int
    twin_congratulation: str
    earned_at: Optional[str] = None


class MissionCompleteOut(BaseModel):
    """Response from POST /missions/{id}/complete."""
    mission: MissionOut
    character_state: CharacterStateOut
    pet_state: PetStateOut
    stage_up: bool
    pet_stage_up: bool
    xp_earned: int
    pet_food_earned: int
    twin_strip_message: Optional[str] = None
    earned_milestone: Optional[EarnedMilestoneOut] = None
