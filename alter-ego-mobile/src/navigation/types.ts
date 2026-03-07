/**
 * Navigation param lists. CLAUDE.md §7.
 */

export type RootStackParamList = {
  Splash: undefined;
  SignUp: undefined;
  Onboarding: undefined;
  Main: undefined;
};

import type { OnboardingAnswers } from "../context/OnboardingAnswersContext";

export type OnboardingStackParamList = {
  OnboardingFraming: undefined;
  OnboardingQuestion: { questionNumber: number; fromBack?: boolean } | undefined;
  ArchetypeReveal: { answers?: OnboardingAnswers };
  TwinIntroduction: { archetype?: string; twinFirstMessage?: string; gender?: "male" | "female" | "other" } | undefined;
};

export type MainTabParamList = {
  Home: { journalJustCompleted?: boolean } | undefined;
  Leaderboard: undefined;
  Twin: undefined;
  Report: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  TwinChat: undefined;
  RankCard: undefined;
  Paywall: undefined;
  JournalEditor:
    | undefined
    | { viewMode?: "edit" | "read"; entryDate?: string; entryText?: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileStats: undefined;
  ProfileStreak: undefined;
  ProfileTitles: undefined;
  ProfileInterests: undefined;
};
