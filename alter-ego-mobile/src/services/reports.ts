/**
 * Weekly + day archive reports. Uses apiClient (auth + retries).
 */

import { apiClient } from "@/services/api";

export type WeeklyReportApiRow = {
  id?: string;
  user_id?: string;
  week_start: string;
  week_end?: string;
  this_week_data?: Record<string, unknown>;
  wins?: string[];
  slipped?: string[];
  keep_watching?: string | string[] | null;
  twin_paragraph?: string | null;
  twin_closing?: string | null;
  next_week?: string | null;
  created_at?: string;
  generated_at?: string;
};

export type CurrentWeeklyResponse =
  | {
      available: true;
      week_start: string;
      week_end?: string;
      this_week_data?: Record<string, unknown>;
      wins?: string[];
      slipped?: string[];
      keep_watching?: string | string[] | null;
      twin_paragraph?: string | null;
      twin_closing?: string | null;
      next_week?: string | null;
      generated_at?: string;
    }
  | { available: false; message?: string };

export type PreviousWeeklyResponse =
  | ({ available: true } & WeeklyReportApiRow)
  | { available: false };

export type DaySummaryResponse = {
  date: string;
  summary: string;
};

export type WeeklyDetailResponse =
  | ({
      available: true;
      id?: string;
      week_start: string;
      week_end?: string;
      this_week_data?: Record<string, unknown>;
      wins?: string[];
      slipped?: string[];
      keep_watching?: string | string[] | null;
      twin_paragraph?: string | null;
      twin_closing?: string | null;
      next_week?: string | null;
      generated_at?: string;
    } & Record<string, unknown>)
  | { available: false; message?: string };

export const reportsService = {
  getCurrentWeekly: () =>
    apiClient.get<CurrentWeeklyResponse>("/api/v1/reports/weekly"),

  getPreviousWeekly: () =>
    apiClient.get<PreviousWeeklyResponse>("/api/v1/reports/weekly/previous"),

  getDaySummary: (dateStr: string) =>
    apiClient.get<DaySummaryResponse>(`/api/v1/reports/day/${dateStr}`),

  getWeeklyById: (reportId: string) =>
    apiClient.get<WeeklyDetailResponse>(
      `/api/v1/reports/weekly/detail/${encodeURIComponent(reportId)}`
    ),
};
