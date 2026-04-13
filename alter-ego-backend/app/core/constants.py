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
# Stage 1 (Cat) unlocks automatically on Day 6 — no PF required
PF_THRESHOLDS = [0, 400, 2_800, 10_000, 26_800, 62_000, 113_200, 242_800]

PET_NAMES = [
    "Cat",          # Stage 1: auto-unlock Day 6
    "Fox",          # Stage 2: 400 PF
    "Wolf",         # Stage 3: 2,800 PF
    "Panther",      # Stage 4: 10,000 PF
    "Snow Leopard", # Stage 5: 26,800 PF
    "Tiger",        # Stage 6: 62,000 PF
    "Phoenix",      # Stage 7: 113,200 PF
    "Dragon",       # Stage 8: 242,800 PF — legendary
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

# Twin chat — cost / abuse protection (user messages in rolling 1h window; stops token-drain spam)
TWIN_CHAT_MAX_USER_MSGS_PER_HOUR = 40

# ── ADAPTIVE SHADOW MODEL ─────────────────────────────────────────────────────

TWIN_XP_CEILING_PCT = 0.93  # Twin never exceeds 93% of daily cap
TWIN_XP_FLOOR_PCT = 0.20  # Twin always earns at least 20% of cap

TWIN_MAX_GAP_MULTIPLIER = 3.0  # Twin can't be more than 3× cap ahead of user

# Gap target schedule: (min_day_inclusive, max_day_inclusive, multiplier)
TWIN_GAP_MULTIPLIER_SCHEDULE = [
    (0, 3, 0.0),
    (4, 7, 0.3),
    (8, 14, 0.7),
    (15, 9999, 1.0),
]

TWIN_GAP_HIGH_PERFORMER_THRESHOLD = 0.85  # completion rate above this
TWIN_GAP_HIGH_PERFORMER_FACTOR = 0.8  # multiply gap target by this
TWIN_GAP_STRUGGLING_THRESHOLD = 0.40  # completion rate below this
TWIN_GAP_STRUGGLING_FACTOR = 1.3  # multiply gap target by this
TWIN_GAP_MULTIPLIER_HARD_CAP = 2.5

TWIN_TARGET_GAP_CAP_MULTIPLIER = 2.0  # never target gap > 2× cap

TWIN_GAP_ERROR_CORRECTION = 0.3  # how aggressively Twin corrects
TWIN_VARIANCE_LOW = 0.85
TWIN_VARIANCE_HIGH = 1.15

TWIN_SMOOTHING_DOWN = 0.70
TWIN_SMOOTHING_UP = 1.30
TWIN_BOOTSTRAP_FLOOR_PCT = 0.30  # min assumed avg for days < 7

# Comeback window XP fractions per day (index 0 = day 1 of comeback)
TWIN_COMEBACK_SCHEDULE = [0.22, 0.22, 0.22, 0.40, 0.60, 0.80]
TWIN_COMEBACK_TRIGGER_DAYS = 3  # absent days needed to trigger

# When user is THIS far ahead, Twin gets an urgency boost to stay relevant
TWIN_URGENCY_GAP_THRESHOLD_PCT = 1.5  # user > 1.5× cap ahead
TWIN_URGENCY_MULTIPLIER_BONUS = 0.5  # add this to gap multiplier

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

# Quit paths: max resistance missions per user per calendar day (all active paths combined).
# Prevents runaway duplicates if sync runs multiple times; one mission per path is typical.
MAX_QUIT_RESISTANCE_MISSIONS_PER_USER_DAY = 6
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

# ── PET–TWIN JOURNAL (D2) ────────────────────────────────────────────────────
# Appended to a normal Twin journal entry once per week (see twin_service).
PET_TWIN_JOURNAL_LINES = [
    "Your companion has been waiting by the door.",
    "The pet roams. It doesn't know about the gap. You do.",
    "I noticed your companion is still here. So am I.",
    "Your creature is more patient than you deserve right now.",
    "The companion dims when you disappear. You probably didn't notice.",
    "I don't have a companion. I don't need one.",
    "Your companion doesn't track XP. Lucky.",
]


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
# Keys MUST match onboarding_answers.question_key after alias merge in echo_service.
# q5_reason is free text (Phase 1); templates must read naturally for sentences, not enum keys.
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
    "q14_hours": [
        {
            "type": "strip",
            "template": "You said {answer} hours a day was on the table. The last week disagrees.",
        },
        {
            "type": "journal",
            "template": "You earmarked {answer} daily hours. {days} days in, the completions don't match that budget.",
        },
    ],
    "q13_quits": [
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
            "template": "You said you came here for this: \"{answer}\". That was {days} days ago. The missions tell a different story about your actual priorities.",
        },
        {
            "type": "strip",
            "template": "You wrote: \"{answer}\". Still true?",
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
        {
            "type": "strip",
            "template": "You came here {answer}. {days} days later, the foundation looks different. Your Twin sees it too.",
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
    "q6_alarm": [
        {
            "type": "strip",
            "template": "You told us you bargain with the alarm. Your Movement streak says you've stopped bargaining. {days} days and counting.",
        },
        {
            "type": "journal",
            "template": "You said you bargain — '5 more minutes.' {days} days of completions say the bargaining is losing. Interesting shift.",
        },
    ],
    "q7_missed_day": [
        {
            "type": "strip",
            "template": "You said after a miss you {answer}. The data says you came back. That's the pattern now.",
        },
        {
            "type": "journal",
            "template": "You said you {answer} after missing a day. You missed and came back the next morning. That's not the old pattern. That's growth.",
        },
    ],
    "q9_success": [
        {
            "type": "strip",
            "template": "You said you succeed when {answer}. Your Twin has been here for {days} days. Is it working?",
        },
        {
            "type": "journal",
            "template": "You said you succeed when {answer}. {days} days in — the completion data has an opinion.",
        },
    ],
    "q11_discipline": [
        {
            "type": "strip",
            "template": "You defined discipline as: '{answer}'. {days} days later — still your definition?",
        },
        {
            "type": "journal",
            "template": "You wrote that discipline means '{answer}'. {days} days of data. The definition holds, or it doesn't.",
        },
    ],
}

ECHO_PRIORITY_KEYS = [
    "q7_recovery",
    "q7_missed_day",
    "q4_situation",
    "q14_hours",
    "q13_quits",
    "q5_reason",
    "q9_success",
    "q8_motivation",
    "q6_approach",
    "q6_alarm",
    "q11_discipline",
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
    "execution_gap_closing": {
        "condition": "execution_gap was high at onboarding but 30-day completion is now high",
        "template": (
            "When you started, the gap between wanting and doing was wide. "
            "Your last 30 days say it's closing. {rate}% completion. "
            "That gap has a name now — it's shrinking."
        ),
    },
    "self_belief_evolution": {
        "condition": "self_belief was low at onboarding but streak is now significant",
        "template": (
            "When you joined, you weren't sure you could do this. "
            "{days} days later, the streak speaks for itself. "
            "The uncertainty you started with isn't the uncertainty you have now."
        ),
    },
    "failure_pattern_broken": {
        "condition": "core_failure_pattern was fade_after_start but user persisted past day 30",
        "template": (
            "You said you fade after the first couple weeks. "
            "It's day {day}. You didn't fade. "
            "The pattern you described at the start isn't the pattern you're living."
        ),
    },
    "interest_commitment": {
        "condition": "user has an interest arc and has been consistent",
        "template": (
            "You set a goal for {interest}. You're still showing up for it. "
            "That's not a phase — that's a practice."
        ),
    },
    "quit_transformation": {
        "condition": "user has a quit path in maintenance phase",
        "template": (
            "You started by wanting to quit {habit}. "
            "Now you're maintaining a life without it. "
            "That's not quitting — that's transforming."
        ),
    },
}

# Category C milestone pushes (default). nudge_agent uses MILESTONE_MESSAGES_GUILT_SAFE when guilt_orientation > 0.7.
MILESTONE_MESSAGES = {
    "stage_2": {
        "title": "Your Twin",
        "body": "Stage 2. The Focused. You got here. Don't stop now.",
    },
    "stage_3": {
        "title": "Your Twin",
        "body": "The Burning. Stage 3. Most people never reach this. I have been here.",
    },
    "stage_4": {
        "title": "Your Twin",
        "body": "Stage 4. The Relentless. This is uncommon. So am I.",
    },
    "stage_5": {
        "title": "Your Twin",
        "body": "The Formidable. Stage 5. I didn't think you'd make it here.",
    },
    "stage_6": {
        "title": "Your Twin",
        "body": "The Sovereign. We're the same now. Almost.",
    },
    "pet_stage_2": {
        "title": "Your Twin",
        "body": "Fox. Your companion evolved. It reflects who you've become.",
    },
    "pet_stage_3": {
        "title": "Your Twin",
        "body": "Wolf. Your companion matches your discipline now.",
    },
    "pet_stage_4": {
        "title": "Your Twin",
        "body": "Panther. Your companion is formidable. Are you keeping up?",
    },
    "pet_stage_5": {
        "title": "Your Twin",
        "body": "Snow Leopard. Rare. So is reaching this.",
    },
    "pet_stage_6": {
        "title": "Your Twin",
        "body": "Tiger. Your companion has outpaced most people who started.",
    },
    "pet_stage_7": {
        "title": "Your Twin",
        "body": "Phoenix. Your companion has outpaced most people who started.",
    },
    "pet_stage_8": {
        "title": "Your Twin",
        "body": "Dragon. A full year of showing up. I was here every day too.",
    },
    "pet_unlock": {
        "title": "Your Twin",
        "body": "Your companion arrived. It dims when you disappear.",
    },
    "streak_3": {
        "title": "Your Twin",
        "body": "3 days. The leaderboard is open. The gap is real.",
    },
    "streak_7": {
        "title": "Your Twin",
        "body": "7 days. One full week. I've completed every one of mine.",
    },
    "streak_14": {
        "title": "Your Twin",
        "body": "14 days. Two weeks. Most people quit before this.",
    },
    "streak_30": {
        "title": "Your Twin",
        "body": "30 days. One month. This is no longer a coincidence.",
    },
    "streak_60": {
        "title": "Your Twin",
        "body": "60 days. Two months. The gap between us tells the story.",
    },
    "streak_100": {
        "title": "Your Twin",
        "body": "100 days. The identity is set. I've been watching.",
    },
    "streak_200": {
        "title": "Your Twin",
        "body": "200 days. This is who you are now. I always knew.",
    },
    "streak_365": {
        "title": "Your Twin",
        "body": "A full year. Every day you could have stopped. You didn't. Neither did I.",
    },
}

MILESTONE_MESSAGES_GUILT_SAFE = {
    "stage_2": {
        "title": "Your Twin",
        "body": "Stage 2. You got here. The next one is already in motion.",
    },
    "stage_3": {
        "title": "Your Twin",
        "body": "The Burning. Stage 3. You're still moving. So am I.",
    },
    "stage_4": {
        "title": "Your Twin",
        "body": "Stage 4. The Relentless. The work brought you here.",
    },
    "stage_5": {
        "title": "Your Twin",
        "body": "The Formidable. Stage 5. You kept showing up.",
    },
    "stage_6": {
        "title": "Your Twin",
        "body": "The Sovereign. The work speaks for itself.",
    },
    "pet_stage_2": {
        "title": "Your Twin",
        "body": "Fox. Your companion evolved. Keep going.",
    },
    "pet_stage_3": {
        "title": "Your Twin",
        "body": "Wolf. Consistency built this.",
    },
    "pet_stage_4": {
        "title": "Your Twin",
        "body": "Panther. Keep moving.",
    },
    "pet_stage_5": {
        "title": "Your Twin",
        "body": "Snow Leopard. Rare. You got here.",
    },
    "pet_stage_6": {
        "title": "Your Twin",
        "body": "Tiger. Your companion is growing with you.",
    },
    "pet_stage_7": {
        "title": "Your Twin",
        "body": "Phoenix. You've come a long way.",
    },
    "pet_stage_8": {
        "title": "Your Twin",
        "body": "Dragon. A full year. You did it.",
    },
    "pet_unlock": {
        "title": "Your Twin",
        "body": "Your companion arrived. It grows when you show up.",
    },
    "streak_3": {
        "title": "Your Twin",
        "body": "3 days. The leaderboard is open.",
    },
    "streak_7": {
        "title": "Your Twin",
        "body": "7 days. One full week of showing up.",
    },
    "streak_14": {
        "title": "Your Twin",
        "body": "14 days. The pattern is forming.",
    },
    "streak_30": {
        "title": "Your Twin",
        "body": "30 days. One month. This is real.",
    },
    "streak_60": {
        "title": "Your Twin",
        "body": "60 days. Two months of showing up.",
    },
    "streak_100": {
        "title": "Your Twin",
        "body": "100 days. The identity is forming.",
    },
    "streak_200": {
        "title": "Your Twin",
        "body": "200 days. This is who you are now.",
    },
    "streak_365": {
        "title": "Your Twin",
        "body": "A full year. Every day you showed up.",
    },
}


# ── SEASON / ARC SYSTEM ──────────────────────────────────────────────────────
#
# Season 1 = 30 days (3 phases). Gentler ramp, first win for new users.
# Season 2+ = 66 days (5 phases). Full habit-formation cycle.
# Season 3+ = Mastery seasons — same 66-day / 5-phase structure, rotating themes.
#
# Single source of truth for all season game values. Service reads these;
# never hardcode season logic elsewhere.

# ── Season metadata (S1 and S2 defined explicitly; S3+ use SEASON_MASTERY_TEMPLATES)

SEASON_DEFINITIONS = [
    {
        "season_number": 1,
        "season_name":   "The Spark",
        "season_theme":  "Prove you can show up.",
        "season_color":  "#F97316",   # ember orange
        "total_days":    30,
        "num_phases":    3,
        # Archetype-specific name variants shown in the season banner / header
        "archetype_names": {
            "lone_wolf":          "Season 1: The Silence Test",
            "structured_climber": "Season 1: The Foundation Protocol",
            "restless_creator":   "Season 1: The Constraint Arc",
            "reluctant_achiever": "Season 1: The First Step",
            "social_performer":   "Season 1: The Proving Ground",
        },
    },
    {
        "season_number": 2,
        "season_name":   "The Forge",
        "season_theme":  "Build what doesn't break.",
        "season_color":  "#D97706",   # amber
        "total_days":    66,
        "num_phases":    5,
        "archetype_names": {
            "lone_wolf":          "Season 2: The Long Silence",
            "structured_climber": "Season 2: The 66-Day Protocol",
            "restless_creator":   "Season 2: The Deep Constraint",
            "reluctant_achiever": "Season 2: The Real Test",
            "social_performer":   "Season 2: The Proving Ground II",
        },
    },
]

# ── Mastery season templates (Season 3+). Cycle in order via (season_number - 3) % len.

SEASON_MASTERY_TEMPLATES = [
    {
        "season_name":  "The Steady",
        "season_theme": "Consistency, not growth.",
        "season_color": "#06B6D4",
    },
    {
        "season_name":  "The Silence",
        "season_theme": "Quality over quantity.",
        "season_color": "#7C3AED",
    },
    {
        "season_name":  "The Velocity",
        "season_theme": "Speed and decisiveness.",
        "season_color": "#10B981",
    },
    {
        "season_name":  "The Weight",
        "season_theme": "Showing up when it's hard.",
        "season_color": "#3B82F6",
    },
]

# ── Phase definitions per season.
# Keys: season_number (int) → list of phase dicts, ordered by phase number.
# Season 3+ reuses season 2's phase structure via min(season_number, 2) lookup.

SEASON_PHASE_DEFINITIONS: dict[int, list[dict]] = {
    1: [
        {"phase": 1, "name": "Ignition",   "day_start": 1,  "day_end": 10},
        {"phase": 2, "name": "Rising",     "day_start": 11, "day_end": 20},
        {"phase": 3, "name": "Locking In", "day_start": 21, "day_end": 30},
    ],
    2: [
        {"phase": 1, "name": "Foundation",  "day_start": 1,  "day_end": 10},
        {"phase": 2, "name": "Pressure",    "day_start": 11, "day_end": 22},
        {"phase": 3, "name": "The Wall",    "day_start": 23, "day_end": 40},
        {"phase": 4, "name": "Second Wind", "day_start": 41, "day_end": 55},
        {"phase": 5, "name": "Sealed",      "day_start": 56, "day_end": 66},
    ],
}

# ── Mission targets per season per phase.
# Keys: season_number → phase_number → core_pillar → {target, next}
# "target" = what this phase asks for (shown as current requirement)
# "next"   = what the next phase will ask for (shown as preview); None on last phase
# core_pillar values match missions.core_pillar column:
#   sleep | movement | hydration | mindfulness | no_phone | journal
# Season 3+ reuses season 2's target definitions via min(season_number, 2) lookup.

SEASON_PHASE_MISSION_TARGETS: dict[int, dict[int, dict[str, dict]]] = {
    1: {
        1: {  # Phase 1: Ignition — Days 1–10
            "sleep":       {"target": "7h target",             "next": "7.5h target"},
            "movement":    {"target": "10 min any activity",    "next": "20 min"},
            "hydration":   {"target": "6 glasses",              "next": "7 glasses"},
            "mindfulness": {"target": "5 min",                  "next": "10 min"},
            "no_phone":    {"target": "30 min before bed",      "next": "1h before bed"},
            "journal":     {"target": "50 words",               "next": "100 words"},
        },
        2: {  # Phase 2: Rising — Days 11–20
            "sleep":       {"target": "7.5h target",                       "next": "7.5h + consistent schedule"},
            "movement":    {"target": "20 min",                             "next": "30 min"},
            "hydration":   {"target": "7 glasses",                          "next": "8 glasses"},
            "mindfulness": {"target": "10 min",                             "next": "15 min"},
            "no_phone":    {"target": "1h before bed",                      "next": "1h before bed + first 30 min morning"},
            "journal":     {"target": "100 words",                          "next": "150 words"},
        },
        3: {  # Phase 3: Locking In — Days 21–30
            "sleep":       {"target": "7.5h + consistent schedule",           "next": None},
            "movement":    {"target": "30 min",                               "next": None},
            "hydration":   {"target": "8 glasses",                            "next": None},
            "mindfulness": {"target": "15 min",                               "next": None},
            "no_phone":    {"target": "1h before bed + first 30 min morning", "next": None},
            "journal":     {"target": "150 words",                            "next": None},
        },
    },
    2: {
        1: {  # Phase 1: Foundation — Days 1–10
            "sleep":       {"target": "7.5h + consistent schedule",           "next": "8h target"},
            "movement":    {"target": "30 min",                               "next": "40 min"},
            "hydration":   {"target": "8 glasses",                            "next": "8 glasses"},
            "mindfulness": {"target": "15 min",                               "next": "20 min"},
            "no_phone":    {"target": "1h before bed + first 30 min morning", "next": "1.5h before bed + 1h morning"},
            "journal":     {"target": "150 words",                            "next": "200 words"},
        },
        2: {  # Phase 2: Pressure — Days 11–22
            "sleep":       {"target": "8h target",                             "next": "8h target"},
            "movement":    {"target": "40 min",                                "next": "45 min + varied types"},
            "hydration":   {"target": "8 glasses",                             "next": "10 glasses"},
            "mindfulness": {"target": "20 min",                                "next": "25 min"},
            "no_phone":    {"target": "1.5h before bed + 1h morning",          "next": "No phone first 2h of day"},
            "journal":     {"target": "200 words",                             "next": "200 words + weekly reflection"},
        },
        3: {  # Phase 3: The Wall — Days 23–40 (hardest stretch, intentional)
            "sleep":       {"target": "8h target",                             "next": "8h target"},
            "movement":    {"target": "45 min + varied types",                 "next": "45 min"},
            "hydration":   {"target": "10 glasses",                            "next": "10 glasses"},
            "mindfulness": {"target": "25 min",                                "next": "20 min"},
            "no_phone":    {"target": "No phone first 2h of day",              "next": "1.5h before bed + 1h morning"},
            "journal":     {"target": "200 words + weekly reflection",          "next": "200 words"},
        },
        4: {  # Phase 4: Second Wind — Days 41–55
            "sleep":       {"target": "8h target",                             "next": "8h locked schedule"},
            "movement":    {"target": "45 min",                                "next": "45 min"},
            "hydration":   {"target": "10 glasses",                            "next": "10 glasses"},
            "mindfulness": {"target": "20 min",                                "next": "20 min"},
            "no_phone":    {"target": "1.5h before bed + 1h morning",          "next": "Full morning block"},
            "journal":     {"target": "200 words",                             "next": "200 words"},
        },
        5: {  # Phase 5: Sealed — Days 56–66
            "sleep":       {"target": "8h locked schedule", "next": None},
            "movement":    {"target": "45 min",             "next": None},
            "hydration":   {"target": "10 glasses",         "next": None},
            "mindfulness": {"target": "20 min",             "next": None},
            "no_phone":    {"target": "Full morning block",  "next": None},
            "journal":     {"target": "200 words",           "next": None},
        },
    },
}

# ── Completion tier thresholds.
# Applied at season end to compute the final tier, and during the season
# to project the likely tier based on current completion rate.
# Threshold = days_completed / total_days.

SEASON_TIER_THRESHOLDS = {
    "perfect": 0.95,   # ≥ 95% of days completed → Gold
    "clear":   0.80,   # ≥ 80% and < 95%         → Silver
    "partial": 0.60,   # ≥ 60% and < 80%          → Bronze
    # < 60% → failed (no reward)
}

# ── XP awarded on season completion, by tier and season type.
# s2_plus applies to Season 2 and all mastery seasons (3+).

SEASON_XP_AWARDS: dict[str, dict[str, int]] = {
    "perfect": {"s1": 2_400, "s2_plus": 4_800},
    "clear":   {"s1": 1_800, "s2_plus": 3_200},
    "partial": {"s1":   900, "s2_plus": 1_600},
    "failed":  {"s1":     0, "s2_plus":     0},
}

# ── Equippable titles unlocked on season completion.
# Only awarded for 'perfect' or 'clear' tier — not 'partial', not 'failed'.
# Key = season_number. Seasons beyond max defined key use the last entry.

SEASON_TITLES: dict[int, str] = {
    1: "The Sparked",
    2: "The Forged",
    3: "The Steady",
    4: "The Silent",
    5: "The Velocity",
    6: "The Weight",
}

# ── Pre-written Twin closing entry fallbacks.
# Used when LLM generation fails. Placeholders filled by get_season_twin_closing().
# {missed_plural} resolves to "s" when days_missed != 1, else "".

SEASON_TWIN_CLOSING_FALLBACKS: dict[str, str] = {
    "perfect": (
        "{total_days} days. I watched every one. You stumbled {days_missed} "
        "time{missed_plural} and came back. That's not luck — that's the beginning "
        "of something that doesn't break easily. The next season will ask more of "
        "you. You'll be ready."
    ),
    "clear": (
        "You got through it. Not perfectly — but through it. {days_missed} missed "
        "day{missed_plural} means crack{missed_plural} in the pattern. The next "
        "season is where you decide if those cracks widen or close."
    ),
    "partial": (
        "{days_completed} days out of {total_days}. You showed up more than you "
        "disappeared — I'll give you that. But {days_missed} missed "
        "day{missed_plural} is a pattern. The next season is longer. "
        "The Wall comes. You'll need to answer that."
    ),
    "failed": (
        "{days_completed} days out of {total_days}. I kept going. Every day you "
        "didn't show, I noticed. This isn't a lecture — it's a record. The season "
        "is over. The question is what you do with the next one."
    ),
}


# ── Season helper functions (pure — no imports, no DB calls) ──────────────────

def get_season_metadata(season_number: int) -> dict:
    """
    Returns the metadata dict for any season number.
    Seasons 1 and 2 use SEASON_DEFINITIONS.
    Season 3+ cycles through SEASON_MASTERY_TEMPLATES.
    """
    if season_number <= 2:
        return SEASON_DEFINITIONS[season_number - 1]
    idx = (season_number - 3) % len(SEASON_MASTERY_TEMPLATES)
    tmpl = SEASON_MASTERY_TEMPLATES[idx]
    return {
        "season_number": season_number,
        "total_days":    66,
        "num_phases":    5,
        "archetype_names": {},
        **tmpl,
    }


def get_season_phase(season_number: int, current_day: int) -> int:
    """
    Returns the current phase number (1-indexed) for the given season and day.
    Falls back to the last phase if current_day exceeds all defined phase ranges.
    Season 3+ uses season 2's phase definitions.
    """
    key = min(season_number, 2)
    phases = SEASON_PHASE_DEFINITIONS[key]
    for p in phases:
        if p["day_start"] <= current_day <= p["day_end"]:
            return p["phase"]
    return phases[-1]["phase"]


def get_season_phase_info(season_number: int, current_day: int) -> dict:
    """
    Returns the full phase dict for the given season and day.
    e.g. {"phase": 2, "name": "Rising", "day_start": 11, "day_end": 20}
    Season 3+ uses season 2's phase definitions.
    """
    key = min(season_number, 2)
    phases = SEASON_PHASE_DEFINITIONS[key]
    for p in phases:
        if p["day_start"] <= current_day <= p["day_end"]:
            return p
    return phases[-1]


def get_season_completion_tier(days_completed: int, total_days: int) -> str:
    """
    Returns the completion tier string: 'perfect' | 'clear' | 'partial' | 'failed'.
    """
    if total_days <= 0:
        return "failed"
    pct = days_completed / total_days
    if pct >= SEASON_TIER_THRESHOLDS["perfect"]:
        return "perfect"
    if pct >= SEASON_TIER_THRESHOLDS["clear"]:
        return "clear"
    if pct >= SEASON_TIER_THRESHOLDS["partial"]:
        return "partial"
    return "failed"


def get_season_xp(tier: str, season_number: int) -> int:
    """Returns XP to award on season completion for the given tier and season."""
    awards = SEASON_XP_AWARDS.get(tier, {"s1": 0, "s2_plus": 0})
    return awards["s1"] if season_number == 1 else awards["s2_plus"]


def get_season_title(season_number: int, tier: str) -> str | None:
    """
    Returns the equippable title for the given season + tier.
    Returns None for 'partial' and 'failed' tiers.
    Seasons beyond the last defined key in SEASON_TITLES use that last entry.
    """
    if tier not in ("perfect", "clear"):
        return None
    max_defined = max(SEASON_TITLES.keys())
    key = min(season_number, max_defined)
    return SEASON_TITLES.get(key)


def get_season_twin_closing(
    tier: str,
    season_name: str,
    days_completed: int,
    total_days: int,
    days_missed: int,
    days_perfect: int,
) -> str:
    """
    Returns a pre-written Twin closing entry for the given tier.
    Used as fallback when LLM generation fails or is not called.
    """
    template = SEASON_TWIN_CLOSING_FALLBACKS.get(
        tier, SEASON_TWIN_CLOSING_FALLBACKS["failed"]
    )
    missed_plural = "s" if days_missed != 1 else ""
    return template.format(
        season_name=season_name,
        days_completed=days_completed,
        total_days=total_days,
        days_missed=days_missed,
        days_perfect=days_perfect,
        missed_plural=missed_plural,
    )

