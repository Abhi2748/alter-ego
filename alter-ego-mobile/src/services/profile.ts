import { apiClient } from '@/services/api';

export const profileService = {
  getOverview: () => apiClient.get('/api/v1/profile/overview'),

  getStreak: () => apiClient.get('/api/v1/profile/streak'),

  getIdentity: () => apiClient.get('/api/v1/profile/identity'),

  getCompanion: () => apiClient.get('/api/v1/profile/companion'),

  getInterests: () => apiClient.get('/api/v1/profile/interests'),

  getQuits: () => apiClient.get('/api/v1/profile/quits'),
};

