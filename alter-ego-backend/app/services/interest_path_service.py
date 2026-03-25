"""
Interest Path UI — quest strip, criteria, insights (Profile → Interests).
"""

from __future__ import annotations

from typing import Any

PALETTE = [
    "#F59E0B",
    "#22C55E",
    "#8B5CF6",
    "#3B82F6",
    "#EC4899",
    "#14B8A6",
    "#EAB308",
]

LEVEL_TEXT_LABELS = {
    "still_figuring_it_out": "Beginner",
    "getting_the_hang_of_it": "Intermediate",
    "pretty_solid": "Advanced",
}

INTEREST_XP_THRESHOLDS = [0, 200, 600, 1400, 3000, 6000, 11000, 18000, 28000, 42000]

CRAFT_LEVEL_NAMES = [
    "Novice",
    "Explorer",
    "Dedicated",
    "Committed",
    "Serious",
    "Advanced",
    "Expert",
    "Master",
    "Virtuoso",
    "Legend",
]


def accent_hex(name: str | None) -> str:
    n = name or ""
    return PALETTE[sum(ord(c) for c in n) % len(PALETTE)]


def normalize_path_state(raw: dict | None) -> dict[str, Any]:
    base_crit = {"0": [False, False], "1": [False, False], "2": [False, False]}
    if not raw:
        return {"current": 0, "criteria": base_crit}
    cur = int(raw.get("current", 0))
    cur = max(0, min(2, cur))
    crit_in = raw.get("criteria") or {}
    merged: dict[str, list[bool]] = {}
    for k in ["0", "1", "2"]:
        arr = crit_in.get(k) or base_crit[k]
        if not isinstance(arr, list):
            arr = base_crit[k]
        vals = [bool(arr[0]) if len(arr) > 0 else False, bool(arr[1]) if len(arr) > 1 else False]
        merged[k] = vals
    return {"current": cur, "criteria": merged}


def craft_progress(interest_xp: int, interest_level: int) -> tuple[int, int, str]:
    level_idx = max(1, min(10, interest_level)) - 1
    high = (
        INTEREST_XP_THRESHOLDS[level_idx + 1]
        if level_idx < 9
        else INTEREST_XP_THRESHOLDS[-1] + 10_000
    )
    sp = max(0, int(interest_xp))
    name = CRAFT_LEVEL_NAMES[min(level_idx, len(CRAFT_LEVEL_NAMES) - 1)]
    return sp, high, name


def quest_templates(name: str, goal: str) -> list[dict[str, Any]]:
    g = (goal or "your goal")[:100]
    return [
        {
            "id": "0",
            "title": f"Show up for {name}",
            "description": f"Build a rhythm. Small sessions add up toward {g}.",
            "criteria": [
                f"Complete 3 practice sessions for {name}",
                "Log what you learned at least once",
            ],
            "estimated_total": 2,
            "estimated_days": 7,
        },
        {
            "id": "1",
            "title": "Go deeper",
            "description": f"Push beyond autopilot. Tie each session to {g}.",
            "criteria": [
                "One focused session (30+ minutes)",
                "Apply one improvement in the next session",
            ],
            "estimated_total": 2,
            "estimated_days": 10,
        },
        {
            "id": "2",
            "title": "Sharpen the edge",
            "description": f"Quality reps toward: {g}.",
            "criteria": [
                "Complete a challenge-level session",
                "Self-review: what moved the needle?",
            ],
            "estimated_total": 2,
            "estimated_days": 14,
        },
    ]


INSIGHT_DEFS: list[dict[str, Any]] = [
    {
        "id": "ins_first",
        "title": "Consistency beats heroics",
        "body": "Most growth comes from showing up at 60% rather than burning out at 110% once.",
        "milestone_key": "first_step",
    },
    {
        "id": "ins_10",
        "title": "Patterns emerge slowly",
        "body": "Ten sessions is where random effort starts to look like a practice.",
        "milestone_key": "sessions_10",
    },
    {
        "id": "ins_q0",
        "title": "Foundation laid",
        "body": "Finishing your first quest proves the path is walkable — not just imagined.",
        "after_quest": 0,
    },
    {
        "id": "ins_30",
        "title": "Depth requires patience",
        "body": "Thirty sessions is enough data to see what actually works for you.",
        "milestone_key": "sessions_30",
    },
    {
        "id": "ins_commit",
        "title": "Long horizons",
        "body": "Sixty sessions is a different relationship with the skill than day-one you had.",
        "milestone_key": "committed",
    },
]

