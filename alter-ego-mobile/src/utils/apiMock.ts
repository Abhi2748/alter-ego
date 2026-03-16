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
  InterestOut,
  InterestsOut,
  PostInterestPayload,
  QuitTargetOut,
  QuitTargetsOut,
  PostQuitTargetPayload,
  IdentityData,
  CompanionData,
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
      gender: "male",
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
    streak: 14,
    week_dots: [true, true, true, false, false, false, false],
  };
}

export async function getProfileIdentity(
  _accessToken: string
): Promise<IdentityData> {
  await delay(MOCK_DELAY);
  return {
    current_stage: 2,
    current_stage_name: "The Focused",
    current_xp: 3240,
    next_stage_xp_threshold: 10000,
    total_xp: 3240,
    days_active: 45,
    days_to_next_stage_estimate: 18,
    stage_history: [
      {
        stage: 1,
        name: "The Awakened",
        status: "completed",
        reached_day: 1,
        left_day: 27,
        days_spent: 27,
        xp_required: 0,
      },
      {
        stage: 2,
        name: "The Focused",
        status: "current",
        reached_day: 28,
        left_day: null,
        days_spent: 18,
        xp_required: 10000,
      },
      {
        stage: 3,
        name: "The Burning",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        xp_required: 50000,
      },
      {
        stage: 4,
        name: "The Relentless",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        xp_required: 200000,
      },
      {
        stage: 5,
        name: "The Formidable",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        xp_required: 600000,
      },
      {
        stage: 6,
        name: "The Sovereign",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        xp_required: 1500000,
      },
    ],
  };
}

