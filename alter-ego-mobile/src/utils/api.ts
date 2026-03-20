/**
 * Backend API client. Uses EXPO_PUBLIC_API_URL (e.g. https://your-app.onrender.com) and
 * Supabase session for Bearer token.
 *
 * UI preview without backend: set EXPO_PUBLIC_USE_MOCK_API=true in .env to use mock
 * responses (no network calls). Revert by setting it to false or removing the line.
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const USE_MOCK =
  process.env.EXPO_PUBLIC_USE_MOCK_API === "true" ||
  process.env.EXPO_PUBLIC_USE_MOCK_API === "1";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const apiMock = USE_MOCK ? require("./apiMock") : null;

export type ArchetypeContent = {
  archetype: string;
  description: string;
  twin_first_message: string;
};

export type OnboardingResponse = {
  success: boolean;
  message: string;
  archetype: string;
  archetype_content: ArchetypeContent;
  initial_missions: unknown[];
};

export type OnboardingInterestLevelItem = {
  interest: string;
  level: string;
  learning_goal?: string;
  /** Day indices 0–6 (Mon–Sun). Which days to work on this interest. */
  schedule?: number[];
};

export type OnboardingPayload = {
  answers: Record<string, unknown>;
  interests: string[];
  quit_targets: string[];
  available_hours_per_day: number;
  gender: string | null;
  username?: string | null;
  interest_levels?: OnboardingInterestLevelItem[];
};

export async function checkUsername(
  username: string,
  accessToken: string
): Promise<{ available: boolean }> {
  if (apiMock) return apiMock.checkUsername(username, accessToken);
  const res = await fetch(
    `${BASE}/api/v1/users/check-username?username=${encodeURIComponent(username.trim())}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 409) throw new Error("Username already taken");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Check username failed: ${res.status}`);
  }
  return res.json();
}

export async function postOnboarding(
  payload: OnboardingPayload,
  accessToken: string
): Promise<OnboardingResponse> {
  if (apiMock) return apiMock.postOnboarding(payload, accessToken);
  const res = await fetch(`${BASE}/api/v1/onboarding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Onboarding failed: ${res.status}`);
  }
  return res.json();
}

export type CharacterStateOut = {
  stage: number;
  total_xp: number;
  next_stage_xp: number;
  next_stage_name: string;
  gender?: string | null; // "male" | "female" for character image
};

export type PetStateOut = {
  stage: number;
  pet_health_state: string;
  total_pet_food: number;
};

export type MissionOut = {
  id: string;
  user_id: string;
  type: string;
  pillar: string | null;
  interest: string | null;
  title: string;
  difficulty: string;
  xp_value: number;
  pet_food_value: number;
  mission_streak: number;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type HomeOut = {
  character_state: CharacterStateOut;
  pet_state: PetStateOut;
  missions: MissionOut[];
  twin_strip_message: string | null;
  power_score?: number | null;
  username?: string | null;
  streak?: number;
  week_dots?: boolean[]; // Mon–Sun
};

export type IdentityStageHistoryItem = {
  stage: number;
  name: string;
  status: "current" | "completed" | "locked";
  reached_day: number | null;
  left_day: number | null;
  days_spent: number | null;
  xp_required: number;
};

export type IdentityData = {
  current_stage: number;
  current_stage_name: string;
  current_xp: number;
  next_stage_xp_threshold: number;
  total_xp: number;
  days_active: number;
  days_to_next_stage_estimate: number;
  stage_history: IdentityStageHistoryItem[];
};

export type CompanionStageHistoryItem = {
  stage: number;
  name: string;
  status: "current" | "completed" | "locked";
  reached_day: number | null;
  left_day: number | null;
  days_spent: number | null;
  pf_required: number;
};

export type CompanionData = {
  current_stage: number;
  current_pet_name: string;
  total_pf: number;
  today_pf: number;
  daily_cap: number;
  next_stage_pf_threshold: number;
  unlocked_day: number;
  days_to_next_estimate: number;
  stage_history: CompanionStageHistoryItem[];
};

export type EarnedMilestoneOut = {
  interest: string;
  milestone_name: string;
  milestone_number: number;
  twin_congratulation: string;
  earned_at?: string | null;
};

export type MissionCompleteOut = {
  mission: MissionOut;
  character_state: CharacterStateOut;
  pet_state: PetStateOut;
  stage_up: boolean;
  pet_stage_up: boolean;
  xp_earned: number;
  pet_food_earned: number;
  twin_strip_message?: string | null;
  earned_milestone?: EarnedMilestoneOut | null;
};

export async function getHome(accessToken: string): Promise<HomeOut> {
  if (apiMock) return apiMock.getHome(accessToken);
  const res = await fetch(`${BASE}/api/v1/home`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Home failed: ${res.status}`);
  }
  return res.json();
}

export async function getProfileIdentity(
  accessToken: string
): Promise<IdentityData> {
  if (apiMock) return apiMock.getProfileIdentity(accessToken);
  const res = await fetch(`${BASE}/api/v1/profile/identity`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Profile identity failed: ${res.status}`);
  }
  return res.json();
}

