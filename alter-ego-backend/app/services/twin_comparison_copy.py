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
) -> str:
    """
    Short rivalry line: you vs Twin totals, gap, today — never the home strip voice.
    """
    gs = (gap_state or "neck_and_neck").strip()
    xd = max(0, int(xp_difference or 0))
    us = max(0, int(user_streak or 0))
    ts = max(0, int(twin_streak or 0))
    streak_delta = us - ts

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

    pools: dict[str, list[str]] = {
        "user_ahead": [
            f"You lead on the lifetime ledger by {_fmt_xp(xd)} XP — Twin is still the version of you from a week ahead on behaviour, not on this total.",
            f"Total XP: you {_fmt_xp(user_xp)}, Twin {_fmt_xp(twin_xp)}. You're ahead; the strip is about today's pace — here we're looking at the long score.",
            f"Power Score {_fmt_xp(user_power_score)} vs {_fmt_xp(twin_power_score)} — you're in front. Streaks: {us}d to you vs {ts}d on Twin — the gap is the story, not the slogan.",
            f"Ahead by {_fmt_xp(xd)} XP. Twin's streak sits at {ts} while yours is {us} — when you're winning the ledger, the fight is holding the line day to day.",
        ],
        "neck_and_neck": [
            f"Neck and neck: {_fmt_xp(user_xp)} XP to {_fmt_xp(twin_xp)} — only {_fmt_xp(xd)} apart. Today {ud}/{ut} for you vs {td}/{tt} for Twin.",
            f"The ledger is essentially tied (Δ {_fmt_xp(xd)} XP). This week you've averaged {week_user:.0%} completion vs Twin's {week_twin:.0%} — tiny edges compound.",
            f"Matched on the long game. Streak {us} vs {ts}; Power {_fmt_xp(user_power_score)} vs {_fmt_xp(twin_power_score)}. One strong afternoon shifts the whole board.",
            f"Close enough that {_fmt_xp(xd)} XP is noise — what matters is whether you finish today's list before Twin's simulated run does.",
        ],
        "slightly_behind": [
            f"Twin leads by {_fmt_xp(xd)} XP overall — you're slightly behind on the total, not necessarily on today's discipline ({ud}/{ut} vs {td}/{tt}).",
            f"Slightly behind: {_fmt_xp(twin_xp)} to {_fmt_xp(user_xp)}. Streak gap {streak_delta:+d} days vs Twin — close the ledger with consistency, not one hero day.",
            f"The gap is {_fmt_xp(xd)} XP; Power Score {_fmt_xp(user_power_score)} vs {_fmt_xp(twin_power_score)}. Week pace: you {week_user:.0%} vs Twin {week_twin:.0%}"
            + (f" — edge to you on the week." if week_edge > 0.03 else "."),
            f"Behind by a slice — Twin {_fmt_xp(twin_xp)} XP. Your streak ({us}) vs Twin's ({ts}) still decides how fast that closes.",
        ],
        "significantly_behind": [
            f"Twin is ahead by {_fmt_xp(xd)} XP on the lifetime track — that's the rivalry gap; your job is to win today ({ud}/{ut}) and let the trend bend.",
            f"Large ledger gap: {_fmt_xp(twin_xp)} vs {_fmt_xp(user_xp)}. Streaks {ts} (Twin) vs {us} (you) — long climbs start with not skipping the small missions.",
            f"Significantly behind on total XP; Power {_fmt_xp(user_power_score)} vs {_fmt_xp(twin_power_score)}. Weekly completion you {week_user:.0%} vs Twin {week_twin:.0%} — shrink the week first.",
            f"The Twin isn't ahead on talk — they're ahead on {_fmt_xp(xd)} XP. Today's bar: {ud} of {ut} done; beat Twin's {td}/{tt} when it counts.",
        ],
    }

    key = gs if gs in pools else "neck_and_neck"
    lines = pools[key]
    i = _idx(user_id, today, f"cmp:{key}", len(lines))
    line = lines[i]
    # Light rotation on second visit same day: salt with hour would change too often; keep stable per day.
    if week_edge > 0.08 and gs in ("slightly_behind", "significantly_behind"):
        line += f" (Your last 7 days are stronger than Twin's on completion — {_fmt_xp(xd)} XP is old damage.)"
    return line


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
