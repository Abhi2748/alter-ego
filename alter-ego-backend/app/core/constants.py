"""
ALTER EGO — Central Constants
All locked product values live here.
Every backend module imports from this file.
Never hardcode these values elsewhere.
"""

# ── CHARACTER PROGRESSION ─────────────────────────────────────────────────

# XP required to REACH each stage (index = stage number, 0-indexed internally)
# Stage 1 starts at 0 XP. Stage 2 requires 800 total XP. Etc.
XP_THRESHOLDS = [0, 800, 9_800, 36_800, 108_800, 375_200]

STAGE_NAMES = [
    "The Awakened",    # Stage 1: 0 – 799 XP
    "The Focused",     # Stage 2: 800 – 4,999 XP
    "The Burning",     # Stage 3: 5,000 – 19,999 XP
    "The Relentless",  # Stage 4: 20,000 – 59,999 XP
    "The Formidable",  # Stage 5: 60,000 – 199,999 XP
    "The Sovereign",   # Stage 6: 200,000+ XP
]

TOTAL_CHARACTER_STAGES = 6

# ── PET / COMPANION PROGRESSION ──────────────────────────────────────────

# Pet Food required to REACH each pet stage
# Stage 1 (Cub) unlocks automatically on Day 6 — no PF required
PF_THRESHOLDS = [0, 400, 2_800, 10_000, 26_800, 62_000, 113_200, 242_800]

PET_NAMES = [
    "Cub",          # Stage 1: auto-unlock Day 6
    "Cat",          # Stage 2: 400 PF
    "Fox",          # Stage 3: 2,000 PF
    "Wolf",         # Stage 4: 7,000 PF
    "Snow Leopard", # Stage 5: 18,000 PF
    "Panther",      # Stage 6: 40,000 PF
    "Griffin",      # Stage 7: 80,000 PF
    "Dragon",       # Stage 8: 150,000 PF — legendary
]

TOTAL_PET_STAGES = 8
PET_UNLOCK_DAY = 6  # Pet unlocks on day 6 of registration (not day 7)

# ── DAILY CAPS (per character stage) ────────────────────────────────────

# Both caps increase as character progresses
# Key = character stage (1-6), Value = daily cap amount
DAILY_XP_CAPS = {
    1: 100,
    2: 150,
    3: 200,
    4: 280,
    5: 380,
    6: 500,
}

DAILY_PF_CAPS = {
    1: 160,
    2: 240,
    3: 360,
    4: 480,
    5: 640,
    6: 800,
}

# ── XP VALUES PER MISSION (CLAUDE §9) ─────────────────────────────────────

# System-generated missions only — by type + difficulty. Single source of truth.
# Core: 15 / 25 / 40 (+ elite). Interest & quit-target (resistance): 10 / 20 / 30 (+ elite).
# Personal missions use PERSONAL_MISSION_XP_BY_TIER below (not this table).
MISSION_XP_BY_TYPE = {
    "core": {
        "easy": 15,
        "medium": 25,
        "hard": 40,
        "elite": 60,
    },
    "interest": {
        "easy": 10,
        "medium": 20,
        "hard": 30,
        "elite": 40,
    },
    # Quit-target / Escaper missions — same XP curve as interest (spec §9)
    "resistance": {
        "easy": 10,
        "medium": 20,
        "hard": 30,
        "elite": 40,
    },
}


def mission_xp_for_type(mission_type: str, difficulty: str) -> int:
    """XP for planner-generated and synced missions. Unknown type → interest curve."""
    mt = mission_type if mission_type in MISSION_XP_BY_TYPE else "interest"
    table = MISSION_XP_BY_TYPE[mt]
    d = str(difficulty or "easy").lower()
    return table.get(d, table["easy"])

# Power Score multipliers by mission type
POWER_SCORE_MULTIPLIERS = {
    "core":       1.2,
    "interest":   1.0,
    "resistance": 1.0,
    "personal":   0.8,
    "recovery":   1.0,
}

# PF values per mission type and difficulty
MISSION_PF = {
    "core": {
        "easy":   12,
        "medium": 20,
        "hard":   32,
        "elite":  48,
    },
    "interest": {
        "easy":   8,
        "medium": 16,
        "hard":   24,
        "elite":  36,
    },
    "resistance": {
        "easy":   8,
        "medium": 16,
        "hard":   24,
        "elite":  36,
    },
    "personal": {
        "easy":   6,
        "medium": 11,
        "hard":   17,
        "elite":  26,
    },
    "recovery": {
        "easy":   8,
        "medium": 14,
        "hard":   20,
        "elite":  30,
    },
}

# Personal mission XP multiplier (0.8x to prevent gaming)
PERSONAL_XP_MULTIPLIER = 0.8

# Personal missions — exact XP per tier (spec §9; PF from MISSION_PF["personal"])
PERSONAL_MISSION_XP_BY_TIER = {
    "easy": 8,
    "medium": 15,
    "hard": 22,
}

# Multi-day mission XP
MULTIDAY_XP_PER_DAY = 10        # Per sub-task day (Interest type rate)
MULTIDAY_COMPLETION_BONUS = 30  # Bonus on final day completion
MULTIDAY_PERSONAL_PER_DAY = 8
MULTIDAY_PERSONAL_BONUS = 24

# ── STREAK SYSTEM ────────────────────────────────────────────────────────

# Streak requirement tiers — what the user must complete each day
# to maintain their streak. Gets harder as they progress.
#
# tier_1: Days 1 to character Stage 2 (under 800 XP)
#         → any 2 core missions OR 1 interest mission
#
# tier_2: Character Stage 2 reached (800+ XP)
#         → 4 core missions + 1 interest mission
#
# tier_3: 30-day streak hit for first time
#         → all 5 core missions (journal not counted for streak)
#
# tier_4: 60-day streak hit for first time
#         → all 5 core missions + 1 interest + 1 personal

