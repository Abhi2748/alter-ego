"""Profiler Agent (J1) — Behavioral adaptation engine (Twin Design §4).

Responsible for updating discipline_dna based on:
- archetype + onboarding answers (Day 0)
- ~10 days of mission completion data + twin_chat engagement (Day 10, then every 14 days)

Output discipline_dna must include at least:
- tone_type: "rival" | "philosopher" | "silent_force"
- intensity: 1–5 (never jump >1 point per recalibration)
- gap_behavior: "chase" | "steady" | "rubber_band"
- challenge_level: "low" | "medium" | "high"

For backward compatibility with earlier phases, we also mirror:
- twin_tone_type, twin_intensity, twin_gap_behavior
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Tuple

from langchain_openai import ChatOpenAI

from utils.supabase_client import get_supabase


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_discipline_dna(archetype: str) -> Dict[str, Any]:
    """Fallback discipline_dna if none exists yet."""
    base = {
        "tone_type": "rival",
        "intensity": 3,
        "gap_behavior": "steady",
        "challenge_level": "medium",
    }
    if archetype == "The Recovering Escaper":
        base.update({"tone_type": "philosopher", "intensity": 2, "gap_behavior": "rubber_band"})
    elif archetype == "The Social Competitor":
        base.update({"tone_type": "rival", "intensity": 4, "gap_behavior": "chase"})
    return base


def _clamp_intensity(new_intensity: int, prev_intensity: int | None) -> int:
    """Ensure intensity in [1,5] and never jumps more than 1 point from previous."""
    new_intensity = max(1, min(5, int(new_intensity or 3)))
    if prev_intensity is None:
        return new_intensity
    if new_intensity > prev_intensity + 1:
        return prev_intensity + 1
    if new_intensity < prev_intensity - 1:
        return prev_intensity - 1
    return new_intensity


def _collect_behavioral_signals(user_id: str) -> Dict[str, Any]:
    """Aggregate last ~10 days of mission + chat data into simple signals."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=10)).isoformat()

    # Missions in last 10 days
    mr = (
        supabase.table("missions")
        .select("type, difficulty, completed_at, expires_at")
        .eq("user_id", user_id)
        .gte("expires_at", window_start)
        .lte("expires_at", now.isoformat())
        .execute()
    )
    missions = mr.data or []
    total = len(missions)
    completed = sum(1 for m in missions if m.get("completed_at"))
    completion_rate = (completed / total) if total > 0 else 0.0

    # Difficulty tolerance: ratios of completed missions by difficulty
    diff_counts = {"Easy": 0, "Medium": 0, "Hard": 0}
    for m in missions:
        if m.get("completed_at"):
            d = m.get("difficulty")
            if d in diff_counts:
                diff_counts[d] += 1
    total_completed = sum(diff_counts.values())
    if total_completed > 0:
        diff_ratio = {k: v / total_completed for k, v in diff_counts.items()}
    else:
        diff_ratio = {k: 0.0 for k in diff_counts}

    # Mission skip pattern: which types are most often left incomplete
    skip_counts = {"core": 0, "interest": 0, "personal": 0, "recovery": 0}
    for m in missions:
        if not m.get("completed_at"):
            t = m.get("type")
            if t in skip_counts:
                skip_counts[t] += 1
    most_skipped_type = None
    if sum(skip_counts.values()) > 0:
        most_skipped_type = max(skip_counts.items(), key=lambda kv: kv[1])[0]

    # Twin chat engagement: last 10 days
    cr = (
        supabase.table("twin_chat")
        .select("role, content, created_at")
        .eq("user_id", user_id)
        .gte("created_at", window_start)
        .execute()
    )
    chats = cr.data or []
    twin_msgs = [c for c in chats if c.get("role") == "twin"]
    user_msgs = [c for c in chats if c.get("role") == "user"]
    avg_user_len = 0.0
    if user_msgs:
        total_chars = sum(len((c.get("content") or "")) for c in user_msgs)
        avg_user_len = total_chars / len(user_msgs)

    return {
        "window_start": window_start,
        "window_days": 10,
        "completion_rate": completion_rate,
        "difficulty_completed_ratio": diff_ratio,
        "most_skipped_type": most_skipped_type,
        "twin_chat_twin_messages": len(twin_msgs),
        "twin_chat_user_messages": len(user_msgs),
        "twin_chat_avg_user_length": avg_user_len,
    }


