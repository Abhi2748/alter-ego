/**
 * Mock API responses for UI preview without backend.
 * Used when EXPO_PUBLIC_USE_MOCK_API=true. Revert by setting it to false.
 */

import type {
  OnboardingResponse,
  OnboardingPayload,
  HomeOut,
  MissionCompleteOut,
  MissionOut,
  EstimatePersonalTierOut,
  CreateMissionPayload,
  TwinComparisonOut,
  UserMeOut,
  PatchUserMePayload,
  LeaderboardOut,
  WeeklyReportOut,
  WeeklyReportRow,
  JournalSavePayload,
  JournalSaveOut,
  JournalListOut,
  JournalEntryOut,
} from "./api";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_DELAY = 300;

// Reusable mock mission
const mockMission = (overrides: Partial<MissionOut> = {}): MissionOut => ({
  id: "mock-mission-1",
  user_id: "mock-user",
  type: "core",
  pillar: "sleep",
  interest: null,
  title: "Get 7+ hours of sleep",
  difficulty: "Medium",
  xp_value: 25,
  pet_food_value: 20,
  mission_streak: 2,
  completed_at: null,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  created_at: new Date().toISOString(),
  ...overrides,
});

export async function checkUsername(
  _username: string,
  _accessToken: string
): Promise<{ available: boolean }> {
  await delay(MOCK_DELAY);
  return { available: true };
}

export async function postOnboarding(
  _payload: OnboardingPayload,
  _accessToken: string
): Promise<OnboardingResponse> {
  await delay(MOCK_DELAY);
  return {
    success: true,
    message: "Onboarding complete",
    archetype: "The Structured Climber",
    archetype_content: {
      archetype: "The Structured Climber",
      description: "You love plans and respond to challenge.",
      twin_first_message:
        "Good. I'm ahead. You can close the gap — if you actually do the work.",
    },
    initial_missions: [],
  };
}

export async function getHome(_accessToken: string): Promise<HomeOut> {
  await delay(MOCK_DELAY);
  return {
    character_state: {
      stage: 2,
      total_xp: 1200,
      next_stage_xp: 5000,
      next_stage_name: "The Burning",
    },
    pet_state: {
      stage: 1,
      pet_health_state: "happy",
      total_pet_food: 450,
    },
    missions: [
      mockMission({ id: "m1", title: "Get 7+ hours of sleep", pillar: "sleep", completed_at: new Date().toISOString() }),
      mockMission({ id: "m2", title: "Move for 30 minutes", pillar: "movement" }),
      mockMission({ id: "m3", title: "Drink 8 glasses of water", pillar: "hydration" }),
      mockMission({ id: "m4", type: "interest", interest: "Running", title: "Run 2 miles" }),
    ],
    twin_strip_message: "Your rival is you — one week ahead. Show up and close the gap.",
    power_score: 1240,
    username: "preview_user",
  };
}

export async function completeMission(
  _accessToken: string,
  _missionId: string
): Promise<MissionCompleteOut> {
  await delay(MOCK_DELAY);
  const mission = mockMission({ completed_at: new Date().toISOString() });
  return {
    mission,
    character_state: {
      stage: 2,
      total_xp: 1225,
      next_stage_xp: 5000,
      next_stage_name: "The Burning",
    },
    pet_state: {
      stage: 1,
      pet_health_state: "happy",
      total_pet_food: 470,
    },
    stage_up: false,
    pet_stage_up: false,
    xp_earned: 25,
    pet_food_earned: 20,
    twin_strip_message: null,
    earned_milestone: null,
  };
}

export async function estimatePersonalTier(
  _accessToken: string,
  _title: string
): Promise<EstimatePersonalTierOut> {
  await delay(MOCK_DELAY);
  return {
    suggested_difficulty: "Medium",
    xp_value: 20,
    pet_food_value: 16,
  };
}

export async function createMission(
  _accessToken: string,
  payload: CreateMissionPayload
): Promise<MissionOut> {
  await delay(MOCK_DELAY);
  return mockMission({
    id: `mock-personal-${Date.now()}`,
    type: "personal",
    pillar: null,
    interest: null,
    title: payload.title,
    difficulty: payload.difficulty,
  });
}