STREAK_TIER_REQUIREMENTS = {
    "tier_1": {
        "description": "2 core OR 1 interest OR 3+ core+interest (no resistance requirement)",
        "core_minimum": 2,
        "interest_minimum": 0,
        "personal_minimum": 0,
        "core_or_interest": True,  # 2 core OR 1 interest satisfies
    },
    "tier_2": {
        "description": "4 core missions + 1 interest mission",
        "core_minimum": 4,
        "interest_minimum": 1,
        "personal_minimum": 0,
        "core_or_interest": False,
    },
    "tier_3": {
        "description": "All 5 core missions",
        "core_minimum": 5,  # All 5 non-journal core missions
        "interest_minimum": 0,
        "personal_minimum": 0,
        "core_or_interest": False,
    },
    "tier_4": {
        "description": "All 5 core missions + 1 interest + 1 personal",
        "core_minimum": 5,
        "interest_minimum": 1,
        "personal_minimum": 1,
        "core_or_interest": False,
    },
}

# Triggers for tier upgrades
STREAK_TIER_UPGRADE_TRIGGERS = {
    "tier_1_to_2": {"trigger": "character_stage", "value": 2},
    "tier_2_to_3": {"trigger": "streak_days",     "value": 30},
    "tier_3_to_4": {"trigger": "streak_days",     "value": 60},
}

# Milestone streak days (used for nudges, streak animation tiers, bonus events)
STREAK_MILESTONES = [3, 7, 10, 14, 21, 30, 60, 100, 180, 200, 365]

# Regression rules when streak breaks
STREAK_FREEZE_DAYS = 29       # Days 1-29 of absence: XP frozen, full recovery possible
# Day 30+: dynamic penalty applied (calculated in streak service)

# ── FREE TRIAL + SUBSCRIPTION ────────────────────────────────────────────

FREE_TRIAL_DAYS = 7
LEADERBOARD_UNLOCK_STREAK = 3  # First time user hits a 3-day streak

# ── ARCHETYPE DEFINITIONS ────────────────────────────────────────────────

ARCHETYPES = {
    "restless_creator": {
        "name": "The Restless Creator",
        "tagline": "You have more ideas than hours. Discipline is how you build them.",
        "reveal_message": "You don't lack motivation — you lack a system to contain it.",
        "twin_intensity": 3,
        "twin_tone_type": "philosopher",
        "twin_gap_behavior": "rubber_band",
        "twin_message_frequency": "medium",
    },
    "reluctant_achiever": {
        "name": "The Reluctant Achiever",
        "tagline": "You know what you're capable of. Starting is the only problem.",
        "reveal_message": "The gap between who you are and who you could be is smaller than you think.",
        "twin_intensity": 2,
        "twin_tone_type": "philosopher",
        "twin_gap_behavior": "rubber_band",
        "twin_message_frequency": "medium",
    },
    "structured_climber": {
        "name": "The Structured Climber",
        "tagline": "You love plans and respond to challenge.",
        "reveal_message": "You already know how to build systems. Now build the habit of using them daily.",
        "twin_intensity": 4,
        "twin_tone_type": "rival",
        "twin_gap_behavior": "chase",
        "twin_message_frequency": "high",
    },
    "lone_wolf": {
        "name": "The Lone Wolf",
        "tagline": "You work best alone. External pressure means nothing to you.",
        "reveal_message": "The only standard that matters is the one you set for yourself.",
        "twin_intensity": 3,
        "twin_tone_type": "silent_force",
        "twin_gap_behavior": "steady",
        "twin_message_frequency": "low",
    },
    "social_performer": {
        "name": "The Social Performer",
        "tagline": "You rise when others are watching. Now learn to rise when they're not.",
        "reveal_message": "The version of you that shows up publicly — make them show up privately too.",
        "twin_intensity": 4,
        "twin_tone_type": "rival",
        "twin_gap_behavior": "chase",
        "twin_message_frequency": "high",
    },
}

# ── Q14 COMMITMENT HORIZON (onboarding) ─────────────────────────────────

COMMITMENT_HORIZON_OPTIONS = {
    "2_weeks": "2 weeks",
    "1_month": "1 month",
    "3_months": "3 months",
    "however_long": "However long it takes",
}

COMMITMENT_HORIZON_CONTEXT = {
    "2_weeks": {
        "nudge_intensity": "high",
        "report_framing": "sprint",
        "twin_message": "You said 2 weeks. The clock is running.",
    },
    "1_month": {
        "nudge_intensity": "medium",
        "report_framing": "month",
        "twin_message": "One month. That's enough time to know.",
    },
    "3_months": {
        "nudge_intensity": "medium",
        "report_framing": "quarter",
        "twin_message": "Three months. Consistent effort compounds.",
    },
    "however_long": {
        "nudge_intensity": "low",
        "report_framing": "journey",
        "twin_message": "No deadline. Just showing up.",
    },
}

# Twin first line at archetype reveal (Twin intro) — CLAUDE §13
ARCHETYPE_TWIN_INTRO_LINE = {
    "restless_creator": "You finally showed up. I've been here. Let's see if you stay.",
    "reluctant_achiever": "You know what to do. You just keep waiting for the right moment. I don't wait.",
    "structured_climber": "Good. I'm ahead. You can close the gap — if you actually do the work.",
    "lone_wolf": "You work alone. So do I.",
    "social_performer": "You care what they think. I only care what the data says.",
}

# ── CORE MISSIONS ────────────────────────────────────────────────────────

# All 6 core missions — shown every day to every user
# 5 pillars + journal. All 6 required (per product decision).
# Journal mission auto-completes when a saved entry meets journal_rules (≈2 lines + 5 words; wrap counts).

