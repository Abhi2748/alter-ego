/**
 * Onboarding Q1–Q15 visible; Q16 timezone is auto-saved after Q15 (no UI).
 * Username, gender, age, scenario Q4–Q11, interests, quits, hours, commitment horizon.
 */

export type OnboardingInputType =
  | "single"
  | "multi"
  | "slider"
  | "username"
  | "interests_add"
  | "quit_with_other"
  | "open_text";

export type OnboardingQuestionConfig = {
  questionNumber: number;
  questionText: string;
  options: string[];
  inputType: OnboardingInputType;
  answerKey: string;
  /** Slider only: [min, max, step] in hours */
  sliderRange?: [number, number, number];
  /** Open text only */
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
};

/** Q2: value stored as 'male' | 'female' | 'other'. Other = user picks at end, defaults to Male. */
const Q2_OPTIONS = ["Male", "Female", "Other"];

/** Q3: stored as displayed string. */
const Q3_OPTIONS = ["Under 18", "18–24", "25–34", "35–44", "45+"];

const Q4_OPTIONS = [
  "Rebuilding after a rough patch",
  "Feeling stuck and want to break out",
  "Things are fine but I want more",
  "Starting something completely new",
  "Honestly, kind of lost",
];

const Q6_OPTIONS = [
  "I get up, no question",
  "I bargain — 5 more minutes, then maybe go",
  "I skip it and feel guilty all day",
  "I skip it and don't think twice",
  "Depends entirely on the day",
];

const Q7_OPTIONS = [
  "Reset and go harder tomorrow",
  "Beat myself up but eventually get back",
  "The streak's broken, so what's the point",
  "Shrug it off — one day doesn't define me",
  "I probably won't notice until later",
];

const Q8_OPTIONS = [
  "Fired up — I'll prove them wrong",
  "Hurt but it motivates me",
  "Honestly, they're probably right",
  "I don't care what they think",
  "Annoyed — mind your own business",
];

const Q9_OPTIONS = [
  "I had someone pushing me or keeping me accountable",
  "I wanted it badly enough that nothing else mattered",
  "I had a clear plan and just followed the steps",
  "External pressure — deadline, stakes, consequences",
  "Honestly, I'm not sure I have",
];

const Q10_OPTIONS = [
  "I start strong but fade after a couple weeks",
  "I'm consistent but never push myself hard enough",
  "I overthink everything and struggle to start",
  "I do well with structure but rebel against strict rules",
  "I need someone watching or I slack off",
];

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

/** Q14: minimum guaranteed daily time — 0.5h–3h, step 0.5. Planner floor, not cap. */
const Q14_SLIDER: [number, number, number] = [0.5, 3, 0.5];

const Q15_OPTIONS = ["2 weeks", "1 month", "3 months", "However long it takes"];

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
    questionText: "What's going on in your life right now?",
    options: Q4_OPTIONS,
    inputType: "single",
    answerKey: "situation",
  },
  {
    questionNumber: 5,
    questionText: "Why are you here? Be honest — no wrong answer.",
    options: [],
    inputType: "open_text",
    answerKey: "reason",
    placeholder: "I keep saying I'll start but never do",
    minLength: 10,
    maxLength: 500,
  },
  {
    questionNumber: 6,
    questionText:
      "It's 6AM. Your alarm goes off for the workout you planned. It's cold. Your bed is warm. What actually happens?",
    options: Q6_OPTIONS,
    inputType: "single",
    answerKey: "alarmScenario",
  },
  {
    questionNumber: 7,
    questionText: "You've been consistent for 2 weeks. Then you miss a day. What happens next?",
    options: Q7_OPTIONS,
    inputType: "single",
    answerKey: "missedDay",
  },
  {
    questionNumber: 8,
    questionText: "Someone close to you says 'I don't think you'll stick with this.' What do you feel?",
    options: Q8_OPTIONS,
    inputType: "single",
    answerKey: "doubtResponse",
  },
  {
    questionNumber: 9,
    questionText: "When you've succeeded at something hard before, what was the real reason?",
    options: Q9_OPTIONS,
    inputType: "single",
    answerKey: "successPattern",
  },
  {
    questionNumber: 10,
    questionText: "Pick the one that sounds most like you:",
    options: Q10_OPTIONS,
    inputType: "single",
    answerKey: "failurePattern",
  },
  {
    questionNumber: 11,
    questionText: "What does discipline actually mean to you?",
    options: [],
    inputType: "open_text",
    answerKey: "disciplineMeaning",
    placeholder: "Showing up even when I don't feel like it",
    minLength: 8,
    maxLength: 300,
  },
  {
    questionNumber: 12,
    questionText: "What are you actually into?",
    options: [],
    inputType: "interests_add",
    answerKey: "interests",
  },
  {
    questionNumber: 13,
    questionText: "Anything you want to quit or cut back on?",
    options: Q12_OPTIONS,
    inputType: "quit_with_other",
    answerKey: "quitTargets",
  },
  {
    questionNumber: 14,
    questionText: "What's the minimum time you can guarantee every day?",
    options: [],
    inputType: "slider",
    answerKey: "dailyHours",
    sliderRange: Q14_SLIDER,
  },
  {
    questionNumber: 15,
    questionText: "How long are you willing to commit before judging results?",
    options: Q15_OPTIONS,
    inputType: "single",
    answerKey: "commitmentTimeline",
  },
];

export const TOTAL_ONBOARDING_QUESTIONS = 15;

/** Map Q2 (gender) display label to stored value */
export function genderOptionToValue(label: string): "male" | "female" | "other" {
  const lower = label.toLowerCase();
  if (lower === "male") return "male";
  if (lower === "female") return "female";
  return "other";
}
