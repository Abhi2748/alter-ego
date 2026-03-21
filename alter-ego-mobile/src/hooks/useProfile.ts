import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/services/profile';

export const PROFILE_KEYS = {
  overview: ['profile', 'overview'] as const,
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
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function useProfileCompanion() {
  return useQuery({
    queryKey: PROFILE_KEYS.companion,
    queryFn: profileService.getCompanion,
    staleTime: 10 * 60 * 1000,
    refetchOnMount: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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