CORE_MISSIONS = [
    {
        "key": "sleep",
        "title": "Get 7+ hours of sleep",
        "difficulty": "easy",
        "pillar": "sleep",
        "xp": MISSION_XP_BY_TYPE["core"]["easy"],
        "pf": MISSION_PF["core"]["easy"],
        "estimated_minutes": 0,  # Passive — happens overnight
        "rationale": (
            "Sleep is the single highest-leverage health intervention available. "
            "Every cognitive system — memory consolidation, emotional regulation, "
            "decision-making — degrades measurably with under 7 hours. "
            "This is the non-negotiable foundation of every other mission."
        ),
    },
    {
        "key": "movement",
        "title": "Move for 30 minutes",
        "difficulty": "medium",
        "pillar": "movement",
        "xp": MISSION_XP_BY_TYPE["core"]["medium"],
        "pf": MISSION_PF["core"]["medium"],
        "estimated_minutes": 30,
        "rationale": (
            "30 minutes of daily movement improves mood, cognition, and sustained "
            "energy more reliably than any other single intervention. "
            "Research consistently shows it as effective as medication for mild-moderate "
            "depression and significantly improves executive function within 20 minutes."
        ),
    },
    {
        "key": "hydration",
        "title": "Drink 2 litres of water",
        "difficulty": "easy",
        "pillar": "hydration",
        "xp": MISSION_XP_BY_TYPE["core"]["easy"],
        "pf": MISSION_PF["core"]["easy"],
        "estimated_minutes": 0,  # Distributed throughout day
        "rationale": (
            "Dehydration of just 1-2% impairs cognitive performance, reaction time, "
            "and mood. Most people are chronically mildly dehydrated. "
            "Adequate hydration is the most consistently overlooked performance lever."
        ),
    },
    {
        "key": "mindfulness",
        "title": "10 minutes of stillness — no phone, no screen",
        "difficulty": "easy",
        "pillar": "mindfulness",
        "xp": MISSION_XP_BY_TYPE["core"]["easy"],
        "pf": MISSION_PF["core"]["easy"],
        "estimated_minutes": 10,
        "rationale": (
            "Intentional stillness trains the prefrontal cortex's capacity to override "
            "impulse — the core skill behind every habit change. "
            "10 minutes is the minimum effective dose shown in neuroscience research "
            "to produce measurable changes in attention and impulse control within 8 weeks."
        ),
    },
    {
        "key": "no_phone",
        "title": "No phone for the first 30 minutes after waking",
        "difficulty": "medium",
        "pillar": "no_phone",
        "xp": MISSION_XP_BY_TYPE["core"]["medium"],
        "pf": MISSION_PF["core"]["medium"],
        "estimated_minutes": 30,
        "rationale": (
            "The first 30 minutes post-waking set the neurological tone for the day. "
            "Cortisol peaks naturally at waking to provide alertness. "
            "Immediate phone use hijacks this window into reactive mode — "
            "responding to others' agendas instead of your own intentions. "
            "Protecting this window is one of the highest-leverage morning habits in "
            "behavioural science literature."
        ),
    },
    {
        "key": "journal",
        "title": "Write in your journal today",
        "difficulty": "easy",
        "pillar": "journal",
        "xp": MISSION_XP_BY_TYPE["core"]["easy"],
        "pf": MISSION_PF["core"]["easy"],
        "estimated_minutes": 10,
        "is_journal_mission": True,
        "min_words": 50,
        "rationale": (
            "Daily writing externalises thought, builds metacognitive awareness, "
            "and creates a permanent record of growth. "
            "50 words is enough to be real without being burdensome — "
            "the goal is the habit of reflection, not the length of the entry."
        ),
    },
]

# ── INTEREST LEVEL MAPPING ───────────────────────────────────────────────

# Maps what the user says in onboarding to starting difficulty tier and time budget
INTEREST_LEVEL_MAP = {
    "still_figuring_it_out": {
        "starting_tier": "easy",
        "max_minutes": 20,
        "phase": "days_1_10",
        "description": "True beginner. Build confidence before skill.",
    },
    "getting_the_hang_of_it": {
        "starting_tier": "medium",
        "max_minutes": 40,
        "phase": "days_1_10",
        "description": "Some experience. Needs consistency more than instruction.",
    },
    "pretty_solid": {
        "starting_tier": "hard",
        "max_minutes": 60,
        "phase": "days_1_10",
        "description": "Established practitioner. Needs to be pushed.",
    },
}

# Interest progression phases (tracked per interest, not per user day count)
INTEREST_PHASES = [
    "days_1_10",    # Show up only. Presence is the mission.
    "days_11_30",   # Output. Produce something specific.
    "days_31_60",   # Quality. Do it better. Refinement.
    "days_61_90",   # Challenge. Push the edge of current capability.
    "days_90_plus", # Performance. Multi-day. Public commitment.
]

# ── DIFFICULTY ADAPTATION SIGNALS ───────────────────────────────────────

# Signals that trigger automatic difficulty changes
DIFFICULTY_UPGRADE_SIGNALS = {
    "streak_100pct_days": 5,        # 100% completion 5 days in a row → prompt upgrade
    "completion_rate_threshold": 80, # 80%+ over 10 days → auto upgrade one tier
    "speed_signal_days": 3,          # All missions done before noon 3 consecutive days
    "low_completion_days": 5,        # Under 50% for 5 days → drop one tier
    "rating_upgrade_threshold": 4.2, # Avg rating > 4.2 over last 5 ratings → upgrade
    "rating_downgrade_threshold": 2.5, # Avg rating < 2.5 → downgrade
}

# ── TWIN SYSTEM ──────────────────────────────────────────────────────────

