/**
 * Backend API client. Uses EXPO_PUBLIC_API_URL (e.g. https://your-app.onrender.com) and
 * Supabase session for Bearer token.
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

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

export type OnboardingPayload = {
  answers: Record<string, unknown>;
  interests: string[];
  quit_targets: string[];
  available_hours_per_day: number;
  gender: string | null;
};

export async function postOnboarding(
  payload: OnboardingPayload,
  accessToken: string
): Promise<OnboardingResponse> {
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
  const res = await fetch(`${BASE}/api/v1/twin/comparison`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Twin comparison failed: ${res.status}`);
  }
  return res.json();
}

// User prefs: push token, timezone, last_opened_at (for nudges and report)
export type PatchUserMePayload = {
  push_token?: string;
  timezone?: string;
  last_opened_at?: string;
};

export async function patchUserMe(
  accessToken: string,
  payload: PatchUserMePayload
): Promise<{ success: boolean }> {
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
  const url = `${BASE}/api/v1/journal${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Journal list failed: ${res.status}`);
  }
  return res.json();
}
