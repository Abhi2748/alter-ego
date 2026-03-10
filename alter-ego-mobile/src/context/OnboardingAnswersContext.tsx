/**
 * Onboarding answers accumulated Q1→Q13. Consumed by OnboardingQuestionScreen
 * and passed to ArchetypeRevealScreen after Q13. archetype_content from POST /onboarding.
 */

import React, { createContext, useContext, useCallback, useState } from "react";
import type { ArchetypeContent } from "../utils/api";

export type OnboardingAnswers = {
  gender?: "male" | "female" | "other";
  ageRange?: string;
  situation?: string;
  reason?: string;
  taskApproach?: string;
  offTrack?: string;
  motivation?: string;
  autonomy?: string;
  comparison?: string;
  interests?: string[];
  interestOther?: string;
  quitTargets?: string[];
  dailyHours?: number;
  commitmentTimeline?: string;
};

type OnboardingAnswersContextValue = {
  answers: OnboardingAnswers;
  updateAnswer: (key: keyof OnboardingAnswers, value: OnboardingAnswers[keyof OnboardingAnswers]) => void;
  getAnswer: (key: keyof OnboardingAnswers) => OnboardingAnswers[keyof OnboardingAnswers];
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

  const value: OnboardingAnswersContextValue = {
    answers,
    updateAnswer,
    getAnswer,
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