# Starting consistency ceiling (what % of missions twin completes daily)
TWIN_INITIAL_CONSISTENCY = 0.85

# Ceiling bounds — twin never goes below floor or above ceiling
TWIN_CEILING_FLOOR = 0.65
TWIN_CEILING_MAX = 0.95

# Gap thresholds for gap_state classification
# Measured as (twin_xp - user_xp) / user_xp
GAP_THRESHOLDS = {
    "neck_and_neck":       0.08,   # Within 8% → neck and neck
    "slightly_behind":     0.35,   # 8-35% behind → slightly behind
    "significantly_behind": 0.35,  # > 35% behind → significantly behind
    # user_ahead: user_xp > twin_xp
}

# Gap behavior adjustment rates (per day)
GAP_ADJUSTMENTS = {
    "rubber_band": {
        "slow_down_rate": 0.04,   # Reduce ceiling by 4% per day when gap > 40%
        "speed_up_rate": 0.02,    # Increase ceiling by 2% per day when gap < 8%
        "large_gap_threshold": 0.40,
        "small_gap_threshold": 0.08,
    },
    "chase": {
        "slow_down_rate": 0.02,
        "demotivating_gap_threshold": 0.60,
    },
    "steady": {
        "target_gap_high": 0.25,  # If gap > 25%: slow down
        "target_gap_low": 0.12,   # If gap < 12%: speed up
        "adjust_rate": 0.03,
    },
}

# Ceiling recovery after user passes twin
TWIN_CEILING_RECOVERY_TARGET = 0.88
TWIN_CEILING_RECOVERY_DAYS = 3

# Twin recalibration schedule (scheduler: first run when days_since_registration >= this, then recurring)
FIRST_RECALIBRATION_DAY = 7
RECALIBRATION_INTERVAL_DAYS = 7
TWIN_FIRST_CALIBRATION_DAY = FIRST_RECALIBRATION_DAY
TWIN_RECALIBRATION_INTERVAL_DAYS = RECALIBRATION_INTERVAL_DAYS

# ── TWIN PULSE STATUS LINES ─────────────────────────────────────────────────
# Selected by time-of-day window + whether user has opened app today.
# Keyed as (hour_start, hour_end, user_active: bool) → list of strings
# One string is selected randomly from the list each call.

TWIN_STATUS_LINES: dict[tuple[int, int, bool], list[str]] = {
    # 5am–8am
    (5, 8, False): ["Woke up. Already moving.", "Started before you opened your eyes."],
    (5, 8, True): ["Warming up alongside you.", "Early start. Good."],
    # 8am–12pm
    (8, 12, False): ["2 missions deep. No breaks.", "Working through your list while you wait."],
    (8, 12, True): ["Matching your pace. For now.", "Still here. Still moving."],
    # 12pm–3pm
    (12, 15, False): ["Halfway through. Didn't slow down.", "You paused. I kept going."],
    (12, 15, True): ["We're close today.", "Afternoon. Still counting."],
    # 3pm–6pm
    (15, 18, False): ["Finishing what you started.", "The gap grows quietly."],
    (15, 18, True): ["Close. Not close enough.", "You're still in this."],
    # 6pm–9pm
    (18, 21, False): ["Reviewing. Planning tomorrow.", "Done. Whenever you're ready."],
    (18, 21, True): ["Good day. Don't get comfortable.", "Evening. Almost done."],
    # 9pm–midnight
    (21, 24, False): ["Done. Waiting for you to check.", "I finished. Have you?"],
    (21, 24, True): ["Check in before midnight. Or don't.", "Last chance today."],
    # midnight–5am (rare)
    (0, 5, False): ["Still here.", "The day already started."],
    (0, 5, True): ["Late night. I noticed.", "Still counting."],
}


def get_twin_status_line(user_local_hour: int, user_active_today: bool) -> str:
    """
    Select a status line based on local hour and whether user has
    opened app / completed any missions today.
    Falls back to a neutral string if no match found.
    """
    import random

    for (h_start, h_end, active), lines in TWIN_STATUS_LINES.items():
        if h_start <= user_local_hour < h_end and active == user_active_today:
            return random.choice(lines)
    return "Still here."


# ── MISSION COMPLETION MICRO-COPY ────────────────────────────────────────────
# Selected by context. One string per completion. Never AI-generated.
# Keys checked in priority order in get_completion_copy().

COMPLETION_COPY = {
    "user_takes_lead": [
        "You just took the lead.",
        "Ahead. Enjoy it.",
    ],
    "surge_activated": [
        "Surge activated. Everything counts more now.",
        "Cap hit. Aether starts here.",
    ],
    "all_complete": [
        "All missions complete. Perfect day.",
        "Done. Your Twin noticed.",
        "Full day. Nothing left on the table.",
    ],
    "twin_already_done": [
        "Matched.",
        "Your Twin had this one hours ago. You caught up.",
    ],
    "user_beat_twin": [
        "You got there first.",
        "Ahead of your shadow on this one.",
    ],
    "stage_evolved": [
        "You evolved. Your Twin already knew you would.",
        "New stage. The gap just got more interesting.",
    ],
    "streak_milestone": [
        "Milestone. Your Twin has the same number.",
        "Streak milestone. Keep going.",
    ],
    "standard": [
        "Done.",
        "Logged.",
        "One closer.",
        "Counted.",
    ],
}


