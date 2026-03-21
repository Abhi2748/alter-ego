import random
import re
from datetime import datetime, timezone
import asyncio

from fastapi import HTTPException

from app.core.supabase_client import supabase_admin
from app.core.archetype import classify_archetype, get_archetype_data, get_initial_dna
from app.core.constants import (
    COMMITMENT_HORIZON_CONTEXT,
    INTEREST_LEVEL_MAP,
    TWIN_INITIAL_CONSISTENCY,
)
from app.agents.interest_normaliser import normalise_interest, normalise_quit_target


ADJECTIVES = [
    "silent",
    "dark",
    "iron",
    "swift",
    "cold",
    "sharp",
    "deep",
    "bold",
    "stark",
    "grey",
    "black",
    "steel",
    "fierce",
    "lone",
    "shadow",
    "hollow",
    "grim",
    "stone",
    "bare",
    "ancient",
]

NOUNS = [
    "hawk",
    "wolf",
    "ember",
    "ridge",
    "forge",
    "vale",
    "crown",
    "blade",
    "peak",
    "storm",
    "tide",
    "flame",
    "crest",
    "edge",
    "path",
    "mark",
    "root",
    "core",
    "will",
    "ghost",
]

RESERVED_USERNAMES = {"admin", "alter_ego", "shadow_twin", "support", "help"}

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")


def validate_username(username: str) -> tuple[bool, str]:
    """
    Returns (is_valid, error_reason).
    Rules:
    - 3-20 characters
    - Only lowercase letters, numbers, underscores
    - Cannot start or end with underscore
    - No consecutive underscores
    - Not in reserved list: ["admin", "alter_ego", "shadow_twin", "support", "help"]
    """
    if username is None:
        return False, "invalid_format"

    u = username.strip().lower()
    if not USERNAME_RE.match(u):
        return False, "invalid_format"
    if u.startswith("_") or u.endswith("_"):
        return False, "invalid_format"
    if "__" in u:
        return False, "invalid_format"
    if u in RESERVED_USERNAMES:
        return False, "reserved"
    return True, ""


async def _is_username_taken(username: str) -> bool:
    r = supabase_admin.table("users").select("id").eq("username", username).limit(1).execute()
    return bool(r.data)


def generate_random_username() -> str:
    """
    Generates a random username in format: adjective_noun_NN
    Examples: silent_hawk_37, dark_ember_91, iron_wolf_14

    Pick one adjective + one noun randomly + random 2-digit number (10-99).
    Format: adjective_noun_NN  e.g. "silent_hawk_37"
    Check uniqueness in DB — regenerate if taken (max 10 attempts).
    If all 10 taken (astronomically unlikely): append timestamp instead.
    """
    # Note: uniqueness check is async; this function is sync per spec.
    # We do a best-effort generation here; caller should still verify/loop async.
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(10, 99)
    return f"{adj}_{noun}_{num}"


async def generate_unique_username() -> str:
    for _ in range(10):
        candidate = generate_random_username()
        if not await _is_username_taken(candidate):
            return candidate
    ts = int(datetime.now(timezone.utc).timestamp())
    return f"{random.choice(ADJECTIVES)}_{random.choice(NOUNS)}_{ts}"


