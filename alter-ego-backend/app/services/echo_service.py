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


async def fire_echo_for_user(
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
            supabase.table("twin_state").update({"strip_message": text}).eq(
                "user_id", user_id
            ).execute()
        elif echo_type == "journal":
            _upsert_twin_journal(supabase, user_id, user, today, text)

        prev_count = int(user.get("echoes_fired_count") or 0)
        supabase.table("users").update(
            {
                "last_echo_fired_at": datetime.now(timezone.utc).isoformat(),
                "last_echo_question_key": question_key,
                "echoes_fired_count": prev_count + 1,
            }
        ).eq("id", user_id).execute()

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
    _ = echo_day_number
    try:
        from app.core.constants import CONTRADICTION_TEMPLATES, ARCHETYPES

        answers = load_onboarding_answers(supabase, user_id)
        archetype_key = str(user.get("archetype") or "").strip()
        arche_label = ARCHETYPES.get(archetype_key, {}).get("name", archetype_key or "your archetype")

        today = date_type.today().isoformat()
        week_ago = (date_type.today() - timedelta(days=7)).isoformat()

        rate, missions = _week_completion_rate(supabase, user_id, week_ago, today)
        if missions:
            # 1) Numeric discipline_rating (optional future key) ≥7 and low completion
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

            # 1b) Claimed daily hours (q13) ≥5 and completion <60%
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

        # 2) Many interests, several inactive
        interests_result = (
            supabase.table("interests").select("id, is_active").eq("user_id", user_id).execute()
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

        # 3) Structured climber + many “empty” days in last 14d
        if archetype_key == "structured_climber":
            two_weeks_ago = (date_type.today() - timedelta(days=14)).isoformat()
            miss_result = (
                supabase.table("missions")
                .select("mission_date, completed")
                .eq("user_id", user_id)
                .gte("mission_date", two_weeks_ago)
                .lte("mission_date", today)
                .execute()
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
