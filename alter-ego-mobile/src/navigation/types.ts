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
  Onboarding14Day: { twinFirstMessage?: string; archetype?: string } | undefined;
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
  SettingsProfile: undefined;
  AccountSettings: undefined;
  ContactUs: undefined;
  ToneHistory: undefined;
  TwinChat: undefined;
  RankCard: undefined;
  PastReportDetail: { report_id: string };
  Paywall: { dismissable?: boolean } | undefined;
  SubscriptionManagement: undefined;
  JournalList: undefined;
  JournalEditor: { entry_id: string | null; read_only: boolean };
  JournalCalendar: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileStats: undefined;
  ProfileStreak: undefined;
  ProfileTitles: undefined;
  ProfileInterests: undefined;
};