export async function getProfileCompanion(
  _accessToken: string
): Promise<CompanionData> {
  await delay(MOCK_DELAY);
  return {
    current_stage: 2,
    current_pet_name: "Cat",
    total_pf: 5200,
    today_pf: 120,
    daily_cap: 600,
    next_stage_pf_threshold: 7000,
    unlocked_day: 7,
    days_to_next_estimate: 28,
    stage_history: [
      {
        stage: 1,
        name: "Cub",
        status: "completed",
        reached_day: 7,
        left_day: 25,
        days_spent: 19,
        pf_required: 0,
      },
      {
        stage: 2,
        name: "Cat",
        status: "current",
        reached_day: 26,
        left_day: null,
        days_spent: 14,
        pf_required: 400,
      },
      {
        stage: 3,
        name: "Fox",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        pf_required: 2000,
      },
      {
        stage: 4,
        name: "Wolf",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        pf_required: 7000,
      },
      {
        stage: 5,
        name: "Snow Leopard",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        pf_required: 18000,
      },
      {
        stage: 6,
        name: "Panther",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        pf_required: 40000,
      },
      {
        stage: 7,
        name: "Griffin",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        pf_required: 80000,
      },
      {
        stage: 8,
        name: "Dragon",
        status: "locked",
        reached_day: null,
        left_day: null,
        days_spent: null,
        pf_required: 150000,
      },
    ],
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
      gender: "male",
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
  const today = new Date().toISOString().slice(0, 10);
  return {
    user_xp: 1240,
    user_pet_stage: 1,
    user_pet_stage_name: "Cub",
    user_streak: 5,
    user_power_score: 1240,
    twin_xp: 2480,
    twin_pet_stage: 2,
    twin_pet_stage_name: "Cat",
    twin_streak: 12,
    twin_power_score: 2480,
    current_gap_state: "slightly_behind",
    gap_line: "Twin has a Cat and 2,480 XP. You have a Cub and 1,240 XP.",
    strip_message: '"Four down. What\'s your count?"',
    gap_days: 7,
    username: "shadow_wolf",
    twin_today_activities: [
      { mission_title: "Get 7+ hours of sleep", mission_type: "core", difficulty: "Easy", xp_earned: 25, completed_at: `${today}T06:30:00Z` },
      { mission_title: "Move for 30 minutes", mission_type: "core", difficulty: "Medium", xp_earned: 25, completed_at: `${today}T07:15:00Z` },
      { mission_title: "Drink 8 glasses of water", mission_type: "core", difficulty: "Medium", xp_earned: 25, completed_at: `${today}T08:00:00Z` },
      { mission_title: "Run 2 miles", mission_type: "focus", difficulty: "Medium", xp_earned: 25, completed_at: `${today}T09:10:00Z` },
      { mission_title: "Read for 20 minutes", mission_type: "personal", difficulty: "Easy", xp_earned: 0, completed_at: null },
    ],
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
    { rank: 1, user_id: "u1", username: "top_rival", power_score: 3200, streak: 30, pet_stage: 4, character_stage: 3, is_own: false },
    { rank: 2, user_id: "u2", username: "silent_ember", power_score: 2800, streak: 22, pet_stage: 3, character_stage: 3, is_own: false },
    { rank: 3, user_id: "u3", username: "steady_eddie", power_score: 2100, streak: 14, pet_stage: 2, character_stage: 2, is_own: false },
    { rank: 4, user_id: "u4", username: "ghost_mode_k", power_score: 1800, streak: 12, pet_stage: 2, character_stage: 2, is_own: false },
    { rank: 5, user_id: "u5", username: "mindset_forge", power_score: 1650, streak: 10, pet_stage: 1, character_stage: 2, is_own: false },
    { rank: 6, user_id: "u6", username: "cold_focus_rx", power_score: 1420, streak: 8, pet_stage: 1, character_stage: 2, is_own: false },
    { rank: 7, user_id: "u7", username: "nova_discipline", power_score: 1380, streak: 7, pet_stage: 1, character_stage: 2, is_own: false },
    { rank: 8, user_id: "u8", username: "steady_rise_42", power_score: 1200, streak: 6, pet_stage: 1, character_stage: 2, is_own: false },
    { rank: 47, user_id: "mock-user-id", username: "preview_user", power_score: 1240, streak: 5, pet_stage: 1, character_stage: 2, is_own: true },
  ];
  return {
    entries,
    my_rank: 47,
    my_entry: entries[8] ?? null,
    total_users: 312,
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

function mockMilestone(
  num: number,
  name: string,
  trigger: string,
  unlocked: boolean,
  quote: string | null = null,
  earnedAt: string | null = null
): InterestOut["milestones"][0] {
  return {
    id: `ms-${num}`,
    milestone_number: num,
    name,
    trigger_label: trigger,
    earned_at: earnedAt,
    is_unlocked: unlocked,
    sessions_at_earn: unlocked ? num * 10 : null,
    xp_at_earn: unlocked ? 15 : null,
    xp_total_at_earn: unlocked ? 100 + num * 20 : null,
    streak_at_earn: num === 2 && unlocked ? 7 : null,
    tier_at_earn: unlocked ? "Easy" : null,
    quote,
  };
}

// Mutable list so added interests appear after refetch; delete removes from list.
const seedInterests: InterestOut[] = [
  {
    id: "fitness-1",
    interest_name: "Fitness",
    interest_description: "I love running outdoors, mainly trail running.",
    level: 2,
    current_xp: 360,
    xp_for_next_level: 600,
    schedule_days: ["mon", "wed", "fri"],
    total_sessions: 12,
    tier: "medium",
    goal_description: "Run a 5K by June.",
    milestones: [
      mockMilestone(1, "First Step", "Session 1", true, "The day you decided this was worth one hour.", "2026-03-01T10:00:00Z"),
      mockMilestone(2, "7 Days In", "7-day streak", true, "Seven days of showing up. Most people stop at three.", "2026-03-10T10:00:00Z"),
      mockMilestone(3, "10 Sessions", "10 sessions", true, "Ten sessions is where dabbling ends and doing begins.", "2026-03-15T10:00:00Z"),
      mockMilestone(4, "One Month", "30 sessions", false),
      mockMilestone(5, "50 Sessions", "50 sessions", false),
      mockMilestone(6, "100 Sessions", "100 sessions", false),
      mockMilestone(7, "200 Sessions", "200 sessions", false),
      mockMilestone(8, "365 Sessions", "365 sessions", false),
    ],
  },
  {
    id: "reading-1",
    interest_name: "Reading",
    interest_description: "I want to read more non-fiction.",
    level: 1,
    current_xp: 30,
    xp_for_next_level: 200,
    schedule_days: ["tue", "thu", "sat"],
    total_sessions: 2,
    tier: "easy",
    goal_description: "Finish 1 book a month.",
    milestones: [
      mockMilestone(1, "First Step", "Session 1", true, "The day you decided this was worth one hour.", "2026-03-12T10:00:00Z"),
      mockMilestone(2, "7 Days In", "7-day streak", false),
      mockMilestone(3, "10 Sessions", "10 sessions", false),
      mockMilestone(4, "One Month", "30 sessions", false),
      mockMilestone(5, "50 Sessions", "50 sessions", false),
      mockMilestone(6, "100 Sessions", "100 sessions", false),
      mockMilestone(7, "200 Sessions", "200 sessions", false),
      mockMilestone(8, "365 Sessions", "365 sessions", false),
    ],
  },
];

let mockInterestsList: InterestOut[] = [...seedInterests];

export async function getInterests(_accessToken: string): Promise<InterestsOut> {
  await delay(MOCK_DELAY);
  return { interests: [...mockInterestsList] };
}

export async function patchInterest(
  _accessToken: string,
  _interest: string,
  _payload: { self_level?: string; learning_goal?: string; schedule?: number[] }
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  return { success: true };
}

export async function postInterest(
  _accessToken: string,
  _payload: PostInterestPayload
): Promise<{ success: boolean; interest?: InterestOut }> {
  await delay(MOCK_DELAY);
  const id = `new-${Date.now()}`;
  const name = _payload.interest_description.trim().slice(0, 30) || "New interest";
  const newInterest: InterestOut = {
    id,
    interest_name: name,
    interest_description: _payload.interest_description,
    level: 1,
    current_xp: 0,
    xp_for_next_level: 200,
    schedule_days: _payload.schedule_days.map((d) => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][d] ?? "mon"),
    total_sessions: 0,
    tier: "easy",
    goal_description: _payload.goal_description,
    milestones: [],
  };
  mockInterestsList = [...mockInterestsList, newInterest];
  return { success: true, interest: newInterest };
}

export async function deleteInterest(
  _accessToken: string,
  interestId: string
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  mockInterestsList = mockInterestsList.filter((i) => i.id !== interestId);
  return { success: true };
}

export async function putInterestGoal(
  _accessToken: string,
  _interestId: string,
  _payload: { new_goal: string; progress_level: string; progress_detail?: string }
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  return { success: true };
}

export async function putInterestDifficulty(
  _accessToken: string,
  _interestId: string,
  _payload: { tier: "easy" | "medium" | "hard" }
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  return { success: true };
}

export async function putInterestSchedule(
  _accessToken: string,
  _interestId: string,
  _payload: { days: string[] }
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  return { success: true };
}

// -----------------------------------------------------------------------------
// Quit targets (mock — stateful list)
// -----------------------------------------------------------------------------
function mockQuitMilestone(
  type: string,
  unlocked: boolean,
  quote: string | null = null,
  earnedAt: string | null = null,
  cleanDays: number | null = null,
  cravings: number | null = null,
  daysAway: number | null = null
) {
  return {
    id: `qm-${type}-${Date.now()}`,
    milestone_type: type,
    earned_at: earnedAt,
    is_unlocked: unlocked,
    clean_days_at_earn: cleanDays,
    cravings_at_earn: cravings,
    phase_at_earn: unlocked ? "replacement" : null,
    days_away: daysAway,
    quote,
    slip_duration_hours: null,
    return_speed: null,
  };
}

const seedQuitTargets: QuitTargetOut[] = [
  {
    id: "quit-1",
    quit_description: "I want to stop scrolling social media for hours, especially Instagram and TikTok late at night.",
    quit_name: "Social Media",
    trigger_description: "Late at night when I'm in bed, and when I'm bored at work.",
    underlying_need: "Boredom / Dopamine",
    need_category: "boredom_dopamine",
    status: "active",
    started_at: "2026-03-01",
    current_clean_streak: 12,
    best_clean_streak: 12,
    total_clean_days: 12,
    slip_count: 0,
    cravings_resisted: 72,
    current_phase: "replacement",
    days_in_current_phase: 2,
    conquered_at: null,
    milestones: [
      mockQuitMilestone("day_1", true, "The decision was made. That's harder than it looks.", "2026-03-01T12:00:00Z", 1, 6),
      mockQuitMilestone("day_3", true, "72 hours. The biology peaks here. You held.", "2026-03-04T12:00:00Z", 3, 18),
      mockQuitMilestone("day_7", true, "One week. The hardest seven days. They're done.", "2026-03-08T12:00:00Z", 7, 42),
      mockQuitMilestone("day_14", false, null, null, null, null, 2),
      mockQuitMilestone("day_30", false, null, null, null, null, 18),
      mockQuitMilestone("day_60", false, null, null, null, null, 48),
      mockQuitMilestone("day_90", false, null, null, null, null, 78),
      mockQuitMilestone("day_365", false, null, null, null, null, 353),
    ],
  },
];

let mockQuitTargetsList: QuitTargetOut[] = [...seedQuitTargets];

export async function getQuitTargets(_accessToken: string): Promise<QuitTargetsOut> {
  await delay(MOCK_DELAY);
  return { targets: [...mockQuitTargetsList] };
}

export async function postQuitTarget(
  _accessToken: string,
  payload: PostQuitTargetPayload
): Promise<{ success: boolean; target?: QuitTargetOut }> {
  await delay(MOCK_DELAY);
  const id = `quit-${Date.now()}`;
  const name = (payload.quit_description || "Quit").trim().slice(0, 24);
  const newTarget: QuitTargetOut = {
    id,
    quit_description: payload.quit_description,
    quit_name: name,
    trigger_description: payload.trigger_description,
    underlying_need: "Boredom / Dopamine",
    need_category: "boredom_dopamine",
    status: "active",
    started_at: new Date().toISOString().slice(0, 10),
    current_clean_streak: 0,
    best_clean_streak: 0,
    total_clean_days: 0,
    slip_count: 0,
    cravings_resisted: 0,
    current_phase: "awareness",
    days_in_current_phase: 0,
    conquered_at: null,
    milestones: [
      mockQuitMilestone("day_1", false, null, null, null, null, 1),
      mockQuitMilestone("day_3", false, null, null, null, null, 3),
      mockQuitMilestone("day_7", false, null, null, null, null, 7),
      mockQuitMilestone("day_14", false, null, null, null, null, 14),
      mockQuitMilestone("day_30", false, null, null, null, null, 30),
      mockQuitMilestone("day_60", false, null, null, null, null, 60),
      mockQuitMilestone("day_90", false, null, null, null, null, 90),
      mockQuitMilestone("day_365", false, null, null, null, null, 365),
    ],
  };
  mockQuitTargetsList = [...mockQuitTargetsList, newTarget];
  return { success: true, target: newTarget };
}

export async function postQuitTargetConquer(
  _accessToken: string,
  targetId: string,
  payload: { conquered_at: string; final_clean_days: number; cravings_resisted: number }
): Promise<{ success: boolean }> {
  await delay(MOCK_DELAY);
  mockQuitTargetsList = mockQuitTargetsList.map((t) =>
    t.id === targetId
      ? {
          ...t,
          status: "conquered" as const,
          conquered_at: payload.conquered_at,
          total_clean_days: payload.final_clean_days,
          cravings_resisted: payload.cravings_resisted,
          milestones: [
            ...t.milestones,
            {
              id: `qm-conquered-${Date.now()}`,
              milestone_type: "conquered",
              earned_at: payload.conquered_at,
              is_unlocked: true,
              clean_days_at_earn: payload.final_clean_days,
              cravings_at_earn: payload.cravings_resisted,
              phase_at_earn: "free",
              days_away: null,
              quote: "You decided you were done. And then you stayed done. Not everyone gets here.",
              slip_duration_hours: null,
              return_speed: null,
            },
          ],
        }
      : t
  );
  return { success: true };
}