async def save_onboarding_step(user_id: str, question_key: str, answer_json: dict) -> dict:
    """
    Upserts the answer and updates any derived fields on the users table.

    Q1=username, Q2=gender, Q3=age, Q4–Q10=archetype questions,
    Q11=interests, Q12=quit_targets, Q13=daily_hours,
    Q14=commitment_horizon, Q15=timezone (auto-detected).
    """
    # Upsert onboarding answer
    supabase_admin.table("onboarding_answers").upsert(
        {"user_id": user_id, "question_key": question_key, "answer_json": answer_json},
        on_conflict="user_id,question_key",
    ).execute()

    # Ensure users row exists when we need to update it
    def ensure_user_row_exists(initial_username: str | None = None):
        existing = supabase_admin.table("users").select("id, username").eq("id", user_id).limit(1).execute()
        if existing.data:
            return

        username = initial_username or "user"
        now_iso = datetime.now(timezone.utc).isoformat()
        supabase_admin.table("users").insert(
            {
                "id": user_id,
                "username": username,
                "subscription_tier": "beta_free",
                "registration_date": now_iso,
                "trial_start_date": now_iso,
                "timezone": "UTC",
            }
        ).execute()

        # Ensure discipline_dna row exists too (defaults apply)
        supabase_admin.table("discipline_dna").upsert({"user_id": user_id}, on_conflict="user_id").execute()

    # Derived updates
    if question_key == "q1_username":
        username_value = (answer_json or {}).get("value")
        if not isinstance(username_value, str):
            raise HTTPException(status_code=400, detail="Invalid username value")
        username_value = username_value.strip().lower()
        is_valid, reason = validate_username(username_value)
        if not is_valid:
            raise HTTPException(status_code=400, detail=reason or "invalid_format")

        ensure_user_row_exists(initial_username=username_value)
        supabase_admin.table("users").update({"username": username_value}).eq("id", user_id).execute()

    elif question_key == "q13_hours":
        ensure_user_row_exists()
        value = (answer_json or {}).get("value")
        try:
            hours = float(value)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid hours value")
        supabase_admin.table("users").update({"daily_hours_floor": hours}).eq("id", user_id).execute()

    elif question_key == "q2_gender":
        ensure_user_row_exists()
        gender = (answer_json or {}).get("value")
        if not isinstance(gender, str):
            raise HTTPException(status_code=400, detail="Invalid gender value")
        supabase_admin.table("users").update({"gender": gender}).eq("id", user_id).execute()

    elif question_key == "q3_age":
        ensure_user_row_exists()
        value = (answer_json or {}).get("value")
        try:
            age = int(value)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid age value")
        supabase_admin.table("users").update({"age": age}).eq("id", user_id).execute()

    elif question_key in ("q15_timezone", "q11_timezone"):
        # q11_timezone kept for backward compatibility with older clients
        ensure_user_row_exists()
        tz = (answer_json or {}).get("value")
        if not isinstance(tz, str) or not tz.strip():
            raise HTTPException(status_code=400, detail="Invalid timezone value")
        supabase_admin.table("users").update({"timezone": tz.strip()}).eq("id", user_id).execute()

    elif question_key == "q14_commitment":
        ensure_user_row_exists()
        commitment_value = (answer_json or {}).get("value")
        if commitment_value in ("2_weeks", "1_month", "3_months", "however_long"):
            supabase_admin.table("users").update({"commitment_horizon": commitment_value}).eq(
                "id", user_id
            ).execute()

    return {"saved": True, "question_key": question_key}


async def get_onboarding_progress(user_id: str) -> dict:
    answers_result = (
        supabase_admin.table("onboarding_answers")
        .select("question_key, answer_json")
        .eq("user_id", user_id)
        .execute()
    )
    answers: dict[str, dict] = {}
    for row in answers_result.data or []:
        k = row.get("question_key")
        v = row.get("answer_json")
        if k:
            answers[str(k)] = v or {}

    user_result = (
        supabase_admin.table("users")
        .select("onboarding_complete")
        .eq("id", user_id)
        .single()
        .execute()
    )
    onboarding_complete = bool((user_result.data or {}).get("onboarding_complete", False))

    return {"onboarding_complete": onboarding_complete, "answers": answers}


async def check_username_availability(username: str) -> dict:
    u = (username or "").strip().lower()
    is_valid, reason = validate_username(u)
    if not is_valid:
        return {"available": False, "username": u, "reason": reason or "invalid_format", "suggestion": None}

    taken = await _is_username_taken(u)
    if not taken:
        return {"available": True, "username": u, "suggestion": None}

    suggestion = None
    for _ in range(10):
        num = random.randint(10, 99)
        candidate = f"{u}_{num}"
        if len(candidate) <= 20 and not await _is_username_taken(candidate):
            suggestion = candidate
            break

    return {"available": False, "username": u, "reason": "taken", "suggestion": suggestion}


