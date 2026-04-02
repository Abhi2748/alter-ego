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

export type InterestNormalisationRejection = {
  rejection_type: "self_harm" | "redirect_to_quit" | "invalid_input";
  message: string;
};

export type ArchetypeRevealResult = {
  archetype: string;
  archetype_name: string;
  archetype_tagline: string;
  archetype_reveal_message: string;
  twin_first_message?: string;
  interests_processed: number;
  quit_targets_processed: number;
  interest_rejections?: InterestNormalisationRejection[];
  self_harm_interest_detected?: boolean;
};

export type OnboardingStackParamList = {
  OnboardingFraming: undefined;
  OnboardingQuestion: { questionNumber: number; fromBack?: boolean } | undefined;
  ArchetypeReveal: { answers?: OnboardingAnswers; archetypeResult?: ArchetypeRevealResult };
  Onboarding7Day: { archetype?: string } | undefined;
  TwinForming: { archetype?: string } | undefined;
  /** Twin card copy is resolved on-screen from archetype (not commitment-question API line). */
  TwinIntroduction: { archetype?: string; gender?: "male" | "female" | "other" } | undefined;
  OnboardingSafetySupport: { archetypeResult?: ArchetypeRevealResult } | undefined;
  NotificationPermission: undefined;
};

export type MainTabParamList = {
  Home: { journalJustCompleted?: boolean } | undefined;
  Today: undefined;
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
  /** Community feedback board */
  CommunityBoard: undefined;
  NewPost: undefined;
  /** In-app FAQ from GET /api/v1/settings/faq */
  SettingsFaq: undefined;
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
  JournalEditor: {
    entry_id: string | null;
    read_only: boolean;
    /** YYYY-MM-DD for a new entry (defaults to today's mission date from Home). */
    mission_date?: string;
  };
  JournalCalendar: undefined;
  MissionDetail: {
    missionId: string;
  };
  SigilScreen: undefined;
  /** Full-screen gap moment — also used as overlay from App; optional stack route. */
  GapMoment: undefined;
  Leaderboard: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileAbilities: undefined;
  ProfileStreak: undefined;
  ProfileInterests: undefined;
  ProfileIdentity: undefined;
  ProfileCompanion: undefined;
  ProfileQuits: undefined;
};
