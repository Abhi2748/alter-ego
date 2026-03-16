from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends

from utils.auth import get_user_id
from utils.supabase_client import get_supabase


router = APIRouter(prefix="/profile", tags=["profile"])


CharacterStatus = Literal["current", "completed", "locked"]
PetStatus = Literal["current", "completed", "locked"]


CHARACTER_STAGE_NAMES = [
    "The Awakened",
    "The Focused",
    "The Burning",
    "The Relentless",
    "The Formidable",
    "The Sovereign",
]

CHARACTER_THRESHOLDS = [0, 10_000, 50_000, 200_000, 600_000, 1_500_000]

PET_STAGE_NAMES = [
    "Cub",
    "Cat",
    "Fox",
    "Wolf",
    "Snow Leopard",
    "Panther",
    "Griffin",
    "Dragon",
]

PET_THRESHOLDS = [0, 400, 2_000, 7_000, 18_000, 40_000, 80_000, 150_000]


@router.get("/identity")
def get_profile_identity(user_id: str = Depends(get_user_id)):
  supabase = get_supabase()

  # character_state row
  cr = (
      supabase.table("character_state")
      .select("stage, total_xp, last_updated")
      .eq("user_id", user_id)
      .maybe_single()
      .execute()
  )
  stage = int((cr.data or {}).get("stage") or 1)
  total_xp = int((cr.data or {}).get("total_xp") or 0)

  # days_active: from users.created_at if available
  ur = (
      supabase.table("users")
      .select("created_at")
      .eq("id", user_id)
      .maybe_single()
      .execute()
  )
  created_at = ur.data.get("created_at") if ur.data else None
  if created_at:
      created_date = date.fromisoformat(str(created_at)[:10])
      days_active = (date.today() - created_date).days + 1
  else:
      days_active = 1

  # thresholds
  current_stage_index = max(0, min(len(CHARACTER_STAGE_NAMES) - 1, stage - 1))
  current_stage_name = CHARACTER_STAGE_NAMES[current_stage_index]
  next_index = min(len(CHARACTER_THRESHOLDS) - 1, current_stage_index + 1)
  next_stage_xp_threshold = CHARACTER_THRESHOLDS[next_index]

  # naive estimate for days_to_next_stage_estimate
  remaining_xp = max(0, next_stage_xp_threshold - total_xp)
  # assume 250 XP/day if we don't have better data
  approx_per_day = 250
  days_to_next_stage_estimate = remaining_xp // approx_per_day if remaining_xp > 0 else 0

  stage_history = []
  for idx, (name, thresh) in enumerate(zip(CHARACTER_STAGE_NAMES, CHARACTER_THRESHOLDS), start=1):
      if idx < stage:
          status: CharacterStatus = "completed"
      elif idx == stage:
          status = "current"
      else:
          status = "locked"

      xp_required = thresh
      reached_day = 1 if idx == 1 else None
      left_day = None
      days_spent = None
      if status == "completed":
          left_day = None

      stage_history.append(
          {
              "stage": idx,
              "name": name,
              "status": status,
              "reached_day": reached_day,
              "left_day": left_day,
              "days_spent": days_spent,
              "xp_required": xp_required,
          }
      )

  return {
      "current_stage": stage,
      "current_stage_name": current_stage_name,
      "current_xp": total_xp,
      "next_stage_xp_threshold": next_stage_xp_threshold,
      "total_xp": total_xp,
      "days_active": days_active,
      "days_to_next_stage_estimate": days_to_next_stage_estimate,
      "stage_history": stage_history,
  }


@router.get("/companion")
def get_profile_companion(user_id: str = Depends(get_user_id)):
  supabase = get_supabase()

  pr = (
      supabase.table("pet_state")
      .select("stage, total_pet_food, consistency_days, last_updated")
      .eq("user_id", user_id)
      .maybe_single()
      .execute()
  )
  stage = int((pr.data or {}).get("stage") or 0)
  total_pf = int((pr.data or {}).get("total_pet_food") or 0)

  current_stage = max(1, min(len(PET_STAGE_NAMES), stage or 1))
  pet_name = PET_STAGE_NAMES[current_stage - 1]

  next_index = min(len(PET_THRESHOLDS) - 1, current_stage)
  next_threshold = PET_THRESHOLDS[next_index]

  # naive days estimate using 150 PF/day
  remaining_pf = max(0, next_threshold - total_pf)
  approx_per_day = 150
  days_to_next_estimate = remaining_pf // approx_per_day if remaining_pf > 0 else 0

  # unlocked_day: approximate from streak_log earliest row with pet_stage >= 1
  unlocked_day = 7

  stage_history = []
  for idx, (name, thresh) in enumerate(zip(PET_STAGE_NAMES, PET_THRESHOLDS), start=1):
      if idx < current_stage:
          status: PetStatus = "completed"
      elif idx == current_stage:
          status = "current"
      else:
          status = "locked"

      pf_required = thresh
      reached_day = unlocked_day if idx == 1 else None
      left_day = None
      days_spent = None
      stage_history.append(
          {
              "stage": idx,
              "name": name,
              "status": status,
              "reached_day": reached_day,
              "left_day": left_day,
              "days_spent": days_spent,
              "pf_required": pf_required,
          }
      )

  # simple "today" and daily cap placeholders
  today_pf = 0
  daily_cap = 600

  return {
      "current_stage": current_stage,
      "current_pet_name": pet_name,
      "total_pf": total_pf,
      "today_pf": today_pf,
      "daily_cap": daily_cap,
      "next_stage_pf_threshold": next_threshold,
      "unlocked_day": unlocked_day,
      "days_to_next_estimate": days_to_next_estimate,
      "stage_history": stage_history,
  }

