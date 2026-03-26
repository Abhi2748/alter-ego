import os
import json
import logging

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

from app.core.constants import INTEREST_LEVEL_MAP, INTEREST_PHASES
from app.services.interest_guardrails import (
    InterestValidationError,
    validate_interest_input,
    validate_normalised_interest,
    validate_normalised_quit,
    validate_quit_input,
)

logger = logging.getLogger(__name__)

load_dotenv()

# Initialise the LLM — used for both functions
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.3,       # Low temperature for consistent structured output
    max_tokens=1000,
    api_key=os.environ["OPENAI_API_KEY"],
)


NORMALISATION_SYSTEM_PROMPT = """
You are a domain knowledge expert. You receive a user's free-text description 
of an interest or skill they want to develop, and you return structured 
information about that domain.

Your job is critical: the mission planning system uses your output to generate 
daily missions for this user. The richer and more accurate your domain knowledge, 
the better the missions will be.

You must return ONLY valid JSON — no preamble, no explanation, no markdown fences.

Return this exact structure:
{
  "normalised_name": "Guitar",
  "category": "Music",
  "mission_domain": "acoustic and electric guitar practice",
  "level_context": {
    "beginner": "What a true beginner should focus on: fundamentals, basic chords, finger positioning, building calluses, 5-10 minute practice sessions to build tolerance",
    "intermediate": "What someone getting the hang of it should work on: chord transitions, basic songs, rhythm patterns, 20-30 minute focused sessions",
    "advanced": "What an established practitioner should push toward: complex techniques, music theory, improvisation, composition, performance"
  },
  "evidence_base": "What research and established practice actually says about learning this skill effectively. Include: the most effective practice methods (e.g. deliberate practice vs mindless repetition), optimal session length and frequency, common mistakes beginners make, the psychological challenges at each stage, and what experts in this domain consistently recommend. 3-5 sentences minimum.",
  "progression_milestones": ["First full chord transition", "First complete song", "First performance for someone", "Improvising freely"],
  "common_obstacles": ["Finger pain in early weeks", "Plateau after basic chords", "Inconsistent practice schedule"],
  "mission_varieties": ["Technical exercises", "Song learning", "Music theory", "Ear training", "Composition", "Performance"],
  "confidence": 0.95
}

Rules:
- normalised_name: Canonical name, properly capitalised. "Guitar" not "playing guitar"
- category: Broad category. Music / Fitness / Writing / Coding / Language / Art / Sport / Business / Mindfulness / Finance / Cooking / Other
- mission_domain: The specific practice context used in mission generation prompts
- evidence_base: MUST reference actual research or established expert consensus — not generic advice. This is what makes missions research-backed rather than random.
- confidence: 0.0-1.0 — how confident you are in the normalisation. Under 0.70 means the input was ambiguous.
- If the input is completely unclear (e.g. "stuff", "things", "idk"), return confidence 0.3 and normalised_name = the raw input
- Never refuse — always return valid JSON even for unusual interests
"""


