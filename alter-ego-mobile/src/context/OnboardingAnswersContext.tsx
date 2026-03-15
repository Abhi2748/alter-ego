/**
 * Onboarding answers accumulated Q1→Q13. Consumed by OnboardingQuestionScreen
 * and passed to ArchetypeRevealScreen after Q13. archetype_content from POST /onboarding.
 */

import React, { createContext, useContext, useCallback, useState } from "react";
import type { ArchetypeContent } from "../utils/api";

/** One interest from Q11 — full object for Planner. */
export type OnboardingInterest = {
  name: string;
  level: "beginner" | "intermediate" | "advanced";
  goal: string;
  schedule: number[]; // 0=Mon … 6=Sun; we convert to ["mon","wed","fri"] for API
};

/** One quit target from Q12 — full object for Planner. */
export type OnboardingQuitTarget = {
  name: string;
  description: string;
  trigger: string;
};

/** @deprecated Use OnboardingInterest. Kept for type compatibility during migration. */
export type OnboardingInterestItem = {
  name: string;
  level: "Still figuring it out" | "Getting the hang of it" | "Pretty solid";
  learning_goal: string;
  schedule?: number[];
};

export type OnboardingAnswers = {
  username?: string;
  gender?: "male" | "female" | "other";
  ageRange?: string;
  situation?: string;
  reason?: string;
  taskApproach?: string;
  offTrack?: string;
  motivation?: string;
  autonomy?: string;
  comparison?: string;
  /** Q11: full interest objects (min 1 required). */
  interests?: OnboardingInterest[];
  interestOther?: string;
  /** Q12: full quit target objects (optional, can be []). */
  quitTargets?: OnboardingQuitTarget[];
  quitOther?: string;
  dailyHours?: number;
  commitmentTimeline?: string;
};

type OnboardingAnswersContextValue = {
  answers: OnboardingAnswers;
  updateAnswer: (key: keyof OnboardingAnswers, value: OnboardingAnswers[keyof OnboardingAnswers]) => void;
  getAnswer: (key: keyof OnboardingAnswers) => OnboardingAnswers[keyof OnboardingAnswers];
  /** Restore full answers from persisted draft (e.g. after app reopen). */
  hydrateAnswers: (answers: OnboardingAnswers) => void;
  /** Set after POST /onboarding; read by ArchetypeRevealScreen. */
  archetypeContent: ArchetypeContent | null;
  setArchetypeContent: (content: ArchetypeContent | null) => void;
};

const defaultAnswers: OnboardingAnswers = {};

const Context = createContext<OnboardingAnswersContextValue | null>(null);

export function OnboardingAnswersProvider({ children }: { children: React.ReactNode }) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(defaultAnswers);
  const [archetypeContent, setArchetypeContent] = useState<ArchetypeContent | null>(null);

  const updateAnswer = useCallback((key: keyof OnboardingAnswers, value: OnboardingAnswers[keyof OnboardingAnswers]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getAnswer = useCallback(
    (key: keyof OnboardingAnswers) => answers[key],
    [answers]
  );

  const hydrateAnswers = useCallback((next: OnboardingAnswers) => {
    setAnswers((prev) => ({ ...prev, ...next }));
  }, []);

  const value: OnboardingAnswersContextValue = {
    answers,
    updateAnswer,
    getAnswer,
    hydrateAnswers,
    archetypeContent,
    setArchetypeContent,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOnboardingAnswers(): OnboardingAnswersContextValue {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useOnboardingAnswers must be used within OnboardingAnswersProvider");
  return ctx;
}