export async function getProfileCompanion(
  accessToken: string
): Promise<CompanionData> {
  if (apiMock) return apiMock.getProfileCompanion(accessToken);
  const res = await fetch(`${BASE}/api/v1/profile/companion`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Profile companion failed: ${res.status}`);
  }
  return res.json();
}

export async function completeMission(
  accessToken: string,
  missionId: string
): Promise<MissionCompleteOut> {
  if (apiMock) return apiMock.completeMission(accessToken, missionId);
  const res = await fetch(`${BASE}/api/v1/missions/${missionId}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Complete mission failed: ${res.status}`);
  }
  return res.json();
}

export type EstimatePersonalTierOut = {
  suggested_difficulty: "Easy" | "Medium" | "Hard";
  xp_value: number;
  pet_food_value: number;
};

export async function estimatePersonalTier(
  accessToken: string,
  title: string
): Promise<EstimatePersonalTierOut> {
  if (apiMock) return apiMock.estimatePersonalTier(accessToken, title);
  const res = await fetch(`${BASE}/api/v1/missions/estimate-personal-tier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title: title.trim() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Estimate tier failed: ${res.status}`);
  }
  return res.json();
}

export type CreateMissionPayload = {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  type?: "personal";
};

export async function createMission(
  accessToken: string,
  payload: CreateMissionPayload
): Promise<MissionOut> {
  if (apiMock) return apiMock.createMission(accessToken, payload);
  const body = {
    title: payload.title.trim(),
    difficulty: payload.difficulty,
    type: payload.type ?? "personal",
  };
  const res = await fetch(`${BASE}/api/v1/missions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Create mission failed: ${res.status}`);
  }
  return res.json();
}

// Twin comparison (Twin Design §5.1, §5.2, 1.34)
export type TwinActivity = {
  mission_title: string;
  mission_type: 'core' | 'focus' | 'personal';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xp_earned: number;
  completed_at: string | null; // ISO time string, null = pending
};

export type TwinComparisonOut = {
  user_xp: number;
  user_pet_stage: number;
  user_pet_stage_name: string;
  user_streak: number;
  user_power_score: number | null;
  twin_xp: number;
  twin_pet_stage: number;
  twin_pet_stage_name: string;
  twin_streak: number;
  twin_power_score: number | null;
  current_gap_state: string;
  gap_line: string;
  strip_message: string | null;
  gap_days: number | null;
  username?: string | null;
  twin_today_activities?: TwinActivity[];
};

export async function getTwinComparison(
  accessToken: string
): Promise<TwinComparisonOut> {
  if (apiMock) return apiMock.getTwinComparison(accessToken);
  // Backend v2: Twin Comparison screen reads from /twin/state
  const res = await fetch(`${BASE}/api/v1/twin/state`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Twin comparison failed: ${res.status}`);
  }
  const raw = (await res.json()) as any;

  // Map TwinStateResponse -> legacy TwinComparisonOut shape expected by screens.
  const user = raw?.user ?? {};
  const twin = raw?.twin ?? {};
  const gap = raw?.gap ?? {};

  const missions = Array.isArray(user?.missions_today) ? user.missions_today : [];
  const twinActs: TwinActivity[] = missions.map((m: any) => ({
    mission_title: String(m?.title ?? ""),
    mission_type: (m?.type as "core" | "focus" | "personal") ?? "core",
    difficulty: (m?.difficulty as "Easy" | "Medium" | "Hard") ?? "Easy",
    xp_earned: Number(m?.xp_value ?? m?.xp_earned_today ?? 0) || 0,
    completed_at: m?.completed ? new Date().toISOString() : null,
  }));

  return {
    user_xp: Number(user?.total_xp ?? 0) || 0,
    user_pet_stage: Number(user?.pet_stage ?? 0) || 0,
    user_pet_stage_name: String(user?.pet_name ?? ""),
    user_streak: Number(user?.current_streak ?? 0) || 0,
    user_power_score: null,
    twin_xp: Number(twin?.twin_xp ?? twin?.twin_xp ?? 0) || 0,
    twin_pet_stage: Number(twin?.pet_stage ?? 0) || 0,
    twin_pet_stage_name: String(twin?.pet_name ?? ""),
    twin_streak: Number(twin?.streak ?? 0) || 0,
    twin_power_score: null,
    current_gap_state: String(gap?.gap_state ?? ""),
    gap_line: "",
    strip_message: null,
    gap_days: Number(gap?.days_user_ahead ?? 0),
    username: user?.username ?? null,
    twin_today_activities: twinActs,
  };
}