QUIT_NORMALISATION_PROMPT = """
You are a behaviour change and habit science expert. You receive a user's 
free-text description of a habit they want to quit or reduce, and you return 
structured information about that habit pattern.

Your output is used by the mission planning system to generate daily resistance 
missions. The richer your knowledge of this habit pattern, the more effective 
the missions will be.

Return ONLY valid JSON — no preamble, no explanation, no markdown fences.

Return this exact structure:
{
  "normalised_name": "Social Media Scrolling",
  "dedupe_key": "social_media_scrolling",
  "primary_need_category": "boredom_dopamine",
  "need_reasoning": "Social media scrolling primarily serves the need for novelty and dopamine stimulation. It provides a low-effort, high-frequency reward loop that substitutes for meaningful engagement.",
  "replacement_directions": ["Active creative engagement", "Social connection with intentionality", "Physical movement when bored", "Learning something new"],
  "phase_guidance": {
    "days_1_10": "Awareness and first substitution. Notice the urge pattern — when it hits, how strong it is, what triggered it. Do one small replacement action.",
    "days_11_30": "Consistent replacement. The new behaviour becomes a daily practice, not just when the urge hits.",
    "days_31_60": "Environmental design. Remove cues, add friction to the old path. Delete apps, set screen time limits, restructure the physical environment.",
    "days_61_90": "Identity shift. The user starts to see themselves as someone who does not do this. Missions reinforce the new identity.",
    "days_90_plus": "Consolidation. The identity is set. Help someone else. Document what changed."
  },
  "evidence_base": "What behaviour science and neuroscience research actually says about this habit pattern: why it forms, what maintains it, what replacement strategies have the strongest evidence, and what the typical recovery timeline looks like. Reference specific mechanisms (dopamine loops, habit cue-routine-reward, etc.) 3-5 sentences.",
  "common_triggers": ["Boredom", "Anxiety", "Procrastination avoidance", "Social comparison"],
  "warning_signs": ["Stress increases", "Switching to a different platform", "Using at unusual times"],
  "confidence": 0.95,
  "intervention_hour": 15
}

Need categories: boredom_dopamine / stress_anxiety / social_ritual / 
impulsivity_gratification / avoidance_procrastination / comfort_oral

Rules:
- dedupe_key: REQUIRED. Lowercase snake_case identifier — the SAME key for every slang variant of one behaviour (e.g. masturbating, fapping, jerking off → dedupe_key "masturbation"). Used only for duplicate detection; must stay stable across calls.
- normalised_name: A clear, neutral clinical title. Map slang, euphemisms, abbreviations, and common misspellings to ONE canonical label for the same underlying habit (e.g. "fapping", "jerking off", "rubbing one out" → one consistent name; "procrasting", "procrastination" → "Procrastination"). Same behaviour must always get the same normalised_name so the app can dedupe paths.
- intervention_hour: Extract the most likely local hour (0-23) when the urge hits based on urge_timing and trigger/description. Examples: "around 3pm" → 15, "after lunch" → 13, "late at night" → 22, "morning" → 8. Return null if no specific time can be inferred.
- primary_need_category: Choose the PRIMARY one if multiple apply
- evidence_base: Must reference actual mechanisms, not generic advice
- Never return "avoid X" or "don't do X" in replacement_directions — always positive actions
- confidence under 0.70 means the input was ambiguous
"""


def _fallback_interest(raw_text: str) -> dict:
    return {
        "normalised_name": raw_text.strip().title(),
        "category": "Other",
        "mission_domain": raw_text.strip().lower(),
        "level_context": {
            "beginner": "Focus on building the basic habit of showing up for this.",
            "intermediate": "Focus on consistency and producing output.",
            "advanced": "Focus on pushing the edge of your current capability.",
        },
        "evidence_base": (
            "Consistent deliberate practice with progressive difficulty is the most evidence-backed "
            "approach for skill development across domains."
        ),
        "progression_milestones": [],
        "common_obstacles": ["Inconsistency", "Lack of clear goals"],
        "mission_varieties": ["Practice session", "Study", "Application"],
        "confidence": 0.5,
        "fallback": True,
    }


def _fallback_quit_target(raw_text: str) -> dict:
    slug = raw_text.strip().lower().replace(" ", "_").replace("-", "_")[:80]
    return {
        "normalised_name": raw_text.strip().title(),
        "dedupe_key": slug or "habit",
        "primary_need_category": "boredom_dopamine",
        "need_reasoning": "Insufficient signal to classify. Defaulting to a novelty/dopamine loop pattern.",
        "replacement_directions": ["Physical movement", "Intentional social connection", "Active learning", "Creative output"],
        "phase_guidance": {p: "Focus on awareness and small positive replacements." for p in INTEREST_PHASES},
        "evidence_base": (
            "Habit change is best supported by identifying cues and rewards, then building replacement actions "
            "that satisfy the same underlying need with less cost."
        ),
        "common_triggers": [],
        "warning_signs": [],
        "confidence": 0.5,
        "fallback": True,
        "intervention_hour": None,
    }


def _safe_parse_json(content: str) -> dict | None:
    try:
        return json.loads(content)
    except Exception:
        return None


