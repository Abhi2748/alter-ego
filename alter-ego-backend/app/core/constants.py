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
# REVISED — users hit Surge State (daily XP cap) more often; drives Aether after cap.
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

# Twin recalibration schedule (first full behaviour calibration, then recurring)
TWIN_FIRST_CALIBRATION_DAY = 7
TWIN_RECALIBRATION_INTERVAL_DAYS = 7

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

SIGIL_LEVEL_THRESHOLDS = [
    0,
    300,
    900,
    2_100,
    4_500,
    9_000,
    16_500,
    28_000,
    45_000,
    70_000,
]

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

AETHER_PER_MISSION = {
    "easy": 10,
    "medium": 20,
    "hard": 40,
}

AETHER_ALL_COMPLETE_BONUS = 30


def get_sigil_level(total_aether: int) -> int:
    level = 1
    for i, threshold in enumerate(SIGIL_LEVEL_THRESHOLDS):
        if total_aether >= threshold:
            level = i + 1
        else:
            break
    return min(level, 10)


def get_sigil_progress(total_aether: int) -> dict:
    """Progress within current sigil level (for API / Sigil screen)."""
    level = get_sigil_level(total_aether)
    name = SIGIL_LEVEL_NAMES[level - 1]

    if level >= 10:
        return {
            "level": 10,
            "name": "The Eternal Flame",
            "aether_total": total_aether,
            "aether_in_level": total_aether - SIGIL_LEVEL_THRESHOLDS[9],
            "aether_for_next": SIGIL_LEVEL_THRESHOLDS[9],
            "aether_needed": 0,
            "progress_percent": 100.0,
        }

    current_threshold = SIGIL_LEVEL_THRESHOLDS[level - 1]
    next_threshold = SIGIL_LEVEL_THRESHOLDS[level]
    aether_in_level = total_aether - current_threshold
    level_range = next_threshold - current_threshold
    progress_percent = round((aether_in_level / level_range) * 100, 1) if level_range else 0.0

    return {
        "level": level,
        "name": name,
        "aether_total": total_aether,
        "aether_in_level": aether_in_level,
        "aether_for_next": next_threshold,
        "aether_needed": level_range - aether_in_level,
        "progress_percent": min(progress_percent, 99.9),
    }

