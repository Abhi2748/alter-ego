/**
 * Navigation param lists. CLAUDE.md §7.
 */

export type RootStackParamList = {
  Splash: undefined;
  SignUp: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type OnboardingStackParamList = {
  OnboardingFraming: undefined;
  OnboardingQuestion: { questionNumber: number } | undefined;
  ArchetypeReveal: undefined;
  TwinIntroduction: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Leaderboard: undefined;
  Twin: undefined;
  Report: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
};
