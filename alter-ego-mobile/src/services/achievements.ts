/**
 * Achievements API service.
 * Backend endpoint: GET /api/v1/achievements
 * Returns null gracefully if backend not yet built.
 */

import { apiClient } from '@/services/api';

export type AchievementCategory =
  | 'season'
  | 'streak'
  | 'discipline'
  | 'character'
  | 'companion'
  | 'quit'
  | 'interest'
  | 'power';

export type BadgeShape = 'shield' | 'hexagon' | 'octagon' | 'circle' | 'diamond';

export interface Achievement {
  id: string;
  key: string;                    // e.g. 'season_1_gold', 'streak_7'
  category: AchievementCategory;
  name: string;                   // e.g. "The Sparked"
  description: string;            // e.g. "Completed Season 1 with a Perfect tier."
  badge_shape: BadgeShape;
  badge_color: string;            // hex primary color for the badge
  /** API field name; mobile maps to badge_secondary_color in UI */
  badge_secondary?: string;
  badge_secondary_color: string;  // hex secondary/dark color
  earned: boolean;
  earned_at: string | null;       // ISO date string
  sort_order: number;
}

export interface AchievementsResponse {
  total: number;
  earned_count: number;
  achievements: Achievement[];
  /** The most recently earned achievement, for the featured slot */
  featured: Achievement | null;
}

export const achievementsService = {
  getAll: () =>
    apiClient.get<AchievementsResponse>('/api/v1/achievements'),
};
