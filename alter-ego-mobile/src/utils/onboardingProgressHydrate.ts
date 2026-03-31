/**
 * Maps GET /api/v1/onboarding/progress answers back into OnboardingAnswers
 * and computes the first incomplete question (1–15) for resume-after-kill.
 *
 * Must stay in sync with save payloads in OnboardingQuestionScreen (QUESTION_KEYS).
 */

import type {
  OnboardingAnswers,
  OnboardingInterest,
  OnboardingQuitTarget,
} from "@/context/OnboardingAnswersContext";
import type { AwarenessLevel, QuitGoal } from "@/types/quits";

/** Backend question_key per step (Q16 timezone saved with Q15 submit). */
const QUESTION_KEYS: Record<number, string> = {
  1: "q1_username",
  2: "q2_gender",
  3: "q3_age",
  4: "q4_situation",
  5: "q5_reason",
  6: "q6_alarm",
  7: "q7_missed_day",
  8: "q8_doubt",
  9: "q9_success",
  10: "q10_failure",
  11: "q11_discipline",
  12: "q12_interests",
  13: "q13_quits",
  14: "q14_hours",
};

/** Legacy keys (pre–profiler redesign) for resume on older drafts. */
const LEGACY_SCENARIO_KEYS: Record<number, string> = {
  6: "q6_approach",
  7: "q7_recovery",
  8: "q8_motivation",
  9: "q9_autonomy",
  10: "q10_comparison",
};

const API_TO_LEVEL: Record<string, "beginner" | "intermediate" | "advanced"> = {
  still_figuring_it_out: "beginner",
  getting_the_hang_of_it: "intermediate",
  pretty_solid: "advanced",
};

function strVal(j: Record<string, unknown> | undefined): string | undefined {
  const v = j?.value;
  return typeof v === "string" ? v : undefined;
}

function numVal(j: Record<string, unknown> | undefined): number | undefined {
  const v = j?.value;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function intToAgeRange(n: number): string {
  if (n <= 17) return "Under 18";
  if (n <= 27) return "18–24";
  if (n <= 39) return "25–34";
  if (n <= 49) return "35–44";
  return "45+";
}

function commitmentApiToLabel(v: string): string {
  const m: Record<string, string> = {
    "2_weeks": "2 weeks",
    "1_month": "1 month",
    "3_months": "3 months",
    however_long: "However long it takes",
  };
  return m[v] ?? "However long it takes";
}

function mapInterestFromApi(raw: unknown): OnboardingInterest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.raw_text === "string" ? o.raw_text : null;
  if (!name) return null;
  const levelText = typeof o.level_text === "string" ? o.level_text : "still_figuring_it_out";
  const level = API_TO_LEVEL[levelText] ?? "beginner";
  const goal = typeof o.goal === "string" ? o.goal : "";
  let schedule: number[] | undefined;
  if (Array.isArray(o.active_days)) {
    schedule = o.active_days
      .map((d) => (typeof d === "number" ? d - 1 : NaN))
      .filter((d) => !Number.isNaN(d) && d >= 0 && d <= 6);
  }
  return {
    name,
    level,
    goal,
    schedule: schedule?.length ? schedule : [0, 1, 2, 3, 4, 5, 6],
  };
}

function mapQuitFromApi(raw: unknown): OnboardingQuitTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.raw_text === "string" ? o.raw_text : null;
  if (!name) return null;
  const ctxRaw = o.contexts;
  const contexts = Array.isArray(ctxRaw)
    ? ctxRaw.filter((x): x is string => typeof x === "string")
    : [];
  const aw = o.awareness;
  const awareness: AwarenessLevel =
    aw === "subconscious" || aw === "semi_conscious" || aw === "conscious" ? aw : "semi_conscious";
  const g = o.quit_goal;
  const quit_goal: QuitGoal =
    g === "stop_completely" || g === "reduce_significantly" || g === "make_conscious"
      ? g
      : "stop_completely";
  return {
    name,
    description: typeof o.description === "string" ? o.description : "",
    trigger: typeof o.trigger === "string" ? o.trigger : "",
    contexts,
    awareness,
    quit_goal,
  };
}

