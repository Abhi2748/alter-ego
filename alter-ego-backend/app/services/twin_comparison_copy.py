"""
Deterministic, varied copy for Twin Comparison (rivalry) and Rank Card (identity).
Not the home strip — those lines live in strip_message_service.
"""

from __future__ import annotations

import hashlib
from typing import Any

# ── Comparison verdict (Twin tab) ───────────────────────────────────────────


def _idx(user_id: str, today: str, salt: str, modulo: int) -> int:
    h = hashlib.sha256(f"{user_id}:{today}:{salt}".encode()).hexdigest()
    return int(h[:12], 16) % max(modulo, 1)


def build_comparison_line(
    user_id: str,
    today: str,
    *,
    gap_state: str,
    xp_difference: int,
    user_is_ahead: bool,
    user_streak: int,
    twin_streak: int,
    user_xp: int,
    twin_xp: int,
    user_power_score: int,
    twin_power_score: int,
    user_done_today: int,
    user_total_today: int,
    twin_done_today: int,
    twin_total_today: int,
    week_heatmap: list[dict[str, Any]] | None,
    days_user_ahead: int = 0,
) -> str:
    """
    1–3 sentence narrative about the rivalry gap — story-shaped, not a bare stat line.
    `days_user_ahead`: days since last crossing (user passed Twin); 0 if never / unknown.
    """
    try:
        gs = (gap_state or "neck_and_neck").strip()
        if gs not in ("user_ahead", "neck_and_neck", "slightly_behind", "significantly_behind"):
            gs = "neck_and_neck"

        xd = max(0, int(xp_difference or 0))
        us = max(0, int(user_streak or 0))
        ts = max(0, int(twin_streak or 0))
        streak_delta = us - ts
        days_since_cross = max(0, int(days_user_ahead or 0))

        uh = 0.0
        th = 0.0
        n = 0
        for d in week_heatmap or []:
            try:
                uh += float(d.get("user_completion_rate") or 0)
                th += float(d.get("twin_completion_rate") or 0)
                n += 1
            except (TypeError, ValueError):
                continue
        week_user = uh / n if n else 0.0
        week_twin = th / n if n else 0.0
        week_edge = week_user - week_twin

        ut = max(0, int(user_total_today or 0))
        ud = max(0, int(user_done_today or 0))
        tt = max(0, int(twin_total_today or 0))
        td = max(0, int(twin_done_today or 0))

        def _fmt_xp(x: int) -> str:
            return f"{max(0, int(x)):,}"

        both_finished_today = ut > 0 and tt > 0 and ud >= ut and td >= tt
        time_story = ""
        if both_finished_today and ud == ut and td == tt:
            time_story = " Both of you cleared the board today — the difference is who stacked discipline earlier in the week, not who quit last."

        # Narrative pools: distinct voice per gap state; inject temporal context when we have days_since_cross.
        lead_days = (
            f"You're in front for the first time in {days_since_cross} days. "
            if user_is_ahead and days_since_cross > 0
            else ""
        )
        behind_days = (
            f"It's been {days_since_cross} days since you last held the lead on the ledger. "
            if (not user_is_ahead) and days_since_cross > 0
            else ""
        )

        pools: dict[str, list[str]] = {
            "user_ahead": [
                lead_days
                + f"You're ahead on the lifetime score by {_fmt_xp(xd)} XP. Your Twin hasn't vanished — you simply out-ran their pace this season. "
                f"Streaks read {us} days on you versus {ts} on them; hold the line and the story stays yours.",
                f"The ledger favours you by {_fmt_xp(xd)} XP. That gap is earned — Power {_fmt_xp(user_power_score)} to {_fmt_xp(twin_power_score)}. "
                f"This week you've averaged {week_user:.0%} completion to Twin's {week_twin:.0%}; when the week leans your way, the headline writes itself.",
                f"For once the numbers agree with the feeling: you lead by {_fmt_xp(xd)} XP. Twin is still the older version of your discipline — "
                f"today you proved you're not borrowing their pace anymore. {us}-day streak versus {ts} on their side.",
                f"You're in front — {_fmt_xp(user_xp)} XP to {_fmt_xp(twin_xp)}. The rivalry isn't over; it's just waiting to see if you defend the lead tomorrow "
                f"the way you earned it today ({ud}/{ut} done).",
            ],
            "neck_and_neck": [
                f"The two of you are essentially tied — only {_fmt_xp(xd)} XP between {_fmt_xp(user_xp)} and {_fmt_xp(twin_xp)}. "
                f"Neck and neck means the next week of small choices decides who owns the story. Today: {ud}/{ut} for you, {td}/{tt} for Twin.",
                f"Close enough that the ledger could flip in an afternoon. Streak {us} vs {ts}; weekly completion you {week_user:.0%}, Twin {week_twin:.0%}. "
                f"Power sits at {_fmt_xp(user_power_score)} versus {_fmt_xp(twin_power_score)} — whoever strings three honest days first pulls ahead.",
                f"Matched on totals; the drama is pace. Δ {_fmt_xp(xd)} XP is noise until one of you breaks rhythm. "
                f"Twin finished {td}/{tt} today; you hit {ud}/{ut}. Small edges compound — that's the whole plot.",
                f"You're shadowboxing your own consistency. {_fmt_xp(xd)} XP apart; this week slightly favours "
                + ("you on completion." if week_edge > 0 else "Twin on completion.")
                + f" Either way, the next mission matters more than the last.",
            ],
            "slightly_behind": [
                behind_days
                + f"Twin sits {_fmt_xp(xd)} XP ahead on the long count — slightly behind, not buried. "
                f"Your streak ({us}) versus theirs ({ts}) is where the comeback starts; win today and the trend bends.",
                f"The ledger shows Twin ahead by {_fmt_xp(xd)} XP — a thin margin. "
                f"Week pace: you {week_user:.0%}, Twin {week_twin:.0%}. "
                + (
                    "You're actually winning the last seven days on completion — the gap is yesterday's damage."
                    if week_edge > 0.05
                    else "Shrink the week first; the headline follows."
                ),
                f"Slightly behind means the story is still open. {_fmt_xp(twin_xp)} XP to {_fmt_xp(user_xp)}; Power {_fmt_xp(user_power_score)} vs {_fmt_xp(twin_power_score)}. "
                f"Today's bar: {ud} of {ut} for you. Stack a few clean days and the margin stops feeling personal.",
                f"Twin leads by {_fmt_xp(xd)} XP — enough to notice, not enough to quit. "
                f"They logged {td}/{tt} today; you {ud}/{ut}. The rivalry rewards whoever shows up again tomorrow.",
            ],
            "significantly_behind": [
                behind_days
                + f"Twin is meaningfully ahead — {_fmt_xp(xd)} XP on the lifetime track. That's the size of the hole; "
                f"climbing out starts with not skipping the small missions. Streaks: {ts} (Twin) vs {us} (you).",
                f"The gap is wide: {_fmt_xp(twin_xp)} XP to {_fmt_xp(user_xp)}. This isn't a single bad day — it's a slope. "
                f"Week completion you {week_user:.0%} versus Twin {week_twin:.0%}. Win the week before you chase the headline.",
                f"Significantly behind on the ledger; Power {_fmt_xp(user_power_score)} to {_fmt_xp(twin_power_score)}. "
                f"The Twin didn't cheat — they stacked more consistent days. Your job: one honest week, then another.",
                f"{_fmt_xp(xd)} XP between you and parity. Twin finished {td}/{tt} today; you're at {ud}/{ut}. "
                f"Long climbs start where you're standing — prove tomorrow belongs to you.",
            ],
        }

        lines = pools[gs]
        i = _idx(user_id, today, f"cmp:{gs}", len(lines))
        line = lines[i]

        if time_story and gs in ("neck_and_neck", "user_ahead", "slightly_behind"):
            line = line.rstrip() + time_story

        if week_edge > 0.08 and gs in ("slightly_behind", "significantly_behind"):
            line += (
                f" (Your last seven days are stronger than Twin's on completion — {_fmt_xp(xd)} XP is older damage catching up in the headline.)"
            )

        result = (line or "").strip()
        return result or "Still here. Still watching."
    except Exception:
        return "Still here. Still watching."