// Leaderboard
export type LeaderboardEntryOut = {
  rank: number;
  user_id: string;
  username: string;
  power_score: number;
  streak: number;
  pet_stage: number;
  character_stage: number;
  is_own?: boolean;
};

export type LeaderboardOut = {
  entries: LeaderboardEntryOut[];
  my_rank: number | null;
  my_entry: LeaderboardEntryOut | null;
  /** Count of users on leaderboard (for "X competing" subtitle). */
  total_users?: number;
};

export async function getLeaderboard(
  accessToken: string
): Promise<LeaderboardOut> {
  if (apiMock) return apiMock.getLeaderboard(accessToken);
  const res = await fetch(`${BASE}/api/v1/leaderboard`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Leaderboard failed: ${res.status}`);
  }
  return res.json();
}

// Weekly report (Report tab)
export type WeeklyReportRow = {
  id: string;
  user_id: string;
  week_start: string;
  this_week_data?: {
    missions_completed?: number;
    missions_total?: number;
    core_days_complete?: number;
    core_days_total?: number;
    xp_earned?: number;
    pet_food_earned?: number;
    current_streak?: number;
    streak_status?: string;
    character_stage_name?: string;
    character_stage?: number;
    stage_change_this_week?: string;
    pet_name?: string;
    pet_stage?: number;
    pet_change_this_week?: string;
    day_of_week_completion?: number[];
  };
  wins?: string[];
  slipped?: string[];
  keep_watching?: string | null;
  twin_paragraph?: string | null;
  twin_closing?: string | null;
  next_week?: string | null;
  created_at?: string;
};

export type WeeklyReportOut = {
  report: WeeklyReportRow | null;
  last_week: WeeklyReportRow | null;
};

export async function getWeeklyReport(
  accessToken: string
): Promise<WeeklyReportOut> {
  if (apiMock) return apiMock.getWeeklyReport(accessToken);
  // Backend v2: weekly report served from /reports/weekly (+ /reports/weekly/previous)
  const res = await fetch(`${BASE}/api/v1/reports/weekly`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Weekly report failed: ${res.status}`);
  }
  const current = (await res.json()) as any;

  let report: WeeklyReportRow | null = null;
  if (current?.available) {
    report = {
      id: String(current.week_start ?? "current"),
      user_id: "",
      week_start: String(current.week_start ?? ""),
      this_week_data: current.this_week_data ?? {},
      wins: current.wins ?? [],
      slipped: current.slipped ?? [],
      keep_watching: current.keep_watching ?? null,
      twin_paragraph: current.twin_paragraph ?? null,
      twin_closing: current.twin_closing ?? null,
      next_week: current.next_week ?? null,
      created_at: current.generated_at ?? undefined,
    };
  }

  // Best-effort last week
  let last_week: WeeklyReportRow | null = null;
  try {
    const prevRes = await fetch(`${BASE}/api/v1/reports/weekly/previous`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (prevRes.ok) {
      const prev = (await prevRes.json()) as any;
      if (prev?.available) {
        last_week = prev as WeeklyReportRow;
      }
    }
  } catch (_) {}

  return { report, last_week };
}