async def create_profile_if_missing(user_id: str) -> dict:
    existing = supabase_admin.table("users").select("id, username").eq("id", user_id).limit(1).execute()
    if existing.data:
        row = existing.data[0]
        return {"created": False, "username": row.get("username"), "user_id": user_id}

    username = await generate_unique_username()
    now_iso = datetime.now(timezone.utc).isoformat()

    supabase_admin.table("users").insert(
        {
            "id": user_id,
            "username": username,
            "subscription_tier": "beta_free",
            "registration_date": now_iso,
            "trial_start_date": now_iso,
            "timezone": "UTC",
        }
    ).execute()

    # Create discipline_dna row with defaults (archetype set later)
    supabase_admin.table("discipline_dna").upsert({"user_id": user_id}, on_conflict="user_id").execute()

    return {"created": True, "username": username, "user_id": user_id}


async def complete_onboarding(user_id: str) -> dict:
    """
    Runs all post-onboarding setup in sequence.

    Steps:
    1. Load all onboarding_answers for this user
    2. Classify archetype from Q4-Q10 answers
    3. Normalise each interest (from Q11 answers)
    4. Normalise each quit target (from Q12 answers, if any)
    5. Update users table (archetype, onboarding_complete=true, onboarding_completed_at=now)
    6. Update discipline_dna with archetype-based initial values
    7. Create twin_state row (starting at same position as user)
    8. Return archetype reveal data
    """
    notes: list[str] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    # Step 1 — Load answers
    try:
        rows = (
            supabase_admin.table("onboarding_answers")
            .select("question_key, answer_json")
            .eq("user_id", user_id)
            .execute()
        )
        answers: dict[str, dict] = {str(r["question_key"]): (r.get("answer_json") or {}) for r in (rows.data or [])}
    except Exception as e:
        answers = {}
        notes.append(f"failed_to_load_answers: {str(e)}")

    # Step 2 — Classify archetype
    archetype_key = "structured_climber"
    try:
        archetype_input = {
            k: answers[k]["value"]
            for k in [
                "q4_situation",
                "q5_reason",
                "q6_approach",
                "q7_recovery",
                "q8_motivation",
                "q9_autonomy",
                "q10_comparison",
            ]
            if k in answers and isinstance(answers[k], dict) and "value" in answers[k]
        }
        archetype_key = classify_archetype({k: str(v) for k, v in archetype_input.items()})
    except Exception as e:
        archetype_key = "structured_climber"
        notes.append(f"archetype_defaulted: {str(e)}")

    archetype_data = get_archetype_data(archetype_key)

    # Step 3 — Normalise interests and insert into interests table
    interests_created: list[str] = []
    interest_items: list[dict] = []
    q11 = answers.get("q11_interests")
    if isinstance(q11, dict):
        interest_items = q11.get("interests") or []
    if not isinstance(interest_items, list):
        interest_items = []

    # Run all interest normalisations in parallel to cut latency
    interest_inputs: list[tuple[str, str, str | None, list | None]] = []
    for item in interest_items:
        raw_text = str((item or {}).get("raw_text") or "").strip()
        level_text = str((item or {}).get("level_text") or "").strip()
        goal = (item or {}).get("goal")
        user_goal = str(goal).strip() if isinstance(goal, str) else None
        active_days = (item or {}).get("active_days")
        active_days = active_days if isinstance(active_days, list) else None
        interest_inputs.append((raw_text, level_text, user_goal, active_days))

    if interest_inputs:
        coros = [
            normalise_interest(raw, level, user_goal)
            for (raw, level, user_goal, _days) in interest_inputs
        ]
        interest_normalised = await asyncio.gather(*coros, return_exceptions=True)

        for (raw_text, level_text, user_goal, active_days), normalised in zip(
            interest_inputs, interest_normalised, strict=False
        ):
            try:
                if isinstance(normalised, Exception):
                    raise normalised
                normalised = normalised or {}
                level_context = normalised.get("level_context") or {}

                level_meta = INTEREST_LEVEL_MAP.get(
                    level_text, INTEREST_LEVEL_MAP["still_figuring_it_out"]
                )
                row = {
                    "user_id": user_id,
                    "raw_text": raw_text,
                    "normalised_name": normalised.get("normalised_name") or raw_text.title(),
                    "category": normalised.get("category") or "Other",
                    "mission_domain": normalised.get("mission_domain") or raw_text.lower(),
                    "level_context_beginner": (
                        level_context.get("beginner") if isinstance(level_context, dict) else None
                    ),
                    "level_context_intermediate": (
                        level_context.get("intermediate") if isinstance(level_context, dict) else None
                    ),
                    "level_context_advanced": (
                        level_context.get("advanced") if isinstance(level_context, dict) else None
                    ),
                    "evidence_base": normalised.get("evidence_base"),
                    "common_obstacles": normalised.get("common_obstacles") or [],
                    "level_text": level_text or "still_figuring_it_out",
                    "user_goal": user_goal,
                    "active_days": active_days or [1, 2, 3, 4, 5, 6, 7],
                    "interest_level": 1,
                    "interest_xp": 0,
                    "current_difficulty_tier": level_meta["starting_tier"],
                    "current_phase": level_meta["phase"],
                    "total_sessions": 0,
                    "is_active": True,
                }
                ins = supabase_admin.table("interests").insert(row).execute()
                if ins.data and isinstance(ins.data, list) and ins.data[0].get("id"):
                    interests_created.append(str(ins.data[0]["id"]))
            except Exception as e:
                notes.append(f"interest_failed: {str(e)}")
                continue

    # Step 4 — Normalise quit targets and insert into quit_targets table
    quit_targets_created: list[str] = []
    quit_items: list[dict] = []
    q12 = answers.get("q12_quits")
    if isinstance(q12, dict):
        quit_items = q12.get("quit_targets") or []
    if not isinstance(quit_items, list):
        quit_items = []

    quit_inputs: list[tuple[str, str | None, str | None]] = []
    for item in quit_items:
        raw_text = str((item or {}).get("raw_text") or "").strip()
        description = (item or {}).get("description")
        trigger = (item or {}).get("trigger")
        description = str(description).strip() if isinstance(description, str) else None
        trigger = str(trigger).strip() if isinstance(trigger, str) else None
        quit_inputs.append((raw_text, description, trigger))

    if quit_inputs:
        coros_quit = [
            normalise_quit_target(raw, description, trigger)
            for (raw, description, trigger) in quit_inputs
        ]
        quit_normalised = await asyncio.gather(*coros_quit, return_exceptions=True)

        for (raw_text, description, trigger), normalised in zip(
            quit_inputs, quit_normalised, strict=False
        ):
            try:
                if isinstance(normalised, Exception):
                    raise normalised
                normalised = normalised or {}
                row = {
                    "user_id": user_id,
                    "raw_text": raw_text,
                    "user_description": description,
                    "trigger_text": trigger,
                    "normalised_name": normalised.get("normalised_name") or raw_text.title(),
                    "need_category": normalised.get("primary_need_category"),
                    "current_phase": "days_1_10",
                    "current_difficulty_tier": "easy",
                    "is_active": True,
                    "conquered": False,
                    "intervention_hour": normalised.get("intervention_hour"),
                }
                ins = supabase_admin.table("quit_targets").insert(row).execute()
                if ins.data and isinstance(ins.data, list) and ins.data[0].get("id"):
                    quit_targets_created.append(str(ins.data[0]["id"]))
            except Exception as e:
                notes.append(f"quit_target_failed: {str(e)}")
                continue

    # Step 5 — Update users table
    try:
        q14 = answers.get("q14_commitment", {})
        ch = q14.get("value") if isinstance(q14, dict) else None
        user_update: dict = {
            "archetype": archetype_key,
            "onboarding_complete": True,
            "onboarding_completed_at": now_iso,
        }
        if ch in ("2_weeks", "1_month", "3_months", "however_long"):
            user_update["commitment_horizon"] = ch
        supabase_admin.table("users").update(user_update).eq("id", user_id).execute()
    except Exception as e:
        notes.append(f"users_update_failed: {str(e)}")

    # Step 6 — Update discipline_dna (blend commitment horizon with archetype defaults)
    try:
        initial_dna = get_initial_dna(archetype_key)
        commitment_answer = answers.get("q14_commitment", {})
        commitment_value = (
            commitment_answer.get("value", "however_long")
            if isinstance(commitment_answer, dict)
            else "however_long"
        )
        if commitment_value not in COMMITMENT_HORIZON_CONTEXT:
            commitment_value = "however_long"
        horizon_context = COMMITMENT_HORIZON_CONTEXT[commitment_value]
        nudge_intensity = horizon_context["nudge_intensity"]
        if nudge_intensity == "high" and initial_dna.get("twin_message_frequency") == "low":
            initial_dna["twin_message_frequency"] = "medium"
        elif nudge_intensity == "low" and initial_dna.get("twin_message_frequency") == "high":
            initial_dna["twin_message_frequency"] = "medium"

        supabase_admin.table("discipline_dna").upsert(
            {**initial_dna, "user_id": user_id, "last_calibration_at": now_iso},
            on_conflict="user_id",
        ).execute()
    except Exception as e:
        notes.append(f"dna_update_failed: {str(e)}")

    # Step 7 — Create twin_state (idempotent)
    try:
        existing = supabase_admin.table("twin_state").select("user_id").eq("user_id", user_id).execute()
        if not existing.data:
            from app.services.strip_message_service import get_strip_message

            _dna_tone = get_initial_dna(archetype_key)
            _tone = str(_dna_tone.get("twin_tone_type", "rival")).lower()
            if _tone not in ("rival", "philosopher", "silent_force"):
                _tone = "rival"
            _day_one_strip = get_strip_message("neck_and_neck", _tone, None, "you")

            supabase_admin.table("twin_state").insert(
                {
                    "user_id": user_id,
                    "twin_xp": 0,
                    "twin_pf": 0,
                    "twin_character_stage": 1,
                    "twin_pet_stage": 0,
                    "twin_pet_unlocked": False,
                    "twin_streak": 0,
                    "current_gap_state": "neck_and_neck",
                    "consistency_ceiling": TWIN_INITIAL_CONSISTENCY,
                    "strip_message": _day_one_strip,
                }
            ).execute()
    except Exception as e:
        notes.append(f"twin_state_failed: {str(e)}")

    # Step 7b — Send welcome in-app mail
    try:
        from app.services.mail_service import send_welcome_mail_sequence
        await send_welcome_mail_sequence(user_id)
    except Exception as e:
        notes.append(f"welcome_mail_failed: {str(e)}")

    # Step 8 — Return archetype reveal data
    from app.core.constants import COMMITMENT_HORIZON_CONTEXT

    commitment_answer = answers.get("q14_commitment", {})
    commitment_value = (
        commitment_answer.get("value", "however_long")
        if isinstance(commitment_answer, dict)
        else "however_long"
    )
    twin_first_message = COMMITMENT_HORIZON_CONTEXT.get(
        commitment_value, COMMITMENT_HORIZON_CONTEXT["however_long"]
    )["twin_message"]

    resp = {
        "success": True,
        "archetype": archetype_key,
        "archetype_name": archetype_data["name"],
        "archetype_tagline": archetype_data["tagline"],
        "archetype_reveal_message": archetype_data["reveal_message"],
        "twin_first_message": twin_first_message,
        "interests_processed": len(interests_created),
        "quit_targets_processed": len(quit_targets_created),
    }
    if notes:
        resp["notes"] = notes
    return resp