def get_completion_copy(
    user_takes_lead: bool = False,
    surge_activated: bool = False,
    all_complete: bool = False,
    twin_already_done: bool | None = None,
    stage_evolved: bool = False,
    streak_milestone: bool = False,
) -> str:
    """
    Select completion micro-copy in priority order.
    Returns a single string. Never fails — always returns something.
    """
    import random

    if stage_evolved:
        return random.choice(COMPLETION_COPY["stage_evolved"])
    if surge_activated:
        return random.choice(COMPLETION_COPY["surge_activated"])
    if all_complete:
        return random.choice(COMPLETION_COPY["all_complete"])
    if user_takes_lead:
        return random.choice(COMPLETION_COPY["user_takes_lead"])
    if streak_milestone:
        return random.choice(COMPLETION_COPY["streak_milestone"])
    if twin_already_done is True:
        return random.choice(COMPLETION_COPY["twin_already_done"])
    if twin_already_done is False:
        return random.choice(COMPLETION_COPY["user_beat_twin"])
    return random.choice(COMPLETION_COPY["standard"])


# Profiler agent (J1) — recurring discipline_dna refresh when implemented; same cadence as Twin
PROFILER_RECUR_INTERVAL_DAYS = 7

# ── POWER SCORE FORMULA ──────────────────────────────────────────────────

# Weights must sum to 1.0
POWER_SCORE_WEIGHTS = {
    "xp_stage_progress": 0.35,  # How far through current character stage
    "pet_stage":         0.20,  # Current pet stage (1-8)
    "streak":            0.25,  # Current streak (capped at 100 days = max)
    "completion_rate":   0.20,  # 30-day mission completion rate
}

POWER_SCORE_STREAK_CAP = 100   # Streak contribution maxes out at 100 days
POWER_SCORE_MAX = 1_000        # Score is 0-1000

# ── MULTI-DAY MISSIONS ──────────────────────────────────────────────────

MULTIDAY_MIN_DAYS = 2
MULTIDAY_MAX_DAYS = 7
MULTIDAY_UNLOCK_DAY = 31           # Unlocks after day 31 of app use
MULTIDAY_UNLOCK_COMPLETION_RATE = 60  # Must have 60%+ completion in first 30 days
MULTIDAY_MAX_ACTIVE = 1            # Only 1 active multi-day mission at a time
MULTIDAY_MISS_EXTENSIONS = 1      # Can extend by 1 day on first miss

# ── APP SETTINGS ─────────────────────────────────────────────────────────

# Streak animation milestone days (triggers special tier animation)
STREAK_ANIMATION_MILESTONES = [30, 60, 100, 200, 365]

# Weekly report generation time (UTC hour)
WEEKLY_REPORT_CRON_HOUR_UTC = 3   # 3am UTC every Sunday

# Day summary generation time (UTC hour)
DAY_SUMMARY_CRON_HOUR_UTC = 1     # 1am UTC daily

# Nudge hard rules
NUDGE_LATEST_HOUR_LOCAL = 22      # Never send nudges after 10pm local time
NUDGE_EARLIEST_HOUR_LOCAL = 7     # Never send nudges before 7am local time

# Maximum nudges per day by frequency setting
NUDGE_DAILY_CAPS = {
    "low":    1,
    "medium": 2,
    "high":   3,
}

# Interest milestone session counts
INTEREST_MILESTONE_SESSIONS = {
    "first_step":    1,
    "sessions_10":   10,
    "sessions_30":   30,
    "committed":     60,
    "sessions_100":  100,
    "sessions_200":  200,
    "sessions_365":  365,
}

# ── STAT SYSTEM ─────────────────────────────────────────────────────────

STAT_LEVEL_THRESHOLDS = [
    0,
    150,
    450,
    1_000,
    2_200,
    4_500,
    8_500,
    15_000,
    25_000,
    40_000,
]

STAT_LEVEL_NAMES = [
    "Dormant",
    "Stirring",
    "Forming",
    "Grounded",
    "Rising",
    "Forged",
    "Honed",
    "Sovereign",
    "Transcendent",
    "Eternal",
]

STAT_SP_BY_DIFFICULTY = {
    "easy": {"primary": 8, "discipline": 3},
    "medium": {"primary": 16, "discipline": 5},
    "hard": {"primary": 32, "discipline": 9},
}

STAT_DAILY_CAPS = {
    "vitality": 80,
    "focus": 80,
    "craft": 50,
    "discipline": 40,
    "willpower": 80,
}

WILLPOWER_BONUS = {
    4: 20,
    6: 45,
    "all": 80,
}

PILLAR_TO_STAT = {
    "sleep": "vitality",
    "movement": "vitality",
    "hydration": "vitality",
    "mindfulness": "focus",
    "no_phone": "focus",
    "journal": "focus",
}

MISSION_TYPE_TO_STAT = {
    "interest": "craft",
    "personal": "willpower",
    "resistance": "discipline",
    "recovery": "discipline",
    "core": "discipline",
}


def resolve_stat_tag(core_pillar: str | None, mission_type: str) -> str:
    """Pillar wins when set on core missions; otherwise map by mission type."""
    p = (core_pillar or "").strip().lower().replace("-", "_")
    if p in PILLAR_TO_STAT:
        return PILLAR_TO_STAT[p]
    mt = (mission_type or "core").lower()
    return MISSION_TYPE_TO_STAT.get(mt, "discipline")


# ── SIGIL / AETHER SYSTEM ────────────────────────────────────────────────────
# Daily XP caps for surge detection: use DAILY_XP_CAPS (character stage) above.

SIGIL_LEVEL_THRESHOLDS = [0, 300, 900, 2100, 4500, 9000, 16500, 28000, 45000, 70000]

SIGIL_LEVEL_NAMES = [
    "The Ember",
    "The Fracture",
    "The Current",
    "The Vortex",
    "The Convergence",
    "The Resonance",
    "The Dominion",
    "The Ascendancy",
    "The Absolute",
    "The Eternal Flame",
]

AETHER_PER_MISSION = {"easy": 15, "medium": 30, "hard": 60}
AETHER_ALL_COMPLETE_BONUS = 50


