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

export type ArchetypeRevealResult = {
  archetype: string;
  archetype_name: string;
  archetype_tagline: string;
  archetype_reveal_message: string;
  twin_first_message?: string;
  interests_processed: number;
  quit_targets_processed: number;
};

export type OnboardingStackParamList = {
  OnboardingFraming: undefined;
  OnboardingQuestion: { questionNumber: number; fromBack?: boolean } | undefined;
  ArchetypeReveal: { answers?: OnboardingAnswers; archetypeResult?: ArchetypeRevealResult };
  Onboarding7Day: { archetype?: string } | undefined;
  /** Twin card copy is resolved on-screen from archetype (not commitment-question API line). */
  TwinIntroduction: { archetype?: string; gender?: "male" | "female" | "other" } | undefined;
  NotificationPermission: undefined;
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
  MailInbox: undefined;
  ToneHistory: undefined;
  TwinChat: { initialMessage?: string } | undefined;
  RankCard: { rankPosition?: 1 | 2 | 3 } | undefined;
  ShareableCardsPreview: undefined;
  PastReportDetail: { report_id: string };
  DayDetail: { date: string };
  Paywall: { dismissable?: boolean } | undefined;
  SubscriptionManagement: undefined;
  JournalList: undefined;
  JournalEditor: { entry_id: string | null; read_only: boolean };
  JournalCalendar: undefined;
  MissionDetail: {
    mission: {
      id: string;
      type: "core" | "interest" | "resistance" | "personal";
      title: string;
      difficulty: "easy" | "medium" | "hard" | "elite";
      xp_value: number;
      pf_value: number;
      completed: boolean;
      completed_at: string | null;
      is_journal_mission: boolean;
      core_pillar: string | null;
      interest_id: string | null;
      rationale: string | null;
      domain_knowledge: string | null;
      estimated_minutes: number | null;
      mission_date: string;
    };
  };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileStats: undefined;
  ProfileStreak: undefined;
  ProfileIdentity: undefined;
  ProfileCompanion: undefined;
  ProfileInterests: undefined;
  ProfileQuits: undefined;
};