def build_rank_card_oracle(
    user_id: str,
    today: str,
    *,
    username: str,
    archetype: str | None,
    character_stage_name: str,
    streak: int,
    power_score: int,
    total_xp: int,
) -> str:
    """
    Identity-forward one-liner for the Rank Card — not strip / not rivalry play-by-play.
    """
    name = (username or "you").strip() or "you"
    stage = (character_stage_name or "The Awakened").strip()
    ar = (archetype or "").strip()
    al = ar.lower()

    def _family() -> str:
        if "restless" in al:
            return "restless"
        if "reluctant" in al:
            return "reluctant"
        if "structured" in al or "climber" in al:
            return "climber"
        if "lone" in al or "wolf" in al:
            return "wolf"
        if "social" in al or "performer" in al:
            return "performer"
        return "default"

    fam = _family()

    pools: dict[str, list[str]] = {
        "restless": [
            f"{name} — {stage}. You run on novelty and bursts; the app is tracking whether you still show up when the spark thins.",
            f"Archetype: restless creator. {streak}-day streak, Power {power_score:,} — discipline here means returning after the exciting days.",
            f"{stage}, built for iteration. Total XP {total_xp:,} — your rank card is about identity, not today's strip line.",
        ],
        "reluctant": [
            f"{name} — {stage}. You feel the gap between knowing and starting; the work is smaller steps, repeated.",
            f"Reluctant achiever energy: {streak} days showing up anyway. Power {power_score:,} — pride in motion, not perfection.",
            f"{stage}. Archetype leans perfectionism — your streak is proof you're choosing done over flawless.",
        ],
        "climber": [
            f"{name} — {stage}. You like plans and targets; Power {power_score:,} rewards the weeks you don't break the chain ({streak} days).",
            f"Structured climber: {stage}. {total_xp:,} XP logged — the card is who you're becoming across months, not one quote.",
            f"{streak}-day streak · {stage}. You respond to challenge; this line is your overall arc, not a taunt from the strip.",
        ],
        "wolf": [
            f"{name} — {stage}. Self-directed, allergic to noise — {power_score:,} Power Score is your private scoreboard.",
            f"Lone wolf path: {streak} days without needing applause. {stage}; {total_xp:,} XP and counting.",
            f"{stage}. You work alone; this oracle is the long view — streak {streak}, total XP {total_xp:,}.",
        ],
        "performer": [
            f"{name} — {stage}. Visibility fuels you — {streak} streak days turn audience energy into private proof (Power {power_score:,}).",
            f"Social performer arc: {stage}. Rank is a mirror; {total_xp:,} XP is the substance behind the image.",
            f"{stage}. You care what the data says — Power {power_score:,}, {streak} days — this line is yours, not the Twin's.",
        ],
        "default": [
            f"{name} — {stage}. {streak}-day streak, Power {power_score:,}, {total_xp:,} XP — one line for who you're building, not what Twin whispered today.",
            f"{stage}. Streak {streak}, Power {power_score:,}. The rank card holds your overall story; the strip handles the daily needle.",
            f"Identity: {stage}. Total XP {total_xp:,} — this oracle is about you in the round, not the home-screen rivalry ping.",
        ],
    }

    lines = pools.get(fam, pools["default"])
    i = _idx(user_id, today, f"rank:{fam}", len(lines))
    return lines[i]