QUEST_INSIGHT_COPY = [
    (
        "First stretch",
        "You proved you can return to this skill without needing perfect conditions.",
    ),
    (
        "Deliberate work",
        "Pushing past autopilot is where practice stops being a wish and becomes a habit.",
    ),
    (
        "Edge work",
        "Hard sessions count double when you know exactly what you were fixing.",
    ),
]


def _milestone_map(milestone_rows: list[dict]) -> dict[str, bool]:
    out: dict[str, bool] = {}
    for row in milestone_rows:
        k = row.get("key")
        if k:
            out[str(k)] = bool(row.get("earned"))
    return out


def _insight_unlocked(
    d: dict[str, Any],
    milestone_by_key: dict[str, bool],
    completed_quests: int,
) -> bool:
    mk = d.get("milestone_key")
    if mk:
        return bool(milestone_by_key.get(str(mk)))
    aq = d.get("after_quest")
    if aq is not None:
        return completed_quests > int(aq)
    return False


def build_ui_path(
    interest: dict[str, Any],
    milestone_rows: list[dict],
    path_state: dict | None,
) -> dict[str, Any]:
    name = interest.get("normalised_name") or "Interest"
    goal = interest.get("user_goal") or ""
    tier = interest.get("current_difficulty_tier") or "easy"
    if tier not in ("easy", "medium", "hard"):
        tier = "easy"
    active_days = interest.get("active_days") or [1, 2, 3, 4, 5, 6, 7]
    if not isinstance(active_days, list):
        active_days = [1, 2, 3, 4, 5, 6, 7]
    active_set = {int(d) for d in active_days if isinstance(d, (int, float))}

    st = normalize_path_state(path_state)
    current = st["current"]
    criteria = st["criteria"]
    templates = quest_templates(name, goal)
    milestone_by_key = _milestone_map(milestone_rows)

    quests_out: list[dict[str, Any]] = []
    for i, t in enumerate(templates):
        qid = t["id"]
        if i < current:
            status = "completed"
            crit_done = [True, True]
        elif i == current:
            status = "active"
            crit_done = criteria.get(qid, [False, False])
        else:
            status = "locked"
            crit_done = [False, False]
        quests_out.append(
            {
                "id": qid,
                "order": i,
                "title": t["title"],
                "description": t["description"],
                "success_criteria": t["criteria"],
                "criteria_done": crit_done,
                "status": status,
                "estimated_total": t["estimated_total"],
                "estimated_days_remaining": t["estimated_days"] if status == "active" else 0,
            }
        )

    completed_quests = current
    sp, next_th, craft_name = craft_progress(
        int(interest.get("interest_xp", 0) or 0),
        int(interest.get("interest_level", 1) or 1),
    )
    level_text = interest.get("level_text") or "still_figuring_it_out"
    exp_label = LEVEL_TEXT_LABELS.get(str(level_text), "Beginner")

    insights_out = []
    for d in INSIGHT_DEFS:
        unlocked = _insight_unlocked(d, milestone_by_key, completed_quests)
        insights_out.append(
            {
                "id": d["id"],
                "title": d["title"],
                "body": d["body"],
                "unlocked": unlocked,
            }
        )

    unlocked_insights = sum(1 for x in insights_out if x["unlocked"])

    return {
        "path_id": str(interest["id"]),
        "interest_name": name,
        "goal_text": goal,
        "color_hex": accent_hex(name),
        "experience_label": exp_label,
        "schedule_days": sorted(active_set),
        "difficulty": tier,
        "craft_sp": sp,
        "next_craft_threshold": next_th,
        "craft_level_name": craft_name,
        "quests": quests_out,
        "insights": insights_out,
        "completed_quests_count": completed_quests,
        "total_quests": len(templates),
        "insights_unlocked_count": unlocked_insights,
        "insights_total": len(insights_out),
    }


def schedule_abbrev(active_days: list[int]) -> str:
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    labels = [day_names[d - 1] for d in sorted(set(active_days)) if 1 <= int(d) <= 7]
    return " · ".join(labels) if labels else "—"


def difficulty_label(tier: str) -> str:
    return {"easy": "Easy", "medium": "Balanced", "hard": "Challenging"}.get(tier, tier.title())


def experience_from_level_choice(level: str) -> str:
    m = {
        "beginner": "still_figuring_it_out",
        "intermediate": "getting_the_hang_of_it",
        "advanced": "pretty_solid",
    }
    return m.get(level.lower(), "still_figuring_it_out")


def complete_quest_insight(just_finished_index: int, skill_name: str) -> dict[str, str]:
    if 0 <= just_finished_index < len(QUEST_INSIGHT_COPY):
        title, body = QUEST_INSIGHT_COPY[just_finished_index]
        return {"title": title, "body": body.replace("{name}", skill_name)}
    return {"title": "Quest complete", "body": "Keep the momentum."}