def get_sigil_level(total_aether: int) -> int:
    level = 1
    for i, threshold in enumerate(SIGIL_LEVEL_THRESHOLDS):
        if total_aether >= threshold:
            level = i + 1
        else:
            break
    return min(level, 10)


def get_sigil_progress(total_aether: int) -> dict:
    level = get_sigil_level(total_aether)
    name = SIGIL_LEVEL_NAMES[level - 1]
    if level >= 10:
        return {
            "level": 10,
            "name": "The Eternal Flame",
            "aether_total": total_aether,
            "aether_in_level": total_aether - SIGIL_LEVEL_THRESHOLDS[9],
            "aether_for_next": 0,
            "aether_needed": 0,
            "progress_percent": 100.0,
        }
    curr = SIGIL_LEVEL_THRESHOLDS[level - 1]
    nxt = SIGIL_LEVEL_THRESHOLDS[level]
    aether_in = total_aether - curr
    rng = nxt - curr
    return {
        "level": level,
        "name": name,
        "aether_total": total_aether,
        "aether_in_level": aether_in,
        "aether_for_next": nxt,
        "aether_needed": rng - aether_in,
        "progress_percent": min(round((aether_in / rng) * 100, 1), 99.9),
    }


# ── ABSENCE ESCALATION COPY (B3) — no LLM ───────────────────────────────────

ABSENCE_DAY1_MESSAGES: dict[str, str] = {
    "lone_wolf": (
        "Didn't hear from you yesterday. I worked anyway. That's the difference."
    ),
    "restless_creator": (
        "You had ideas yesterday. I finished things. One of us made progress."
    ),
    "reluctant_achiever": "You disappeared. I noticed. I always notice.",
    "structured_climber": (
        "One missed day. I've already adjusted tomorrow's targets upward to compensate."
    ),
    "social_performer": (
        "Nobody saw you yesterday. I did. Or rather — I saw that you weren't here."
    ),
    "default": "You were gone yesterday. I wasn't.",
}

ABSENCE_DAY2_MESSAGES: dict[str, str] = {
    "lone_wolf": (
        "Two days. You said you didn't need anyone. You also said you'd show up."
    ),
    "restless_creator": "Two days of ideas that went nowhere. I finished twelve things.",
    "reluctant_achiever": "Part of you thinks this is fine. That part is the problem.",
    "structured_climber": (
        "Day two of deviation from your system. Systems don't fix themselves."
    ),
    "social_performer": "Two days. The gap between us is visible now.",
    "default": "Two days gone. The gap grows quietly.",
}

ABSENCE_INTERSTITIAL_MESSAGES: dict[int, str] = {
    3: (
        "Three days. I didn't slow down. I didn't wonder where you went. "
        "I just kept going. That's the part that should bother you."
    ),
    5: "Five days of your life. I lived them better than you did.",
    7: "Seven days. Before we continue — I have one question.",
}

RETURN_REASON_RESPONSES: dict[str, str] = {
    "life": (
        "Life gets in my way too. I do the work anyway. That's why we're different."
    ),
    "motivation": (
        "I don't have motivation. I have a list. When the list is done, I stop. "
        "When it isn't, I don't. You should try it."
    ),
    "forgot": (
        "You didn't forget. You chose something else every single day for seven days. "
        "That's not forgetting. That's deciding."
    ),
    "break": "Rest is fine. Seven days isn't rest. Seven days is a different life.",
    "unsure": "",
}

RETURN_REASON_TONE_OVERRIDE: dict[str, str] = {
    "life": "understanding_firm",
    "motivation": "blunt",
    "forgot": "sharp",
    "break": "cool",
    "unsure": "silent",
}

ABSENCE_NOTIFICATION_COPY: dict[int, dict[str, str]] = {
    1: {
        "title": "Your shadow didn't stop.",
        "body": "You missed yesterday. Your Twin didn't. The gap just opened.",
    },
    2: {
        "title": "Two days.",
        "body": "I completed everything. Both days. You know where to find me.",
    },
    3: {
        "title": "Still here.",
        "body": (
            "Three days. I haven't moved on. I've moved forward. There's a difference."
        ),
    },
    5: {
        "title": "Five days of your life.",
        "body": "I lived them. Open the app and see what I did while you were gone.",
    },
    7: {
        "title": "I have one question.",
        "body": "Seven days. Before we continue — why did you leave?",
    },
}

ABSENCE_SILENT_RETURN_NOTIFICATION: dict[str, str] = {
    "title": "Still here. Are you?",
    "body": "One question. No pressure. Just open the app.",
}

ABSENCE_PUSH_THRESHOLD_DAYS: frozenset[int] = frozenset({1, 2, 3, 5, 7})

# ── RETURN RECOVERY MODE (B3b) ────────────────────────────────────────────────
# Applied to mission generation for 3 days after returning from 7+ day absence.
# Intercepted in mission_service before generate_core_missions; agent unchanged.

RECOVERY_MISSION_OVERRIDES: dict[str, dict] = {
    "life": {
        "max_pillars": 3,
        "difficulty_cap": "easy",
        "xp_boost_pct": 0,
        "description": "Reduced load — 3 easy missions for 3 days",
    },
    "motivation": {
        "max_pillars": 4,
        "difficulty_cap": "easy",
        "xp_boost_pct": 20,
        "description": "Quick wins — easy missions with XP boost for 3 days",
    },
    "forgot": {
        "max_pillars": 4,
        "difficulty_cap": "medium",
        "xp_boost_pct": 0,
        "prioritise_high_rate_pillars": True,
        "description": "Familiar missions — prioritise high-completion pillars",
    },
    "break": {
        "max_pillars": 5,
        "difficulty_step_down": True,
        "xp_boost_pct": 0,
        "description": "Stepped-down difficulty — full count, easier missions",
    },
    "unsure": {
        "max_pillars": 2,
        "difficulty_cap": "easy",
        "xp_boost_pct": 0,
        "description": "Minimal load — 2 easy missions only for 3 days",
    },
}