// Day-of-week completion (Report chart + Profile)
export async function getDayOfWeekCompletion(
  accessToken: string
): Promise<{ day_of_week_completion: number[] }> {
  if (apiMock) return apiMock.getDayOfWeekCompletion(accessToken);
  const res = await fetch(`${BASE}/api/v1/analytics/day-of-week`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Day-of-week analytics failed: ${res.status}`);
  }
  return res.json();
}

// Journal (standalone — no Core mission)
export type JournalSavePayload = { date?: string; content: string };
export type JournalSaveOut = {
  saved: boolean;
  date: string;
  word_count: number;
};

export async function saveJournal(
  accessToken: string,
  payload: JournalSavePayload
): Promise<JournalSaveOut> {
  if (apiMock) return apiMock.saveJournal(accessToken, payload);
  const res = await fetch(`${BASE}/api/v1/journal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Save journal failed: ${res.status}`);
  }
  return res.json();
}

export type JournalEntryOut = { date: string; content: string; word_count: number; created_at?: string };
export type JournalListOut = { entries: JournalEntryOut[] };

export async function getJournalEntries(
  accessToken: string,
  fromDate?: string,
  toDate?: string,
  limit?: number
): Promise<JournalListOut> {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();
  if (apiMock)
    return apiMock.getJournalEntries(accessToken, fromDate, toDate, limit ?? undefined);
  const url = `${BASE}/api/v1/journal${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Journal list failed: ${res.status}`);
  }
  return res.json();
}

// Interests (Profile → Interests). Spec §7.
export type InterestProgressOut = {
  interest: string;
  total_xp: number;
  level: number;
  self_level?: string | null;
  learning_goal?: string | null;
  schedule?: number[] | null;
};

export type MilestoneOut = {
  id: string;
  milestone_number: number;
  name: string;
  trigger_label: string;
  earned_at: string | null;
  is_unlocked: boolean;
  sessions_at_earn: number | null;
  xp_at_earn: number | null;
  xp_total_at_earn: number | null;
  streak_at_earn: number | null;
  tier_at_earn: string | null;
  quote: string | null;
};

export type InterestOut = {
  id: string;
  interest_name: string;
  interest_description: string;
  level: number;
  current_xp: number;
  xp_for_next_level: number;
  schedule_days: string[];
  total_sessions: number;
  tier: "easy" | "medium" | "hard";
  goal_description: string;
  milestones: MilestoneOut[];
};

export type InterestsOut = { interests: InterestOut[] };

const INTEREST_LEVEL_THRESHOLDS = [0, 200, 600, 1400, 3000, 6000, 11000, 18000, 28000, 42000];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function rowToInterestOut(row: Record<string, unknown>): InterestOut {
  const interest = String(row.interest ?? row.interest_name ?? "");
  const level = Number(row.level ?? 1);
  const totalXp = Number(row.total_xp ?? row.current_xp ?? 0);
  const nextThreshold = INTEREST_LEVEL_THRESHOLDS[level] ?? 42000;
  const schedule = row.schedule_days ?? row.schedule;
  const scheduleDays = Array.isArray(schedule)
    ? schedule.map((i: number | string) => (typeof i === "number" ? DAY_KEYS[i] : String(i)))
    : [];
  const milestones = (row.milestones as MilestoneOut[] | undefined) ?? [];
  return {
    id: String(row.id ?? interest),
    interest_name: interest,
    interest_description: String(row.interest_description ?? row.learning_goal ?? ""),
    level,
    current_xp: totalXp,
    xp_for_next_level: nextThreshold,
    schedule_days: scheduleDays,
    total_sessions: Number(row.total_sessions ?? row.session_count ?? 0),
    tier: (row.tier as "easy" | "medium" | "hard") ?? "medium",
    goal_description: String(row.goal_description ?? row.learning_goal ?? ""),
    milestones,
  };
}

export async function getInterests(accessToken: string): Promise<InterestsOut> {
  if (apiMock) return apiMock.getInterests(accessToken);
  const res = await fetch(`${BASE}/api/v1/interests`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Get interests failed: ${res.status}`);
  }
  const data = await res.json();
  const raw = data.interests ?? [];
  const interests: InterestOut[] = raw.map((row: Record<string, unknown>) => rowToInterestOut(row));
  return { interests };
}

export type PostInterestPayload = {
  interest_description: string;
  interest_level: string;
  goal_description: string;
  schedule_days: number[];
};

export async function postInterest(
  accessToken: string,
  payload: PostInterestPayload
): Promise<{ success: boolean; interest?: InterestOut }> {
  if (apiMock) return apiMock.postInterest(accessToken, payload);
  const res = await fetch(`${BASE}/api/v1/interests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Create interest failed: ${res.status}`);
  }
  return res.json();
}

export async function patchInterest(
  accessToken: string,
  interest: string,
  payload: { self_level?: string; learning_goal?: string; schedule?: number[] }
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.patchInterest(accessToken, interest, payload);
  const res = await fetch(`${BASE}/api/v1/interests/${encodeURIComponent(interest)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Patch interest failed: ${res.status}`);
  }
  return res.json();
}