export async function getTwinComparison(_accessToken: string): Promise<TwinComparisonOut> {
  await delay(MOCK_DELAY);
  return {
    user_xp: 1200,
    user_pet_stage: 1,
    user_pet_stage_name: "Cub",
    user_streak: 5,
    user_power_score: 1240,
    twin_xp: 2400,
    twin_pet_stage: 2,
    twin_pet_stage_name: "Cat",
    twin_streak: 12,
    twin_power_score: 2480,
    current_gap_state: "AHEAD",
    gap_line: "Your Twin is 7 days of consistency ahead.",
    strip_message: "Your rival is you — one week ahead. Show up and close the gap.",
    gap_days: 7,
  };
}

export async function getUserMe(_accessToken: string): Promise<UserMeOut> {
  await delay(MOCK_DELAY);
  return {
    id: "mock-user-id",
    email: "preview@example.com",
    username: "preview_user",
    created_at: new Date().toISOString(),
    archetype: "The Structured Climber",
    trial_start_date: new Date().toISOString(),
    subscription_status: "trialing",
    nudge_frequency: "medium",
  };
}

export async function patchUserMe(
  _accessToken: string,
  _payload: PatchUserMePayload
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  return { success: true };
}

export async function getLeaderboard(_accessToken: string): Promise<LeaderboardOut> {
  await delay(MOCK_DELAY);
  const entries: LeaderboardOut["entries"] = [
    {
      rank: 1,
      user_id: "u1",
      username: "top_rival",
      power_score: 3200,
      streak: 30,
      pet_stage: 4,
      character_stage: 3,
      is_own: false,
    },
    {
      rank: 2,
      user_id: "mock-user-id",
      username: "preview_user",
      power_score: 1240,
      streak: 5,
      pet_stage: 1,
      character_stage: 2,
      is_own: true,
    },
    {
      rank: 3,
      user_id: "u3",
      username: "steady_eddie",
      power_score: 980,
      streak: 14,
      pet_stage: 2,
      character_stage: 2,
      is_own: false,
    },
  ];
  return {
    entries,
    my_rank: 2,
    my_entry: entries[1] ?? null,
  };
}

function mockReportRow(overrides: Partial<WeeklyReportRow> = {}): WeeklyReportRow {
  return {
    id: "mock-report-1",
    user_id: "mock-user",
    week_start: new Date().toISOString().slice(0, 10),
    this_week_data: {
      missions_completed: 18,
      missions_total: 24,
      core_days_complete: 6,
      core_days_total: 7,
      xp_earned: 420,
      pet_food_earned: 340,
      current_streak: 5,
      streak_status: "active",
      character_stage_name: "The Focused",
      character_stage: 2,
      day_of_week_completion: [85, 90, 70, 95, 80, 60, 88],
    },
    wins: ["Nailed sleep 6 nights.", "Consistent movement every day."],
    slipped: ["Mindfulness slipped mid-week."],
    keep_watching: null,
    twin_paragraph: "You showed up. The gap is still there — close it next week.",
    twin_closing: "One week at a time.",
    next_week: "Keep the streak. Add one harder mission.",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export async function getWeeklyReport(_accessToken: string): Promise<WeeklyReportOut> {
  await delay(MOCK_DELAY);
  // Return one report so Report screen shows content; set report: null for empty state
  return {
    report: mockReportRow(),
    last_week: mockReportRow({
      id: "mock-report-0",
      week_start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    }),
  };
}

export async function getDayOfWeekCompletion(
  _accessToken: string
): Promise<{ day_of_week_completion: number[] }> {
  await delay(MOCK_DELAY);
  return {
    day_of_week_completion: [85, 90, 70, 95, 80, 60, 88],
  };
}

export async function saveJournal(
  _accessToken: string,
  payload: JournalSavePayload
): Promise<JournalSaveOut> {
  await delay(MOCK_DELAY);
  const words = (payload.content || "").trim().split(/\s+/).filter(Boolean).length;
  return {
    saved: true,
    date: payload.date ?? new Date().toISOString().slice(0, 10),
    word_count: words,
  };
}

export async function getJournalEntries(
  _accessToken: string,
  _fromDate?: string,
  _toDate?: string,
  _limit?: number
): Promise<JournalListOut> {
  await delay(MOCK_DELAY);
  const entries: JournalEntryOut[] = [
    {
      date: new Date().toISOString().slice(0, 10),
      content: "Today I showed up. Small win.",
      word_count: 6,
      created_at: new Date().toISOString(),
    },
  ];
  return { entries };
}
