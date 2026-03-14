"""GET /home — character_state, pet_state, missions for today, twin strip_message, streak, week_dots."""
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends
from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from models.home import HomeOut, CharacterStateOut, PetStateOut, next_stage_for
from models.missions import MissionOut
from routes.missions import _mission_to_out

router = APIRouter(prefix="/home", tags=["home"])


def _week_dots(supabase, user_id: str) -> list[bool]:
    """Mon–Sun: True if that day had core_completed >= 3 (qualifying day)."""
    today = date.today()
    # Monday = 0; get Monday of this week
    weekday = today.weekday()
    monday = today - timedelta(days=weekday)
    dots = [False] * 7
    for i in range(7):
        d = monday + timedelta(days=i)
        d_iso = d.isoformat()
        row = (
            supabase.table("streak_log")
            .select("core_completed")
            .eq("user_id", user_id)
            .eq("date", d_iso)
            .maybe_single()
            .execute()
        )
        if row.data is not None and (row.data.get("core_completed") or 0) >= 3:
            dots[i] = True
    return dots


@router.get("", response_model=HomeOut)
async def get_home(user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    tz = timezone.utc
    today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=tz)
    today_end = datetime.combine(date.today(), datetime.max.time(), tzinfo=tz)
    today_start_iso = today_start.isoformat()
    today_end_iso = today_end.isoformat()

    # character_state
    cr = supabase.table("character_state").select("stage, total_xp, gender").eq("user_id", user_id).maybe_single().execute()
    if cr.data:
        stage = cr.data.get("stage", 1)
        total_xp = int(cr.data.get("total_xp", 0))
        gender = (cr.data.get("gender") or "male").strip().lower() if cr.data.get("gender") else "male"
    else:
        stage = 1
        total_xp = 0
        gender = "male"
    next_stage_xp, next_stage_name = next_stage_for(total_xp)
    character_state = CharacterStateOut(
        stage=stage,
        total_xp=total_xp,
        next_stage_xp=next_stage_xp,
        next_stage_name=next_stage_name,
        gender=gender,
    )

    # pet_state
    pr = supabase.table("pet_state").select("stage, pet_health_state, total_pet_food").eq("user_id", user_id).maybe_single().execute()
    if pr.data:
        pet_state = PetStateOut(
            stage=int(pr.data.get("stage", 0)),
            pet_health_state=pr.data.get("pet_health_state") or "healthy",
            total_pet_food=int(pr.data.get("total_pet_food", 0)),
        )
    else:
        pet_state = PetStateOut(stage=0, pet_health_state="healthy", total_pet_food=0)

    # missions for today (expires_at within today)
    mr = supabase.table("missions").select("*").eq("user_id", user_id).gte("expires_at", today_start_iso).lte("expires_at", today_end_iso).order("created_at", desc=False).execute()
    missions = [_mission_to_out(m) for m in (mr.data or [])]

    # twin_state strip_message
    tr = supabase.table("twin_state").select("strip_message").eq("user_id", user_id).maybe_single().execute()
    twin_strip_message = (tr.data or {}).get("strip_message") if tr.data else None

    # power_score, streak, username
    power_score = None
    streak = 0
    lr = supabase.table("leaderboard_scores").select("power_score, streak").eq("user_id", user_id).maybe_single().execute()
    if lr.data is not None:
        if lr.data.get("power_score") is not None:
            power_score = float(lr.data["power_score"])
        streak = int(lr.data.get("streak", 0) or 0)
    week_dots = _week_dots(supabase, user_id)
    username = None
    ur = supabase.table("users").select("username, email").eq("id", user_id).maybe_single().execute()
    if ur.data:
        if ur.data.get("username"):
            username = str(ur.data["username"]).strip()
        elif ur.data.get("email"):
            email = ur.data["email"]
            username = email.split("@")[0] if isinstance(email, str) else None

    return HomeOut(
        character_state=character_state,
        pet_state=pet_state,
        missions=missions,
        twin_strip_message=twin_strip_message,
        power_score=power_score,
        username=username,
        streak=streak,
        week_dots=week_dots,
    )
