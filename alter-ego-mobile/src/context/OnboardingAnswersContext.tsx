/**
 * Onboarding answers accumulated Q1→Q13. Consumed by OnboardingQuestionScreen
 * and passed to ArchetypeRevealScreen after Q13. archetype_content from POST /onboarding.
 */

import React, { createContext, useContext, useCallback, useState } from "react";
import type { ArchetypeContent } from "../utils/api";

/** One interest in the add-interest flow (name + self-reported level + learning goal). */
export type OnboardingInterestItem = {
  name: string;
  level: "Still figuring it out" | "Getting the hang of it" | "Pretty solid";
  learning_goal: string;
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
  /** Populated by add-interest flow (Q11). Sent as interest_levels + interests to backend. */
  interestItems?: OnboardingInterestItem[];
  /** Legacy / derived: list of interest names for API. */
  interests?: string[];
  interestOther?: string;
  quitTargets?: string[];
  /** Free text when "Something else" is selected on quit question. */
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
