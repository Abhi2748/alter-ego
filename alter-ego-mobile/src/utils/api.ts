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
    `${BASE}/api/v1/onboarding/check-username?username=${encodeURIComponent(username.trim())}`,
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
};

export async function getTwinComparison(
  accessToken: string
): Promise<TwinComparisonOut> {
  if (apiMock) return apiMock.getTwinComparison(accessToken);
  const res = await fetch(`${BASE}/api/v1/twin/comparison`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Twin comparison failed: ${res.status}`);
  }
  return res.json();
}

// User profile and prefs
export type UserMeOut = {
  id: string;
  email?: string | null;
  username?: string | null;
  created_at?: string | null;
  archetype?: string | null;
  trial_start_date?: string | null;
  subscription_status?: string | null;
  nudge_frequency?: string | null;
};

export type PatchUserMePayload = {
  push_token?: string;
  timezone?: string;
  last_opened_at?: string;
  nudge_frequency?: string;
};

export async function getUserMe(accessToken: string): Promise<UserMeOut> {
  if (apiMock) return apiMock.getUserMe(accessToken);
  const res = await fetch(`${BASE}/api/v1/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `GET user/me failed: ${res.status}`);
  }
  return res.json();
}

export async function patchUserMe(
  accessToken: string,
  payload: PatchUserMePayload
): Promise<{ success: boolean }> {
  if (apiMock) return apiMock.patchUserMe(accessToken, payload);
  const res = await fetch(`${BASE}/api/v1/user/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `PATCH user/me failed: ${res.status}`);
  }
  return res.json();
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
  const res = await fetch(`${BASE}/api/v1/agents/weekly-report`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Weekly report failed: ${res.status}`);
  }
  return res.json();
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

// Interests (Profile → Interests)
export type InterestProgressOut = {
  interest: string;
  total_xp: number;
  level: number;
  self_level?: string | null;
  learning_goal?: string | null;
  schedule?: number[] | null;
};
export type InterestsOut = { interests: InterestProgressOut[] };

export async function getInterests(accessToken: string): Promise<InterestsOut> {
  if (apiMock) return apiMock.getInterests(accessToken);
  const res = await fetch(`${BASE}/api/v1/interests`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Get interests failed: ${res.status}`);
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
