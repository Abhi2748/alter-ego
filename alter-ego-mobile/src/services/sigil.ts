import { apiClient } from "@/services/api";

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

export async function fetchSigilData(): Promise<SigilData> {
  return apiClient.get<SigilData>("/api/v1/sigil");
}
