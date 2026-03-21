/**
 * Onboarding Q1–Q14 visible; Q15 timezone is auto-saved after Q14 (no UI).
 * Username, gender, age, archetype Q4–Q10, interests, quits, hours, commitment horizon.
 */

export type OnboardingInputType = "single" | "multi" | "slider" | "username" | "interests_add" | "quit_with_other";

export type OnboardingQuestionConfig = {
  questionNumber: number;
  questionText: string;
  options: string[];
  inputType: OnboardingInputType;
  answerKey: string;
  /** Slider only: [min, max, step] in hours */
  sliderRange?: [number, number, number];
};

/** Q2: value stored as 'male' | 'female' | 'other'. Other = user picks at end, defaults to Male. */
const Q2_OPTIONS = ["Male", "Female", "Other"];

/** Q3: stored as displayed string. */
const Q3_OPTIONS = ["Under 18", "18–24", "25–34", "35–44", "45+"];

const Q4_OPTIONS = [
  "Grinding hard but staying inconsistent",
  "Starting completely fresh",
  "Trying to quit something that's holding me back",
  "Looking to become a better version of myself",
  "I'm in a solid season — I want to sharpen my edge and keep winning",
];

const Q5_OPTIONS = [
  "I keep failing at habits and I'm tired of it",
  "I want to become someone genuinely different",
  "I want to prove to others that I can do this",
  "I want to build something meaningful for my future",
  "I want to level up and perform better",
];

const Q6_OPTIONS = [
  "Plan it out properly before starting",
  "Dive straight in and figure it out",
  "Put it off until I can't anymore",
  "Break it into the smallest possible steps",
  "First I set up accountability — a check-in, partner, or hard deadline",
];

const Q7_OPTIONS = [
  "Feel guilty and spiral further",
  "Shake it off and start again",
  "Use it as fuel to come back harder",
  "Pretend it didn't happen and move on",
  "I lock in harder so I don't miss again",
];

const Q8_OPTIONS = [
  "I could see the progress happening",
  "I didn't want to let myself down",
  "It was genuinely enjoyable",
  "Someone was counting on me",
  "Competing with others kept me sharp",
];

const Q9_OPTIONS = [
  "Appreciate the structure — it helps",
  "Feel a little annoyed by it",
  "Depends entirely on who's telling me",
  "I work best with a clear structure and plan",
  "Fine by me — I do better when they stay involved and check I'm executing",
];

const Q10_OPTIONS = [
  "I love it — competition drives me",
  "Indifferent — I don't think about it",
  "Mildly motivating when I'm ahead",
  "Comparisons usually make me uncomfortable",
  "I use comparison as a benchmark to improve",
];

/** Q11: interests — no fixed options; "Add interest" flow with 3 sub-questions per interest. */

/** Q12: quit — "Nothing right now" and "Something else" at the end; Something else last. */
const Q12_OPTIONS = [
  "Social media",
  "Gaming",
  "Junk food",
  "Alcohol",
  "Smoking",
  "Procrastinating",
  "Nothing right now",
  "Something else",
];

/** Q13: minimum guaranteed daily time — 0.5h–3h, step 0.5. Planner floor, not cap. */
const Q13_SLIDER: [number, number, number] = [0.5, 3, 0.5];

const Q14_OPTIONS = ["2 weeks", "1 month", "3 months", "However long it takes"];

/** Interest level options for add-interest flow (self-reported). */
export const INTEREST_LEVEL_OPTIONS = [
  "Still figuring it out",
  "Getting the hang of it",
  "Pretty solid",
] as const;
export type InterestLevelOption = (typeof INTEREST_LEVEL_OPTIONS)[number];

export const ONBOARDING_QUESTIONS: OnboardingQuestionConfig[] = [
  {
    questionNumber: 1,
    questionText: "What should we call you?",
    options: [],
    inputType: "username",
    answerKey: "username",
  },
  {
    questionNumber: 2,
    questionText: "Which character reflects you?",
    options: Q2_OPTIONS,
    inputType: "single",
    answerKey: "gender",
  },
  {
    questionNumber: 3,
    questionText: "How old are you?",
    options: Q3_OPTIONS,
    inputType: "single",
    answerKey: "ageRange",
  },
  {
    questionNumber: 4,
    questionText: "What's your current situation?",
    options: Q4_OPTIONS,
    inputType: "single",
    answerKey: "situation",
  },
  {
    questionNumber: 5,
    questionText: "What actually brought you here?",
    options: Q5_OPTIONS,
    inputType: "single",
    answerKey: "reason",
  },
  {
    questionNumber: 6,
    questionText: "When you have a big task ahead, your first move is...",
    options: Q6_OPTIONS,
    inputType: "single",
    answerKey: "taskApproach",
  },
  {
    questionNumber: 7,
    questionText: "When you fall off track, you usually...",
    options: Q7_OPTIONS,
    inputType: "single",
    answerKey: "offTrack",
  },
  {
    questionNumber: 8,
    questionText: "The last time you were truly consistent, what kept you going?",
    options: Q8_OPTIONS,
    inputType: "single",
    answerKey: "motivation",
  },
  {
    questionNumber: 9,
    questionText: "When someone tells you exactly what to do, you...",
    options: Q9_OPTIONS,
    inputType: "single",
    answerKey: "autonomy",
  },
  {
    questionNumber: 10,
    questionText: "How do you feel about being compared to others?",
    options: Q10_OPTIONS,
    inputType: "single",
    answerKey: "comparison",
  },
  {
    questionNumber: 11,
    questionText: "What are you actually into?",
    options: [],
    inputType: "interests_add",
    answerKey: "interests",
  },
  {
    questionNumber: 12,
    questionText: "Anything you want to quit or cut back on?",
    options: Q12_OPTIONS,
    inputType: "quit_with_other",
    answerKey: "quitTargets",
  },
  {
    questionNumber: 13,
    questionText: "What's the minimum time you can guarantee every day?",
    options: [],
    inputType: "slider",
    answerKey: "dailyHours",
    sliderRange: Q13_SLIDER,
  },
  {
    questionNumber: 14,
    questionText: "How long are you willing to commit before judging results?",
    options: Q14_OPTIONS,
    inputType: "single",
    answerKey: "commitmentTimeline",
  },
];

export const TOTAL_ONBOARDING_QUESTIONS = 14;

/** Map Q2 (gender) display label to stored value */
export function genderOptionToValue(label: string): "male" | "female" | "other" {
  const lower = label.toLowerCase();
  if (lower === "male") return "male";
  if (lower === "female") return "female";
  return "other";
}