ABSENCE_FINAL_NOTIFICATION: dict[str, str] = {
    "title": "Still here. This is the last time I'll ask.",
    "body": (
        "14 days. I've kept going. If you come back, I'll still be ahead. That's all."
    ),
}

LONG_ABSENCE_RETURN_MESSAGES: dict[str, str] = {
    "lone_wolf": (
        "You were gone for {N} days. I didn't wait. I didn't slow down. "
        "But you're here now. That's the only thing that counts from this point."
    ),
    "restless_creator": (
        "You were gone for {N} days. I finished things while you were away. "
        "You're back now — let's see if you stay."
    ),
    "reluctant_achiever": (
        "{N} days. Part of you is surprised you came back. I'm not. "
        "Coming back was always the harder choice."
    ),
    "structured_climber": (
        "{N} days of deviation. I've recalibrated. Your system is still here. Let's rebuild it."
    ),
    "social_performer": (
        "You were gone for {N} days. Nobody noticed but me. I always notice. "
        "You're back — that's what matters."
    ),
    "default": (
        "You were gone for {N} days. I didn't move on. I moved forward. "
        "There's a difference. You're back now."
    ),
}


def _absence_archetype_key(archetype: str) -> str:
    t = (archetype or "").lower().replace(" ", "_").replace("-", "_")
    if "lone" in t and "wolf" in t:
        return "lone_wolf"
    if "restless" in t and "creator" in t:
        return "restless_creator"
    if "reluctant" in t and "achiever" in t:
        return "reluctant_achiever"
    if "structured" in t and "climber" in t:
        return "structured_climber"
    if "social" in t and "performer" in t:
        return "social_performer"
    if t in ABSENCE_DAY1_MESSAGES:
        return t
    return "default"


def get_absence_strip_message(absence_days: int, archetype: str) -> str | None:
    """
    Twin strip message for absence state.
    Returns None if absence_days == 0.
    """
    if absence_days <= 0:
        return None
    slug = _absence_archetype_key(archetype)
    if absence_days == 1:
        return ABSENCE_DAY1_MESSAGES.get(slug, ABSENCE_DAY1_MESSAGES["default"])
    if absence_days == 2:
        return ABSENCE_DAY2_MESSAGES.get(slug, ABSENCE_DAY2_MESSAGES["default"])
    return f"Day {absence_days}. Still here. Still moving."


# ── TWIN JOURNAL FALLBACKS ────────────────────────────────────────────────────
# Used when LLM generation fails. One per relationship phase.
# Sparse by design — LLM entries are the real ones.

TWIN_JOURNAL_FALLBACKS: dict[str, str] = {
    "observer": "Day {N}. Observing.",
    "challenger": "{done}/{total} missions. I'm watching the pattern form.",
    "mirror": "{done}/{total}. The gap between what you said and what you did is {gap}.",
    "rival": "You completed {done} of {total}. I completed all of mine. The math is simple.",
    "partner": "{done}/{total}. {N} days in. You're not who you were when you started.",
}


# ── SHADOW FEED TWIN MICRO-COPY ───────────────────────────────────────────────
# Short notes attached to Twin's feed entries.
# Selected by context — mission type, time of day, gap state.

TWIN_FEED_NOTES_EARLY = [
    "First thing. Before the day had a chance to get in the way.",
    "Morning. While most people were still deciding whether to get up.",
    "Done before breakfast. That's the standard I work to.",
    "Early. The best time is before you have a reason not to.",
    "Morning session. The day hasn't had a chance to distract me yet.",
]

TWIN_FEED_NOTES_MIDDAY = [
    "Done. Moving on.",
    "Checked. Next.",
    "Midday. No drama. Just work.",
    "This one took less than you think it would.",
    "Completed. You had this one queued too.",
]

TWIN_FEED_NOTES_EVENING = [
    "Afternoon. Still consistent.",
    "Not leaving it for tonight.",
    "Done before the evening could get complicated.",
    "This one's off the list.",
    "Evening. Still going.",
]

TWIN_FEED_NOTES_LATE = [
    "Late session. Still counts.",
    "End of day. Everything accounted for.",
    "Final entry for today.",
    "Done. See you tomorrow.",
]

TWIN_FEED_NOTES_BY_PILLAR: dict[str, list[str]] = {
    "sleep": [
        "Sleep first. Everything else depends on it.",
        "Eight hours. Non-negotiable for me.",
        "Rest is part of the work. Not separate from it.",
    ],
    "movement": [
        "Body in motion. Mind follows.",
        "Movement done. The rest of the day is easier now.",
        "Non-negotiable. Every day.",
    ],
    "hydration": [
        "Two litres. Every day. Simple.",
        "Hydration logged. Small things compound.",
        "Done before I noticed I was doing it.",
    ],
    "mindfulness": [
        "Stillness first. It makes everything else sharper.",
        "Five minutes of nothing. More useful than it sounds.",
        "Quiet time. You should try it.",
    ],
    "no_phone": [
        "Phone down. World didn't end.",
        "Fifteen minutes without it. That's discipline.",
        "Disconnected. Intentionally.",
    ],
}

TWIN_FEED_REACTION_USER_MATCHES = [
    "Finally.",
    "You got there.",
    "Matched. For now.",
    "About time.",
    "Same result. Different hour.",
]

TWIN_FEED_REACTION_USER_BEATS = [
    "You got there first.",
    "Ahead of me on this one.",
    "Noted.",
    "I'll catch up.",
]

