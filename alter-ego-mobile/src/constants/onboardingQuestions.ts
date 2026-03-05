/**
 * Onboarding Q1–Q13: exact copy for Screen 04–16. CLAUDE §3A.
 * Answer keys match OnboardingAnswers in context.
 */

export type OnboardingInputType = "single" | "multi" | "slider";

export type OnboardingQuestionConfig = {
  questionNumber: number;
  questionText: string;
  options: string[];
  inputType: OnboardingInputType;
  answerKey: string;
  /** Slider only: [min, max, step] in hours */
  sliderRange?: [number, number, number];
};

/** Q1: value stored as 'male' | 'female' | 'other'. Other = user picks at end, defaults to Male. */
const Q1_OPTIONS = ["Male", "Female", "Other"];

/** Q2: stored as displayed string. */
const Q2_OPTIONS = ["Under 18", "18–24", "25–34", "35–44", "45+"];

const Q3_OPTIONS = [
  "Grinding hard but staying inconsistent",
  "Starting completely fresh",
  "Trying to quit something that's holding me back",
  "Looking to become a better version of myself",
];

const Q4_OPTIONS = [
  "I keep failing at habits and I'm tired of it",
  "I want to become someone genuinely different",
  "I need to quit something for good",
  "Someone showed me this",
];

const Q5_OPTIONS = [
  "Plan it out properly before starting",
  "Dive straight in and figure it out",
  "Put it off until I can't anymore",
  "Break it into the smallest possible steps",
];

const Q6_OPTIONS = [
  "Feel guilty and spiral further",
  "Shake it off and start again",
  "Use it as fuel to come back harder",
  "Pretend it didn't happen and move on",
];

const Q7_OPTIONS = [
  "I could see the progress happening",
  "I didn't want to let myself down",
  "It was genuinely enjoyable",
  "Someone was counting on me",
];

const Q8_OPTIONS = [
  "Appreciate the structure — it helps",
  "Feel a little annoyed by it",
  "Depends entirely on who's telling me",
  "Tune it out almost automatically",
];

const Q9_OPTIONS = [
  "I love it — competition drives me",
  "Indifferent — I don't think about it",
  "Mildly motivating when I'm ahead",
  "I'd rather just run my own race",
];

const Q10_OPTIONS = [
  "Fitness / Training",
  "Coding / Tech",
  "Writing",
  "Reading",
  "Art / Design",
  "Music",
  "Language learning",
  "Photography",
  "Something else",
];

const Q11_OPTIONS = [
  "Social media",
  "Gaming",
  "Junk food",
  "Alcohol",
  "Smoking",
  "Procrastinating",
  "Nothing right now",
];

/** Q12: slider 0.5h–6h, step 0.5. No options array. */
const Q12_SLIDER: [number, number, number] = [0.5, 6, 0.5];

const Q13_OPTIONS = ["2 weeks", "1 month", "3 months", "However long it takes"];

export const ONBOARDING_QUESTIONS: OnboardingQuestionConfig[] = [
  {
    questionNumber: 1,
    questionText: "Which character reflects you?",
    options: Q1_OPTIONS,
    inputType: "single",
    answerKey: "gender",
  },
  {
    questionNumber: 2,
    questionText: "How old are you?",
    options: Q2_OPTIONS,
    inputType: "single",
    answerKey: "ageRange",
  },
  {
    questionNumber: 3,
    questionText: "What's your current situation?",
    options: Q3_OPTIONS,
    inputType: "single",
    answerKey: "situation",
  },
  {
    questionNumber: 4,
    questionText: "What actually brought you here?",
    options: Q4_OPTIONS,
    inputType: "single",
    answerKey: "reason",
  },
  {
    questionNumber: 5,
    questionText: "When you have a big task ahead, your first move is...",
    options: Q5_OPTIONS,
    inputType: "single",
    answerKey: "taskApproach",
  },
  {
    questionNumber: 6,
    questionText: "When you fall off track, you usually...",
    options: Q6_OPTIONS,
    inputType: "single",
    answerKey: "offTrack",
  },
  {
    questionNumber: 7,
    questionText: "The last time you were truly consistent, what kept you going?",
    options: Q7_OPTIONS,
    inputType: "single",
    answerKey: "motivation",
  },
  {
    questionNumber: 8,
    questionText: "When someone tells you exactly what to do, you...",
    options: Q8_OPTIONS,
    inputType: "single",
    answerKey: "autonomy",
  },
  {
    questionNumber: 9,
    questionText: "How do you feel about being compared to others?",
    options: Q9_OPTIONS,
    inputType: "single",
    answerKey: "comparison",
  },
  {
    questionNumber: 10,
    questionText: "What are you actually into?",
    options: Q10_OPTIONS,
    inputType: "multi",
    answerKey: "interests",
  },
  {
    questionNumber: 11,
    questionText: "Anything you want to quit or cut back on?",
    options: Q11_OPTIONS,
    inputType: "multi",
    answerKey: "quitTargets",
  },
  {
    questionNumber: 12,
    questionText: "How many hours a day can you honestly give to your goals?",
    options: [],
    inputType: "slider",
    answerKey: "dailyHours",
    sliderRange: Q12_SLIDER,
  },
  {
    questionNumber: 13,
    questionText: "How long are you willing to commit before judging results?",
    options: Q13_OPTIONS,
    inputType: "single",
    answerKey: "commitmentTimeline",
  },
];

/** Map Q1 display label to stored value */
export function genderOptionToValue(label: string): "male" | "female" | "other" {
  const lower = label.toLowerCase();
  if (lower === "male") return "male";
  if (lower === "female") return "female";
  return "other";
}
