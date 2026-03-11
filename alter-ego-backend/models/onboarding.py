from pydantic import BaseModel
from typing import Optional, List, Any

# Interest level per interest (add-interest flow: name, level, learning_goal)
class InterestLevelItem(BaseModel):
    interest: str
    level: str  # "Still figuring it out" | "Getting the hang of it" | "Pretty solid"
    learning_goal: Optional[str] = None


class OnboardingPayload(BaseModel):
    """Raw onboarding answers from Q1–Q14 + interests, quit_targets, hours, gender, username."""
    answers: dict[str, Any] = {}
    interests: List[str] = []
    quit_targets: List[str] = []
    available_hours_per_day: float = 1.0
    gender: Optional[str] = None
    username: Optional[str] = None  # unique display name
    interest_levels: Optional[List[InterestLevelItem]] = None


class MissionInResponse(BaseModel):
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
    completed_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str


class ArchetypeContent(BaseModel):
    """Content for Archetype Reveal screen: name, description, Twin first line."""
    archetype: str
    description: str
    twin_first_message: str


class OnboardingResponse(BaseModel):
    success: bool = True
    message: str = "Onboarding complete"
    archetype: str
    archetype_content: ArchetypeContent
    initial_missions: List[MissionInResponse] = []