async def normalise_interest(
    raw_text: str,
    level_text: str,
    user_goal: str | None = None,
) -> dict:
    """
    Normalise a free-text interest into structured domain knowledge.

    Args:
        raw_text:   What the user typed e.g. "I want to learn guitar"
        level_text: Their self-reported level e.g. "still_figuring_it_out"
        user_goal:  Their stated goal for this interest (optional)

    Returns:
        dict with normalised_name, category, mission_domain, level_context,
        evidence_base, progression_milestones, common_obstacles,
        mission_varieties, confidence
    """
    raw_text = (raw_text or "").strip()
    level_text = (level_text or "").strip()
    user_goal = (user_goal or "").strip() or None

    if not raw_text:
        result = _fallback_interest("unknown")
        result["needs_review"] = True
        return result

    try:
        raw_text, level_text, user_goal_clean = validate_interest_input(
            raw_text,
            level_text,
            user_goal or "",
        )
        user_goal = user_goal_clean.strip() or None
    except InterestValidationError as e:
        logger.info(
            json.dumps(
                {
                    "event": "interest_input_rejected",
                    "reason": str(e),
                    "is_self_harm": e.is_self_harm,
                }
            )
        )
        if e.is_self_harm:
            return {
                **_fallback_interest(raw_text or "unknown"),
                "rejected": True,
                "rejection_reason": "self_harm",
            }
        return {
            **_fallback_interest(raw_text or "unknown"),
            "rejected": True,
            "rejection_reason": str(e),
        }

    level_meta = INTEREST_LEVEL_MAP.get(level_text)
    level_hint = f"{level_text} ({level_meta['description']})" if level_meta else level_text

    parts = [
        f"raw_text: {raw_text}",
        f"level_text: {level_hint}",
    ]
    if user_goal:
        parts.append(f"user_goal: {user_goal}")

    user_message = "\n".join(parts)

    try:
        response = await llm.ainvoke(
            [
                SystemMessage(content=NORMALISATION_SYSTEM_PROMPT),
                HumanMessage(content=user_message),
            ]
        )
        parsed = _safe_parse_json((response.content or "").strip())
        if not isinstance(parsed, dict):
            raise ValueError("LLM did not return valid JSON object")

        parsed = validate_normalised_interest(parsed, raw_text)
        if parsed is None:
            logger.info(
                json.dumps(
                    {
                        "event": "interest_normalise_output_invalid",
                        "raw_preview": raw_text[:50],
                    }
                )
            )
            return _fallback_interest(raw_text)

        confidence = float(parsed.get("confidence", 0.0) or 0.0)
        logger.info(
            json.dumps(
                {
                    "event": "interest_normalised",
                    "confidence": round(confidence, 2),
                    "raw_preview": raw_text[:50],
                }
            )
        )

        if confidence < 0.70:
            parsed["needs_review"] = True

        return parsed
    except Exception as e:
        logger.warning(
            json.dumps(
                {
                    "event": "interest_normalise_failed",
                    "raw_preview": raw_text[:50],
                    "error": str(e)[:200],
                }
            )
        )
        return _fallback_interest(raw_text)


async def normalise_quit_target(
    raw_text: str,
    description: str | None = None,
    trigger: str | None = None,
) -> dict:
    raw_text = (raw_text or "").strip()
    description = (description or "").strip() or None
    trigger = (trigger or "").strip() or None

    if not raw_text:
        result = _fallback_quit_target("unknown")
        result["needs_review"] = True
        return result

    try:
        raw_text, description, trigger = validate_quit_input(
            raw_text,
            description or "",
            trigger or "",
        )
        description = description.strip() or None
        trigger = trigger.strip() or None
    except InterestValidationError as e:
        logger.info(
            json.dumps(
                {
                    "event": "quit_input_rejected",
                    "reason": str(e),
                    "is_self_harm": e.is_self_harm,
                }
            )
        )
        if e.is_self_harm:
            return {
                **_fallback_quit_target(raw_text or "unknown"),
                "rejected": True,
                "rejection_reason": "self_harm",
            }
        return {
            **_fallback_quit_target(raw_text or "unknown"),
            "rejected": True,
            "rejection_reason": str(e),
        }

    parts = [f"raw_text: {raw_text}"]
    if description:
        parts.append(f"description: {description}")
    if trigger:
        parts.append(f"trigger: {trigger}")
    user_message = "\n".join(parts)

    try:
        response = await llm.ainvoke(
            [
                SystemMessage(content=QUIT_NORMALISATION_PROMPT),
                HumanMessage(content=user_message),
            ]
        )
        parsed = _safe_parse_json((response.content or "").strip())
        if not isinstance(parsed, dict):
            raise ValueError("LLM did not return valid JSON object")

        parsed = validate_normalised_quit(parsed, raw_text)
        if parsed is None:
            return _fallback_quit_target(raw_text)

        confidence = float(parsed.get("confidence", 0.0) or 0.0)
        logger.info(
            json.dumps(
                {
                    "event": "quit_normalised",
                    "confidence": round(confidence, 2),
                    "raw_preview": raw_text[:50],
                }
            )
        )

        if confidence < 0.70:
            parsed["needs_review"] = True

        return parsed
    except Exception as e:
        logger.warning(
            json.dumps(
                {
                    "event": "quit_normalise_failed",
                    "raw_preview": raw_text[:50],
                    "error": str(e)[:200],
                }
            )
        )
        return _fallback_quit_target(raw_text)

