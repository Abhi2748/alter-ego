/**
 * Focus tab API service.
 */

import { apiClient } from "@/services/api";

// ── Types ──────────────────────────────────────────────────────────────────

export type FocusMode = "pomodoro" | "deep_work" | "stopwatch";

export interface FocusTag {
  id: string;
  name: string;
  color: string;
  session_count: number;
  created_at: string;
}

export interface FocusSession {
  id: string;
  mode: FocusMode;
  tag_name?: string | null;
  tag_color?: string | null;
  focus_seconds: number;
  break_seconds: number;
  rounds_completed: number;
  was_abandoned: boolean;
  started_at: string;
  ended_at: string;
}

export interface FocusTagStat {
  tag_id: string | null;
  name: string;
  color: string;
  focus_seconds: number;
  pct: number;
}

export interface FocusStats {
  today: {
    focus_seconds: number;
    break_seconds: number;
    sessions: number;
  };
  weekly_chart: Array<{ date: string; focus_seconds: number }>;
  week_total_focus_seconds: number;
  all_time: {
    total_focus_seconds: number;
    total_sessions: number;
    longest_session_seconds: number;
    avg_session_seconds: number;
    focus_streak_days: number;
    completion_pct: number;
  };
  by_tag: FocusTagStat[];
  recent_sessions: FocusSession[];
}

export interface FocusSettings {
  pomodoro_work_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_rounds: number;
  auto_start_breaks: boolean;
  auto_start_work: boolean;
  sound_enabled: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const fetchFocusTags = (): Promise<FocusTag[]> =>
  apiClient.get<FocusTag[]>("/api/v1/focus/tags").then((r) => (Array.isArray(r) ? r : []));

export const createFocusTag = (name: string, color: string) =>
  apiClient.post<FocusTag>("/api/v1/focus/tags", { name, color });

export const deleteFocusTag = (tagId: string) =>
  apiClient.delete(`/api/v1/focus/tags/${tagId}`);

export interface LogSessionBody {
  mode: FocusMode;
  tag_id?: string | null;
  started_at: string;
  ended_at: string;
  focus_seconds: number;
  break_seconds: number;
  rounds_completed: number;
  was_abandoned: boolean;
}

export const logFocusSession = (body: LogSessionBody) =>
  apiClient.post<{ id: string }>("/api/v1/focus/sessions", body);

export const fetchFocusStats = (): Promise<FocusStats> =>
  apiClient.get<FocusStats>("/api/v1/focus/stats");

export const fetchFocusSettings = (): Promise<FocusSettings> =>
  apiClient.get<FocusSettings>("/api/v1/focus/settings");

export const patchFocusSettings = (updates: Partial<FocusSettings>) =>
  apiClient.patch<FocusSettings>("/api/v1/focus/settings", updates);