const Q4_TO_11_CLIENT: Record<number, keyof OnboardingAnswers> = {
  4: "situation",
  5: "reason",
  6: "alarmScenario",
  7: "missedDay",
  8: "doubtResponse",
  9: "successPattern",
  10: "failurePattern",
  11: "disciplineMeaning",
};

/**
 * Hydrate client answers from server `answers` map (question_key → answer_json).
 */
export function serverProgressToClientAnswers(
  answers: Record<string, Record<string, unknown>>
): OnboardingAnswers {
  const out: OnboardingAnswers = {};

  const u = strVal(answers.q1_username);
  if (u) out.username = u;

  const g = strVal(answers.q2_gender);
  if (g === "male" || g === "female" || g === "other") out.gender = g;

  const age = numVal(answers.q3_age);
  if (age !== undefined) out.ageRange = intToAgeRange(age);

  for (let q = 4; q <= 11; q++) {
    const primaryKey = QUESTION_KEYS[q];
    const legacyKey = LEGACY_SCENARIO_KEYS[q];
    let stored = strVal(answers[primaryKey]);
    if (!stored && legacyKey) {
      stored = strVal(answers[legacyKey]);
    }
    if (!stored) continue;
    const clientKey = Q4_TO_11_CLIENT[q];
    (out as Record<string, unknown>)[clientKey] = stored;
  }

  const qInterests = answers.q12_interests ?? answers.q11_interests;
  if (qInterests && typeof qInterests === "object") {
    const list = (qInterests as { interests?: unknown }).interests;
    if (Array.isArray(list)) {
      const interests: OnboardingInterest[] = [];
      for (const item of list) {
        const m = mapInterestFromApi(item);
        if (m) interests.push(m);
      }
      if (interests.length) out.interests = interests;
    }
  }

  const qQuits = answers.q13_quits ?? answers.q12_quits;
  if (qQuits && typeof qQuits === "object") {
    const list = (qQuits as { quit_targets?: unknown }).quit_targets;
    if (Array.isArray(list)) {
      const quits: OnboardingQuitTarget[] = [];
      for (const item of list) {
        const m = mapQuitFromApi(item);
        if (m) quits.push(m);
      }
      out.quitTargets = quits;
    }
  }

  const hours = numVal(answers.q14_hours) ?? numVal(answers.q13_hours);
  if (hours !== undefined) out.dailyHours = hours;

  const c = strVal(answers.q15_commitment) ?? strVal(answers.q14_commitment);
  if (c) out.commitmentTimeline = commitmentApiToLabel(c);

  return out;
}

function isStepComplete(
  step: number,
  answers: Record<string, Record<string, unknown>>
): boolean {
  if (step < 1 || step > 14) return false;
  const key = QUESTION_KEYS[step];
  const j = answers[key];
  if (!j || typeof j !== "object") return false;

  if (step === 1) return !!strVal(j)?.trim();
  if (step === 2) return !!strVal(j);
  if (step === 3) return numVal(j) !== undefined;
  if (step >= 4 && step <= 11) {
    const legacy = LEGACY_SCENARIO_KEYS[step];
    const v = strVal(j) ?? (legacy ? strVal(answers[legacy]) : undefined);
    if (!v?.trim()) return false;
    if (step === 5) return v.trim().length >= 10;
    if (step === 11) return v.trim().length >= 8;
    return true;
  }
  if (step === 12) {
    const interests = (j as { interests?: unknown }).interests;
    return Array.isArray(interests) && interests.length >= 1;
  }
  if (step === 13) {
    return Array.isArray((j as { quit_targets?: unknown }).quit_targets);
  }
  if (step === 14) return numVal(j) !== undefined;
  return false;
}

/**
 * First question index (1–15) to show, or `null` if user should leave onboarding for Main.
 */
export function getResumeQuestionNumber(
  answers: Record<string, Record<string, unknown>>,
  onboardingComplete: boolean
): number | null {
  if (onboardingComplete) return null;

  for (let n = 1; n <= 14; n++) {
    if (!isStepComplete(n, answers)) return n;
  }

  return 15;
}
