/**
 * Zustand user store.
 * Caches the user's profile data so every screen
 * doesn't need to re-fetch from the API.
 *
 * Updated after: login, mission completion, stage evolution,
 * pet evolution, streak update.
 */

import { create } from 'zustand';
import { apiClient, isApiError } from '@/services/api';
import { computeCharacterXpDerived } from '@/constants/characterProgression';

// Matches the /api/v1/profile/overview response shape
export interface UserProfile {
  username: string;
  archetype: string;
  character_stage: number;
  character_stage_name: string;
  total_xp: number;
  xp_to_next_stage: number;
  stage_progress_pct: number;
  pet_stage: number;
  pet_name: string | null;
  pet_unlocked: boolean;
  total_pf: number;
  pf_to_next_pet: number;
  pf_progress_pct: number;
  current_streak: number;
  longest_streak: number;
  power_score: number;
  registration_date: string;
  leaderboard_unlocked: boolean;
  email_connected: boolean;
  subscription_tier: string;
  unread_mail_count: number;
  /** Optional; shown on Profile when set */
  profile_photo_url?: string | null;
  /** From discipline_dna — Twin voice */
  twin_tone_type?: string;
  twin_intensity?: number;
}

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
  updateXP: (
    xpEarned: number,
    newTotal: number,
    evolvedStage?: { stage: number; name: string }
  ) => void;
  updatePF: (pfEarned: number, newTotal: number) => void;
  updateStreak: (newStreak: number) => void;
  updateStage: (newStage: number, newStageName: string) => void;
  updatePetStage: (newPetStage: number, newPetName: string) => void;
  incrementUnreadMail: () => void;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await apiClient.get<UserProfile>(
        '/api/v1/profile/overview'
      );
      const u = profile?.username;
      if (u == null || String(u).trim() === '') {
        set({ profile: null, isLoading: false, error: null });
        return;
      }
      set({ profile, isLoading: false });
    } catch (error: unknown) {
      if (
        isApiError(error) &&
        (error.status === 500 ||
          error.status === 404 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504)
      ) {
        set({ profile: null, isLoading: false, error: null });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load profile';
      set({ error: message, isLoading: false });
    }
  },

  // Optimistic updates — called immediately after mission completion
  // so the UI updates instantly without waiting for a re-fetch
  updateXP: (_xpEarned, newTotal, evolvedStage) => {
    const profile = get().profile;
    if (!profile) return;
    const stage = evolvedStage?.stage ?? profile.character_stage;
    const character_stage_name =
      evolvedStage?.name ?? profile.character_stage_name;
    const { xp_to_next_stage, stage_progress_pct } =
      computeCharacterXpDerived(newTotal, stage);
    set({
      profile: {
        ...profile,
        total_xp: newTotal,
        character_stage: stage,
        character_stage_name,
        xp_to_next_stage,
        stage_progress_pct,
      },
    });
  },

  updatePF: (pfEarned, newTotal) => {
    const profile = get().profile;
    if (!profile) return;
    set({
      profile: {
        ...profile,
        total_pf: newTotal,
        pf_to_next_pet: Math.max(0, profile.pf_to_next_pet - pfEarned),
      },
    });
  },

  updateStreak: (newStreak) => {
    const profile = get().profile;
    if (!profile) return;
    set({
      profile: {
        ...profile,
        current_streak: newStreak,
        longest_streak: Math.max(profile.longest_streak, newStreak),
      },
    });
  },

  updateStage: (newStage, newStageName) => {
    const profile = get().profile;
    if (!profile) return;
    set({
      profile: {
        ...profile,
        character_stage: newStage,
        character_stage_name: newStageName,
        stage_progress_pct: 0,
      },
    });
  },

  updatePetStage: (newPetStage, newPetName) => {
    const profile = get().profile;
    if (!profile) return;
    set({
      profile: {
        ...profile,
        pet_stage: newPetStage,
        pet_name: newPetName,
      },
    });
  },

  incrementUnreadMail: () => {
    const profile = get().profile;
    if (!profile) return;
    set({
      profile: {
        ...profile,
        unread_mail_count: profile.unread_mail_count + 1,
      },
    });
  },

  clearProfile: () => set({ profile: null, error: null }),
}));
