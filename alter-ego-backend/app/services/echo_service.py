"""
Onboarding Echo System (C1) and Contradiction Log (C2).

Surfaces onboarding answers and light-touch contradictions via twin strip / journal.
Silent on errors — never blocks the scheduler.
"""

from __future__ import annotations

import json
import logging
import random
from datetime import datetime, timezone, timedelta, date as date_type
from typing import Any

logger = logging.getLogger(__name__)


def _days_since(dt_val: str | None) -> int:
    """Days since a timestamptz. Large value if missing/invalid (treat as eligible)."""
    if not dt_val:
        return 999
    try:
        dt = datetime.fromisoformat(str(dt_val).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except Exception:
        return 999


def should_fire_echo(user: dict) -> bool:
    """True if at least 7 days since last echo."""
    return _days_since(user.get("last_echo_fired_at")) >= 7


def should_fire_contradiction(user: dict) -> bool:
    """True if at least 10 days since last contradiction."""
    return _days_since(user.get("last_contradiction_fired_at")) >= 10


def _answer_json_to_string(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw.strip()
    if isinstance(raw, dict):
        if "value" in raw:
            v = raw.get("value")
            if isinstance(v, list):
                return ", ".join(str(x) for x in v if x is not None).strip()
            return str(v).strip() if v is not None else ""
        if "quit_targets" in raw:
            quits = raw.get("quit_targets") or []
            names = [str(q.get("name") or "").strip() for q in quits if isinstance(q, dict)]
            names = [n for n in names if n]
            return ", ".join(names)
        if "interests" in raw:
            ints = raw.get("interests") or []
            parts: list[str] = []
            for it in ints:
                if isinstance(it, dict):
                    t = it.get("title") or it.get("name") or it.get("raw_text")
                    if t:
                        parts.append(str(t).strip())
            return ", ".join(parts)
        v = raw.get("text") or raw.get("value")
        return str(v).strip() if v is not None else ""
    if isinstance(raw, list):
        return ", ".join(str(x) for x in raw if x is not None).strip()
    return str(raw).strip()


def _humanize_snake(s: str) -> str:
    t = s.strip().replace("_", " ")
    return t if t else s


def _merge_onboarding_aliases(answers: dict[str, str]) -> None:
    """
    Phase 1 renames: canonical keys (q12_*, q13_*, q14_*) inherit from legacy rows
    when the new key is missing so echo/contradiction see one merged value.
    """
    pairs = (
        ("q12_interests", "q11_interests"),
        ("q13_quits", "q12_quits"),
        ("q14_hours", "q13_hours"),
    )
    for new_k, old_k in pairs:
        cur = (answers.get(new_k) or "").strip()
        legacy = (answers.get(old_k) or "").strip()
        merged = cur or legacy
        if merged:
            answers[new_k] = merged


# Maps any stored question_key to a family id so we do not echo twice after renumbering.
_ECHO_KEY_FAMILY: dict[str, str] = {
    "q11_interests": "interests",
    "q12_interests": "interests",
    "q12_quits": "quits",
    "q13_quits": "quits",
    "q13_hours": "hours",
    "q14_hours": "hours",
}


def _echo_family_id(question_key: str | None) -> str | None:
    if not question_key:
        return None
    return _ECHO_KEY_FAMILY.get(question_key, question_key)


def load_onboarding_answers(supabase: Any, user_id: str) -> dict[str, str]:
    """{question_key: display string}. Silent on error."""
    try:
        result = (
            supabase.table("onboarding_answers")
            .select("question_key, answer_json")
            .eq("user_id", user_id)
            .execute()
        )
        answers: dict[str, str] = {}
        for row in result.data or []:
            key = row.get("question_key") or ""
            if not key:
                continue
            raw = row.get("answer_json")
            s = _answer_json_to_string(raw)
            if s:
                answers[str(key)] = _humanize_snake(s) if key.startswith("q") else s
        _merge_onboarding_aliases(answers)
        return answers
    except Exception as e:
        logger.error(
            json.dumps(
                {"event": "echo_load_answers_error", "user_id": user_id, "error": str(e)}
            )
        )
        return {}


def select_echo(
    answers: dict[str, str],
    last_key: str | None,
    echo_day_number: int,
) -> tuple[str, str, str] | None:
    """Returns (question_key, echo_type, rendered_text) or None."""
    from app.core.constants import ECHO_PRIORITY_KEYS, ONBOARDING_ECHO_TEMPLATES

    last_f = _echo_family_id(last_key)
    for key in ECHO_PRIORITY_KEYS:
        if last_key and (
            key == last_key or _echo_family_id(key) == last_f
        ):
            continue
        answer = str(answers.get(key, "") or "")[:100].strip()
        if not answer or len(answer) < 2:
            continue
        templates = ONBOARDING_ECHO_TEMPLATES.get(key, [])
        if not templates:
            continue
        tmpl = random.choice(templates)
        text = (
            tmpl["template"]
            .replace("{answer}", answer)
            .replace("{days}", str(max(1, echo_day_number)))
        )
        return (key, tmpl["type"], text)
    return None


def _merge_journal_content(supabase: Any, user_id: str, entry_date: str, new_paragraph: str) -> str:
    try:
        r = (
            supabase.table("twin_journal")
            .select("content")
            .eq("user_id", user_id)
            .eq("entry_date", entry_date)
            .limit(1)
            .execute()
        )
        rows = r.data or []
        if not rows:
            return new_paragraph
        prev = (rows[0].get("content") or "").strip()
        if not prev:
            return new_paragraph
        return f"{prev}\n\n{new_paragraph}"
    except Exception:
        return new_paragraph


def _upsert_twin_journal(
    supabase: Any,
    user_id: str,
    user: dict,
    entry_date: str,
    content: str,
) -> None:
    merged = _merge_journal_content(supabase, user_id, entry_date, content)
    arche = user.get("archetype")
    arche_str = str(arche) if arche is not None else None
    supabase.table("twin_journal").upsert(
        {
            "user_id": user_id,
            "entry_date": entry_date,
            "content": merged,
            "relationship_phase": "mirror",
            "missions_completed": 0,
            "missions_total": 0,
            "archetype": arche_str,
        },
        on_conflict="user_id,entry_date",
    ).execute()


async def _fire_onboarding_echo(
    supabase: Any,
    user_id: str,
    user: dict,
    echo_day_number: int,
) -> bool:
    try:
        answers = load_onboarding_answers(supabase, user_id)
        if not answers:
            return False

        last_key = user.get("last_echo_question_key")
        picked = select_echo(answers, last_key, echo_day_number)
        if not picked:
            return False

        question_key, echo_type, text = picked
        today = date_type.today().isoformat()

        if echo_type == "strip":
            await run_query(supabase.table("twin_state").update({"strip_message": text}).eq(
                "user_id", user_id
            ))
        elif echo_type == "journal":
            _upsert_twin_journal(supabase, user_id, user, today, text)

        prev_count = int(user.get("echoes_fired_count") or 0)
        await run_query(supabase.table("users").update(
            {
                "last_echo_fired_at": datetime.now(timezone.utc).isoformat(),
                "last_echo_question_key": question_key,
                "echoes_fired_count": prev_count + 1,
            }
        ).eq("id", user_id))

        logger.info(
            json.dumps(
                {
                    "event": "echo_fired",
                    "user_id": user_id,
                    "echo_type": echo_type,
                    "question_key": question_key,
                }
            )
        )
        return True
    except Exception as e:
        logger.error(
            json.dumps(
                {"event": "echo_fire_error", "user_id": user_id, "error": str(e)[:200]}
            )
        )
        return False


async def _fire_free_text_echo(
    supabase: Any, user_id: str, user: dict, echo_day_number: int
) -> bool:
    """
    Free-text echo: quotes the user's exact words from Q5 or Q11 onboarding answers.
    Generates a 1-2 sentence personalized echo via GPT-4o-mini.
    Delivered via twin strip (short) or twin journal (longer).
    Returns False if answers are too short or LLM fails — never raises.
    """
    from app.core.supabase_client import supabase_admin
    from app.agents.base import run_agent
    from pydantic import BaseModel, Field as PydanticField

    class FreeTextEchoResult(BaseModel):
        echo_text: str = PydanticField(
            ...,
            description="1-2 sentences. Quotes user's exact words in quotation marks. Connects to specific current achievement.",
        )
        use_journal: bool = PydanticField(
            default=False,
            description="True if the echo is longer and better suited for the twin journal vs strip.",
        )

    answers = load_onboarding_answers(supabase, user_id)
    q5 = (answers.get("q5_reason") or "").strip()
    q11 = (answers.get("q11_discipline") or "").strip()

    if len(q5) < 10 and len(q11) < 10:
        return False

    echoes_fired = int(user.get("echoes_fired_count") or 0)
    prefer_q11 = echoes_fired % 4 == 3
    if prefer_q11 and len(q11) >= 10:
        chosen_answer = q11
        chosen_label = "What discipline means to you"
        q_key = "q11_discipline"
    elif len(q5) >= 10:
        chosen_answer = q5
        chosen_label = "Why are you here"
        q_key = "q5_reason"
    elif len(q11) >= 10:
        chosen_answer = q11
        chosen_label = "What discipline means to you"
        q_key = "q11_discipline"
    else:
        return False

    streak = int(user.get("current_streak") or 0)

    try:
        interests_r = (
            await run_query(supabase_admin.table("interests")
            .select("normalised_name, current_arc_phase")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(2))
        )
        interest_summary = ", ".join(
            f"{i.get('normalised_name')} ({i.get('current_arc_phase', '')})"
            for i in (interests_r.data or [])
            if i.get("normalised_name")
        ) or "None"
    except Exception:
        interest_summary = "None"

    try:
        quit_r = (
            await run_query(supabase_admin.table("quit_paths")
            .select("habit_name, current_phase")
            .eq("user_id", user_id)
            .in_("status", ["active", "paused", "referral_only"])
            .limit(1))
        )
        quit_row = (quit_r.data or [None])[0] or {}
        quit_summary = (
            f"{quit_row['habit_name']} ({quit_row.get('current_phase', '')})"
            if quit_row.get("habit_name")
            else "None"
        )
    except Exception:
        quit_summary = "None"

    try:
        dna_r = (
            await run_query(supabase_admin.table("discipline_dna")
            .select("guilt_orientation")
            .eq("user_id", user_id)
            .limit(1))
        )
        guilt_orientation = float(((dna_r.data or [{}])[0]).get("guilt_orientation") or 0.0)
    except Exception:
        guilt_orientation = 0.0

    system_prompt = """You write deeply personal echo messages for ALTER EGO.
An echo quotes the user's own words back to them and connects those words to where they are now.
The echo should feel like the app REMEMBERS what they said and is reflecting it at the right moment.

RULES:
- Quote their EXACT words using quotation marks
- Connect to a SPECIFIC current achievement or pattern (streak, interest, quit progress)
- Tone: observational, not motivational. Like a mirror, not a cheerleader.
- If guilt_orientation > 0.7: use ONLY positive connections. Never echo to highlight failure.
- 1-2 sentences maximum.
- No exclamation marks.

EXAMPLES:
User wrote "I'm tired of hating myself for quitting" + 21-day streak:
→ echo_text: "You said: 'I'm tired of hating myself for quitting.' That was 21 days ago. You haven't quit."
   use_journal: false

User wrote "Having control over my own life" + 5/7 days complete:
→ echo_text: "Your definition of discipline: 'Having control over my own life.' 5 out of 7 days this week, you had it."
   use_journal: false

User wrote "I want to prove I can actually commit" + guitar arc 50%:
→ echo_text: "You came here saying you wanted to prove you could commit. You're halfway through your guitar journey. That's commitment."
   use_journal: true
"""

    user_message = f"""The user wrote this {echo_day_number} days ago:
{chosen_label}: "{chosen_answer}"

Current state:
- Day {echo_day_number}, streak: {streak} days
- Active interests: {interest_summary}
- Quit progress: {quit_summary}
- guilt_orientation: {guilt_orientation}

Generate a 1-2 sentence echo. Quote their exact words. Connect to their specific current state.
Set use_journal=true only if the echo is longer than one short sentence."""

    try:
        result = await run_agent(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=FreeTextEchoResult,
            temperature=0.7,
            max_tokens=150,
            context_label="Echo:FreeText",
        )
        echo_text = result.echo_text.strip()
        use_journal = result.use_journal
    except Exception as e:
        logger.error(
            json.dumps(
                {"event": "free_text_echo_llm_error", "user_id": user_id, "error": str(e)[:200]}
            )
        )
        return False

    if not echo_text:
        return False

    today = date_type.today().isoformat()

    if use_journal or len(echo_text) > 110:
        _upsert_twin_journal(supabase, user_id, user, today, echo_text)
    else:
        await run_query(supabase.table("twin_state").update({"strip_message": echo_text}).eq("user_id", user_id))

    prev_count = int(user.get("echoes_fired_count") or 0)
    await run_query(supabase.table("users").update(
        {
            "last_echo_fired_at": datetime.now(timezone.utc).isoformat(),
            "last_echo_question_key": q_key,
            "echoes_fired_count": prev_count + 1,
        }
    ).eq("id", user_id))

    logger.info(json.dumps({"event": "free_text_echo_fired", "user_id": user_id, "q_used": q_key}))
    return True


async def _maybe_fire_memory_anchor_echo(
    supabase: Any, user_id: str, user: dict, echo_day_number: int
) -> bool:
    """
    Memory anchor echo — the rarest, most powerful echo type. Max once per month.
    Requires: a relevant anchor + 14+ days since anchor created + 30+ days since last anchor echo.
    Template-based using anchor.reference_phrase and anchor.summary.
    HARD RULE: For guilt_orientation > 0.7, only fire POSITIVE anchors (never echo a broken commitment).
    """
    from app.core.supabase_client import supabase_admin

    last_anchor_echo = user.get("last_memory_anchor_echo_at")
    if last_anchor_echo and _days_since(last_anchor_echo) < 30:
        return False

    try:
        dna_r = (
            await run_query(supabase_admin.table("discipline_dna")
            .select("guilt_orientation")
            .eq("user_id", user_id)
            .limit(1))
        )
        guilt_orientation = float(((dna_r.data or [{}])[0]).get("guilt_orientation") or 0.0)
    except Exception:
        guilt_orientation = 0.0

    try:
        anchors_result = (
            await run_query(supabase_admin.table("memory_anchors")
            .select("id, reference_phrase, summary, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True))
        )
        anchors = anchors_result.data or []
    except Exception:
        return False

    eligible = [a for a in anchors if _days_since(a.get("created_at")) >= 14]
    if not eligible:
        return False

    if guilt_orientation > 0.7:
        positive_keywords = [
            "committed",
            "promise",
            "goal",
            "proud",
            "achieve",
            "daughter",
            "family",
            "doing this for",
            "succeed",
        ]
        negative_keywords = [
            "almost quit",
            "struggled",
            "hard time",
            "wanted to give up",
            "considered stopping",
        ]
        eligible = [
            a
            for a in eligible
            if (
                any(kw in (a.get("summary") or "").lower() for kw in positive_keywords)
                and not any(kw in (a.get("summary") or "").lower() for kw in negative_keywords)
            )
        ]
        if not eligible:
            return False

    anchor = eligible[0]
    reference_phrase = (anchor.get("reference_phrase") or "").strip()
    summary = (anchor.get("summary") or "").lower()
    days_ago = _days_since(anchor.get("created_at"))
    week_number = max(1, echo_day_number // 7)

    text = ""
    if any(kw in summary for kw in ["daughter", "family", "for someone", "doing this for"]):
        text = f"You told your Twin you were doing this for {reference_phrase}. Week {week_number}. They'd be proud."
    elif any(kw in summary for kw in ["almost quit", "wanted to give up"]):
        if guilt_orientation <= 0.5:
            text = f"Remember the week you almost stopped? That was {days_ago} days ago. Look where you are now."
        else:
            return False
    elif any(kw in summary for kw in ["promise", "committed", "never skip", "never miss"]):
        text = f"You promised your Twin: {reference_phrase}. It's been {days_ago} days. Promise kept."
    else:
        if reference_phrase:
            text = f'You told your Twin: "{reference_phrase}." {days_ago} days later. Still moving.'

    if not text.strip():
        return False

    today = date_type.today().isoformat()

    if len(text) <= 120:
        await run_query(supabase.table("twin_state").update({"strip_message": text}).eq("user_id", user_id))
    else:
        _upsert_twin_journal(supabase, user_id, user, today, text)

    try:
        await run_query(supabase.table("users").update(
            {"last_memory_anchor_echo_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id))
    except Exception:
        pass

    logger.info(
        json.dumps(
            {
                "event": "memory_anchor_echo_fired",
                "user_id": user_id,
                "anchor_id": str(anchor.get("id", "")),
            }
        )
    )
    return True


async def fire_echo_for_user(
    supabase: Any,
    user_id: str,
    user: dict,
    echo_day_number: int,
) -> bool:
    try:
        echoes_fired = int(user.get("echoes_fired_count") or 0)
        week_number = max(1, echoes_fired + 1)

        use_free_text = week_number % 2 == 0

        if use_free_text:
            fired = await _fire_free_text_echo(supabase, user_id, user, echo_day_number)
            if not fired:
                fired = await _fire_onboarding_echo(supabase, user_id, user, echo_day_number)
        else:
            fired = await _fire_onboarding_echo(supabase, user_id, user, echo_day_number)

        try:
            await _maybe_fire_memory_anchor_echo(supabase, user_id, user, echo_day_number)
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "memory_anchor_echo_error",
                        "user_id": user_id,
                        "error": str(e)[:200],
                    }
                )
            )

        return fired
    except Exception as e:
        logger.error(
            json.dumps({"event": "echo_fire_error", "user_id": user_id, "error": str(e)[:200]})
        )
        return False


def _week_completion_rate(supabase: Any, user_id: str, start_d: str, end_d: str) -> tuple[int, list[dict]]:
    missions_result = (
        supabase.table("missions")
        .select("completed")
        .eq("user_id", user_id)
        .gte("mission_date", start_d)
        .lte("mission_date", end_d)
        .execute()
    )
    missions = missions_result.data or []
    if not missions:
        return 0, missions
    done = sum(1 for m in missions if m.get("completed"))
    rate = int(done / len(missions) * 100)
    return rate, missions


def _store_contradiction_journal(
    supabase: Any, user_id: str, user: dict, today: str, text: str
) -> None:
    """Append contradiction to today's twin journal and stamp user row."""
    _upsert_twin_journal(supabase, user_id, user, today, text)
    supabase.table("users").update(
        {"last_contradiction_fired_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", user_id).execute()


async def fire_contradiction_for_user(
    supabase: Any,
    user_id: str,
    user: dict,
    echo_day_number: int,
) -> bool:
    try:
        from app.core.constants import CONTRADICTION_TEMPLATES, ARCHETYPES
        from app.core.supabase_client import supabase_admin

        today = date_type.today().isoformat()
        thirty_days_ago = (date_type.today() - timedelta(days=30)).isoformat()

        rate_30, _missions_30 = _week_completion_rate(supabase, user_id, thirty_days_ago, today)

        dna: dict = {}
        try:
            dna_r = (
                await run_query(supabase_admin.table("discipline_dna")
                .select("guilt_orientation, execution_gap, self_belief, core_failure_pattern")
                .eq("user_id", user_id)
                .limit(1))
            )
            dna = (dna_r.data or [{}])[0]
        except Exception:
            pass

        guilt_orientation = float(dna.get("guilt_orientation") or 0.0)
        execution_gap = float(dna.get("execution_gap") or 0.0)
        sb = dna.get("self_belief")
        self_belief = float(sb) if sb is not None else 0.5
        core_failure_pattern = str(dna.get("core_failure_pattern") or "")
        current_streak = int(user.get("current_streak") or 0)

        try:
            if execution_gap > 0.6 and rate_30 > 80:
                tmpl = CONTRADICTION_TEMPLATES["execution_gap_closing"]
                text = tmpl["template"].replace("{rate}", str(rate_30))
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "execution_gap_closing",
                        }
                    )
                )
                return True
        except Exception:
            pass

        try:
            if self_belief < 0.3 and current_streak > 21:
                tmpl = CONTRADICTION_TEMPLATES["self_belief_evolution"]
                text = tmpl["template"].replace("{days}", str(current_streak))
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "self_belief_evolution",
                        }
                    )
                )
                return True
        except Exception:
            pass

        try:
            if core_failure_pattern == "fade_after_start" and echo_day_number > 30 and rate_30 > 60:
                tmpl = CONTRADICTION_TEMPLATES["failure_pattern_broken"]
                text = tmpl["template"].replace("{day}", str(echo_day_number))
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "failure_pattern_broken",
                        }
                    )
                )
                return True
        except Exception:
            pass

        try:
            ir = (
                await run_query(supabase_admin.table("interests")
                .select("normalised_name, sessions_completed")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .gt("sessions_completed", 20)
                .limit(1))
            )
            row = (ir.data or [None])[0]
            if row and row.get("normalised_name"):
                interest = str(row["normalised_name"])
                tmpl = CONTRADICTION_TEMPLATES["interest_commitment"]
                text = tmpl["template"].replace("{interest}", interest)
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "interest_commitment",
                        }
                    )
                )
                return True
        except Exception:
            pass

        try:
            qr = (
                await run_query(supabase_admin.table("quit_paths")
                .select("habit_name, current_phase")
                .eq("user_id", user_id)
                .in_("status", ["active", "paused", "referral_only"])
                .eq("current_phase", "consolidation")
                .limit(1))
            )
            qrow = (qr.data or [None])[0]
            if qrow and qrow.get("habit_name"):
                habit = str(qrow["habit_name"])
                tmpl = CONTRADICTION_TEMPLATES["quit_transformation"]
                text = tmpl["template"].replace("{habit}", habit)
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "quit_transformation",
                        }
                    )
                )
                return True
        except Exception:
            pass

        if guilt_orientation >= 0.5:
            return False

        answers = load_onboarding_answers(supabase, user_id)
        archetype_key = str(user.get("archetype") or "").strip()
        arche_label = ARCHETYPES.get(archetype_key, {}).get("name", archetype_key or "your archetype")

        week_ago = (date_type.today() - timedelta(days=7)).isoformat()

        rate, missions = _week_completion_rate(supabase, user_id, week_ago, today)
        if missions:
            disc_raw = answers.get("discipline_rating", "").strip()
            if disc_raw.isdigit() and int(disc_raw) >= 7 and rate < 60:
                tmpl = CONTRADICTION_TEMPLATES["discipline_vs_data"]
                text = tmpl["template"].replace("{rating}", disc_raw).replace("{rate}", str(rate))
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "discipline_vs_data",
                        }
                    )
                )
                return True

            hours_raw = (answers.get("q14_hours") or answers.get("q13_hours") or "").strip()
            try:
                hours_val = float(hours_raw.replace(",", "."))
            except (TypeError, ValueError):
                hours_val = 0.0
            if hours_val >= 5 and rate < 60:
                tmpl = CONTRADICTION_TEMPLATES["claimed_hours_vs_data"]
                text = tmpl["template"].replace("{hours}", str(int(hours_val))).replace(
                    "{rate}", str(rate)
                )
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "claimed_hours_vs_data",
                        }
                    )
                )
                return True

        interests_result = (
            await run_query(supabase.table("interests").select("id, is_active").eq("user_id", user_id))
        )
        all_interests = interests_result.data or []
        if len(all_interests) >= 3:
            active_n = sum(1 for i in all_interests if i.get("is_active"))
            inactive_n = len(all_interests) - active_n
            if inactive_n >= 2:
                tmpl = CONTRADICTION_TEMPLATES["interests_vs_completion"]
                text = (
                    tmpl["template"]
                    .replace("{listed}", str(len(all_interests)))
                    .replace("{active}", str(active_n))
                    .replace("{inactive}", str(inactive_n))
                )
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "interests_vs_completion",
                        }
                    )
                )
                return True

        if archetype_key == "structured_climber":
            two_weeks_ago = (date_type.today() - timedelta(days=14)).isoformat()
            miss_result = (
                await run_query(supabase.table("missions")
                .select("mission_date, completed")
                .eq("user_id", user_id)
                .gte("mission_date", two_weeks_ago)
                .lte("mission_date", today))
            )
            by_date: dict[str, list] = {}
            for m in miss_result.data or []:
                d = str(m.get("mission_date", ""))[:10]
                if not d:
                    continue
                by_date.setdefault(d, []).append(m)

            missed_days = 0
            for _d, day_missions in by_date.items():
                if not day_missions:
                    continue
                if all(not m.get("completed") for m in day_missions):
                    missed_days += 1

            if missed_days >= 3:
                tmpl = CONTRADICTION_TEMPLATES["archetype_vs_behavior"]
                text = tmpl["template"].replace("{archetype}", arche_label)
                _store_contradiction_journal(supabase, user_id, user, today, text)
                logger.info(
                    json.dumps(
                        {
                            "event": "contradiction_fired",
                            "user_id": user_id,
                            "type": "archetype_vs_behavior",
                        }
                    )
                )
                return True

        return False
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "contradiction_fire_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        return False
