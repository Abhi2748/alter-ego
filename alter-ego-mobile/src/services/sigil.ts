import { apiClient } from "@/services/api";

const USE_MOCK_API =
  process.env.EXPO_PUBLIC_USE_MOCK_API === "true" ||
  process.env.EXPO_PUBLIC_USE_MOCK_API === "1";

export interface SigilProgress {
  level: number;
  name: string;
  aether_total: number;
  aether_in_level: number;
  aether_for_next: number;
  aether_needed: number;
  progress_percent: number;
}

export interface SigilData {
  sigil_level: number;
  level_name: string;
  total_aether: number;
  aether_today: number;
  surge_active: boolean;
  progress: SigilProgress;
  aether_history: Array<{ date: string; aether: number }>;
}

export const SIGIL_PLACEHOLDER_DATA: SigilData = {
  sigil_level: 1,
  level_name: "The Ember",
  total_aether: 0,
  aether_today: 0,
  surge_active: false,
  progress: {
    level: 1,
    name: "The Ember",
    aether_total: 0,
    aether_in_level: 0,
    aether_for_next: 300,
    aether_needed: 300,
    progress_percent: 0,
  },
  aether_history: [],
};

export async function fetchSigilData(): Promise<SigilData> {
  if (USE_MOCK_API) {
    const { getProfileSigilMock } = await import("@/utils/apiMock");
    return getProfileSigilMock();
  }
  return apiClient.get<SigilData>("/api/v1/sigil");
}
