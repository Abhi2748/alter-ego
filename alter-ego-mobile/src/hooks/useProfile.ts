import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/services/profile';

export const PROFILE_KEYS = {
  overview: ['profile', 'overview'] as const,
  stats: (days: number) => ['profile', 'stats', days] as const,
  streak: ['profile', 'streak'] as const,
  identity: ['profile', 'identity'] as const,
  companion: ['profile', 'companion'] as const,
  interests: ['profile', 'interests'] as const,
  quits: ['profile', 'quits'] as const,
};

export function useProfileOverview() {
  return useQuery({
    queryKey: PROFILE_KEYS.overview,
    queryFn: profileService.getOverview,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useProfileStats(days: number = 30) {
  return useQuery({
    queryKey: PROFILE_KEYS.stats(days),
    queryFn: () => profileService.getStats(days),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useProfileStreak() {
  return useQuery({
    queryKey: PROFILE_KEYS.streak,
    queryFn: profileService.getStreak,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useProfileIdentity() {
  return useQuery({
    queryKey: PROFILE_KEYS.identity,
    queryFn: profileService.getIdentity,
    staleTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useProfileCompanion() {
  return useQuery({
    queryKey: PROFILE_KEYS.companion,
    queryFn: profileService.getCompanion,
    staleTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useProfileInterests() {
  return useQuery({
    queryKey: PROFILE_KEYS.interests,
    queryFn: profileService.getInterests,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useProfileQuits() {
  return useQuery({
    queryKey: PROFILE_KEYS.quits,
    queryFn: profileService.getQuits,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