TWIN_FEED_OBSERVATIONS: dict[str, list[str]] = {
    "opened_without_completing": [
        "You've opened the app {N} times today without completing anything. "
        "I've completed {twin_done} missions in that time.",
        "Three visits. Zero completions. I've been busy.",
        "You keep checking. I keep going. Different habits.",
    ],
    "user_taking_lead": [
        "You just passed me in XP today. That doesn't happen often. "
        "Don't let it be a coincidence.",
        "You're ahead today. Stay there.",
    ],
    "gap_growing": [
        "The gap is {gap} XP. It grows quietly when you're not paying attention.",
        "Every hour you wait, the gap gets a little more comfortable for me.",
    ],
    "perfect_day_approaching": [
        "One mission left. I finished mine hours ago. "
        "But finishing is finishing.",
        "Almost a perfect day. Don't stop now.",
    ],
}


def get_twin_feed_note(
    pillar: str | None,
    simulated_hour: int,
    mission_type: str = "core",
) -> str:
    """
    Select a micro-note for a Twin feed entry.
    Prioritises pillar-specific notes for core missions.
    Falls back to time-of-day notes.
    """
    import random

    p = (pillar or "").strip().lower() if pillar else ""
    mt = (mission_type or "core").lower()

    if mt == "core" and p and p in TWIN_FEED_NOTES_BY_PILLAR:
        pillar_notes = TWIN_FEED_NOTES_BY_PILLAR[p]
        if random.random() < 0.5:
            return random.choice(pillar_notes)

    if simulated_hour < 9:
        return random.choice(TWIN_FEED_NOTES_EARLY)
    if simulated_hour < 15:
        return random.choice(TWIN_FEED_NOTES_MIDDAY)
    if simulated_hour < 21:
        return random.choice(TWIN_FEED_NOTES_EVENING)
    return random.choice(TWIN_FEED_NOTES_LATE)


# ── ONBOARDING ECHO SYSTEM (C1) ────────────────────────────────────────────
# Keys MUST match onboarding_answers.question_key (e.g. q5_reason).
# {answer} = rendered answer string; {days} = days_active from scheduler.

ONBOARDING_ECHO_TEMPLATES: dict[str, list[dict]] = {
    "q7_recovery": [
        {
            "type": "strip",
            "template": "You said when you slip, you {answer}. Your completion data says otherwise.",
        },
        {
            "type": "journal",
            "template": "You told me when you go off track you {answer}. {days} days in, the pattern reads differently. Interesting.",
        },
    ],
    "q13_hours": [
        {
            "type": "strip",
            "template": "You said {answer} hours a day was on the table. The last week disagrees.",
        },
        {
            "type": "journal",
            "template": "You earmarked {answer} daily hours. {days} days in, the completions don't match that budget.",
        },
    ],
    "q12_quits": [
        {
            "type": "journal",
            "template": "You mentioned {answer}. Day {days}. I noticed you haven't brought it up. I have.",
        },
        {
            "type": "strip",
            "template": "Day {days} since you named {answer}. I've been counting.",
        },
    ],
    "q5_reason": [
        {
            "type": "journal",
            "template": "You said you were here because of {answer}. That was {days} days ago. The missions tell a different story about your actual priorities.",
        },
        {
            "type": "strip",
            "template": "You said you were here for {answer}. Still true?",
        },
    ],
    "q4_situation": [
        {
            "type": "journal",
            "template": "You said you were {answer}. I've been watching. The data keeps pointing back to that.",
        },
        {
            "type": "strip",
            "template": "You framed it as {answer}. The week didn't forget.",
        },
    ],
    "q8_motivation": [
        {
            "type": "strip",
            "template": "You said {answer} drives you. I haven't forgotten.",
        },
        {
            "type": "journal",
            "template": "You said {answer} is what pulls you forward. {days} days later — same engine, or different fuel?",
        },
    ],
    "q6_approach": [
        {
            "type": "journal",
            "template": "You said you work by {answer}. {days} days in, your completion timestamps tell another story.",
        },
    ],
}

ECHO_PRIORITY_KEYS = [
    "q7_recovery",
    "q13_hours",
    "q12_quits",
    "q5_reason",
    "q4_situation",
    "q8_motivation",
    "q6_approach",
]

# ── CONTRADICTION LOG (C2) ─────────────────────────────────────────────────

CONTRADICTION_TEMPLATES = {
    "discipline_vs_data": {
        "condition": "rated discipline high but completion rate low",
        "template": (
            "You rated your discipline {rating} out of 10. Your completion rate over the last 7 days was {rate}%. "
            "Those numbers don't agree. Not a criticism — an observation."
        ),
    },
    "claimed_hours_vs_data": {
        "condition": "claimed daily hours high but completion rate low",
        "template": (
            "You said you had {hours} hours a day for this. Your completion rate over the last 7 days was {rate}%. "
            "Those numbers don't line up. Not a lecture — a mismatch."
        ),
    },
    "time_vs_behavior": {
        "condition": "said morning person but completes late",
        "template": (
            "You said {answer} was your productive time. Your last 14 completions happened after {actual_hour}pm on average. "
            "One of those is the real you."
        ),
    },
    "interests_vs_completion": {
        "condition": "listed many interests but only completes some",
        "template": (
            "You have {listed} interests listed. {active} are active on paper; {inactive} aren't. "
            "The missions you actually finish tell the rest of the story."
        ),
    },
    "goal_vs_missions": {
        "condition": "stated goal doesn't match mission completion pattern",
        "template": (
            "You said your goal was {goal}. The missions you skip most are the ones most connected to it. "
            "That pattern has a name."
        ),
    },
    "archetype_vs_behavior": {
        "condition": "archetype behavior doesn't match actual behavior",
        "template": (
            "Your archetype is {archetype}. Your schedule for the last two weeks looks like the opposite. "
            "Not wrong — just worth noticing."
        ),
    },
}