export async function putInterestGoal(
  accessToken: string,
  interestId: string,
  payload: {
    new_goal: string;
    progress_level: "just_started" | "part_way" | "almost_there";
    progress_detail?: string;
  }
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.putInterestGoal(accessToken, interestId, payload);
  const res = await fetch(`${BASE}/api/v1/interests/${encodeURIComponent(interestId)}/goal`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update goal failed: ${res.status}`);
  }
  return res.json();
}

export async function putInterestDifficulty(
  accessToken: string,
  interestId: string,
  payload: { tier: "easy" | "medium" | "hard" }
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.putInterestDifficulty(accessToken, interestId, payload);
  const res = await fetch(`${BASE}/api/v1/interests/${encodeURIComponent(interestId)}/difficulty`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update difficulty failed: ${res.status}`);
  }
  return res.json();
}

export async function putInterestSchedule(
  accessToken: string,
  interestId: string,
  payload: { days: string[] }
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.putInterestSchedule(accessToken, interestId, payload);
  const res = await fetch(`${BASE}/api/v1/interests/${encodeURIComponent(interestId)}/schedule`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update schedule failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteInterest(
  accessToken: string,
  interestId: string
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.deleteInterest(accessToken, interestId);
  const res = await fetch(`${BASE}/api/v1/interests/${encodeURIComponent(interestId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete interest failed: ${res.status}`);
  }
  return res.json();
}

// -----------------------------------------------------------------------------
// Quit targets (Profile → Quits). Spec §8.
// -----------------------------------------------------------------------------
export type QuitMilestoneOut = {
  id: string;
  milestone_type: string;
  earned_at: string | null;
  is_unlocked: boolean;
  clean_days_at_earn: number | null;
  cravings_at_earn: number | null;
  phase_at_earn: string | null;
  days_away: number | null;
  quote: string | null;
  slip_duration_hours: number | null;
  return_speed: "strong" | "good" | null;
};

export type QuitTargetOut = {
  id: string;
  quit_description: string;
  quit_name: string;
  trigger_description: string;
  underlying_need: string;
  need_category: string;
  status: "active" | "conquered" | "paused";
  started_at: string;
  current_clean_streak: number;
  best_clean_streak: number;
  total_clean_days: number;
  slip_count: number;
  cravings_resisted: number;
  current_phase: string;
  days_in_current_phase: number;
  conquered_at: string | null;
  last_active_date?: string | null;
  milestones: QuitMilestoneOut[];
};

export type QuitTargetsOut = { targets: QuitTargetOut[] };

export async function getQuitTargets(accessToken: string): Promise<QuitTargetsOut> {
  if (apiMock) return apiMock.getQuitTargets(accessToken);
  const res = await fetch(`${BASE}/api/v1/quit-targets`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Get quit targets failed: ${res.status}`);
  }
  return res.json();
}

export type PostQuitTargetPayload = {
  quit_description: string;
  trigger_description: string;
};

export async function postQuitTarget(
  accessToken: string,
  payload: PostQuitTargetPayload
): Promise<{ success: boolean; target?: QuitTargetOut }> {
  if (apiMock) return apiMock.postQuitTarget(accessToken, payload);
  const res = await fetch(`${BASE}/api/v1/quit-targets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Create quit target failed: ${res.status}`);
  }
  return res.json();
}

export async function postQuitTargetConquer(
  accessToken: string,
  targetId: string,
  payload: { conquered_at: string; final_clean_days: number; cravings_resisted: number }
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.postQuitTargetConquer(accessToken, targetId, payload);
  const res = await fetch(`${BASE}/api/v1/quit-targets/${encodeURIComponent(targetId)}/conquer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Conquer quit target failed: ${res.status}`);
  }
  return res.json();
}

export type PatchQuitTargetPayload = {
  quit_description?: string;
  trigger_description?: string;
};

export async function patchQuitTarget(
  accessToken: string,
  targetId: string,
  payload: PatchQuitTargetPayload
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.patchQuitTarget(accessToken, targetId, payload);
  const res = await fetch(`${BASE}/api/v1/quit-targets/${encodeURIComponent(targetId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update quit target failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteQuitTarget(
  accessToken: string,
  targetId: string
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.deleteQuitTarget(accessToken, targetId);
  const res = await fetch(`${BASE}/api/v1/quit-targets/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete quit target failed: ${res.status}`);
  }
  return res.json();
}