def _build_profiler_prompt(
    archetype: str,
    previous_dna: Dict[str, Any] | None,
    signals: Dict[str, Any],
    onboarding_answers: Dict[str, Any] | None,
) -> str:
    """System prompt for Profiler J1."""
    prev = previous_dna or {}
    prev_intensity = prev.get("intensity") or prev.get("twin_intensity")
    prev_tone = prev.get("tone_type") or prev.get("twin_tone_type")
    prev_gap = prev.get("gap_behavior") or prev.get("twin_gap_behavior")
    prev_challenge = prev.get("challenge_level")

    return f"""
You are the Profiler Agent (J1) for ALTER EGO.
Your job is to update discipline_dna for a single user based on their archetype,
onboarding answers, and ~10 days of behaviour.

discipline_dna must include at minimum:
- tone_type: "rival" | "philosopher" | "silent_force"
- intensity: integer 1–5
- gap_behavior: "chase" | "steady" | "rubber_band"
- challenge_level: "low" | "medium" | "high"

You MUST follow these rules:
1. Intensity can NEVER jump more than 1 point per recalibration cycle.
   If previous intensity was {prev_intensity}, new intensity must be {prev_intensity}-1, {prev_intensity}, or {prev_intensity}+1 (and always between 1 and 5).
2. If completion_rate < 0.40:
   - lower intensity by 1 (unless already 1)
   - set gap_behavior to "rubber_band"
   - set challenge_level to "low"
3. If completion_rate > 0.80:
   - raise intensity by 1 (unless already 5)
   - prefer gap_behavior "chase"
   - set challenge_level to "high"
4. Otherwise (0.40–0.80 completion):
   - keep intensity near previous
   - prefer gap_behavior "steady" unless archetype strongly suggests otherwise
   - set challenge_level to "medium".
5. If Hard missions are rarely completed compared to Easy/Medium, keep challenge_level at most "medium".
6. If user consistently completes Hard missions, you MAY set challenge_level to "high" even if completion_rate is moderate.
7. If twin_chat engagement is very low (few or no messages), slightly soften tone (towards philosopher / silent_force) and avoid raising intensity.
8. If twin_chat engagement is high AND completion_rate is high, you MAY raise intensity and keep tone_type competitive.
9. NEVER change tone_type to something that contradicts the archetype's core (e.g. Social Competitor should bias to rival).
10. Output ONLY strict JSON. No explanation, no comments.

Archetype: {archetype}
Previous discipline_dna (may be empty on Day 0) as JSON:
{prev}

Behavioural signals (last ~10 days) as JSON:
{signals}

Onboarding answers (may be empty for recalibration) as JSON:
{onboarding_answers or {}}

Return JSON with at least:
{{
  "tone_type": "...",
  "intensity": 1-5,
  "gap_behavior": "...",
  "challenge_level": "low" | "medium" | "high"
}}
You MAY include additional keys, but they will be ignored.
"""


def run_profiler(user_id: str, onboarding_answers: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Entry point used by POST /agents/profile.

    Returns updated discipline_dna dict. Caller is responsible for persisting it.
    """
    supabase = get_supabase()

    # Fetch user archetype + existing discipline_dna
    ur = (
        supabase.table("users")
        .select("archetype, discipline_dna")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = ur.data or {}
    archetype = data.get("archetype") or "The Fresh Starter"
    previous_dna = data.get("discipline_dna") or _default_discipline_dna(archetype)

    signals = _collect_behavioral_signals(user_id)
    system_prompt = _build_profiler_prompt(archetype, previous_dna, signals, onboarding_answers)

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    response = llm.invoke(system_prompt)
    content = response.content if isinstance(response.content, str) else str(response.content)

    try:
        import json

        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("Profiler output was not a JSON object")
    except Exception:
        # Fallback: keep previous_dna unchanged
        parsed = {}

    # Merge with previous; enforce intensity constraints; mirror twin_* keys
    new_dna: Dict[str, Any] = dict(previous_dna)
    tone_type = parsed.get("tone_type", new_dna.get("tone_type", "rival"))
    gap_behavior = parsed.get("gap_behavior", new_dna.get("gap_behavior", "steady"))
    prev_intensity = new_dna.get("intensity") or new_dna.get("twin_intensity")
    raw_intensity = parsed.get("intensity", prev_intensity or 3)
    intensity = _clamp_intensity(raw_intensity, prev_intensity)
    challenge_level = parsed.get("challenge_level", new_dna.get("challenge_level", "medium"))

    new_dna.update(
        {
            "tone_type": tone_type,
            "intensity": intensity,
            "gap_behavior": gap_behavior,
            "challenge_level": challenge_level,
        }
    )
    # Mirror for older code paths
    new_dna["twin_tone_type"] = tone_type
    new_dna["twin_intensity"] = intensity
    new_dna["twin_gap_behavior"] = gap_behavior

    new_dna["last_calibration_at"] = _utc_now_iso()
    new_dna["calibration_count"] = int(new_dna.get("calibration_count", 0)) + 1

    return new_dna

