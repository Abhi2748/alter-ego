/**
 * Root providers wrapper.
 * Wraps the entire app with React Query and initialises auth on startup.
 *
 * Add this as the outermost wrapper in App.tsx (or _layout.tsx if using Expo Router).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { apiClient } from '@/services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before considering it stale
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes even if no subscribers
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      // Don't refetch when window regains focus (mobile app — not relevant)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchProfile = useUserStore((state) => state.fetchProfile);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Initialize auth on app startup
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Defer profile fetch so create-profile / onboarding row isn’t racing this request
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => {
      void fetchProfile();
    }, 1000);
    return () => clearTimeout(t);
  }, [isAuthenticated, fetchProfile]);

  // Keep backend users.timezone aligned with device (travel, DST, manual OS change).
  useEffect(() => {
    if (!isAuthenticated) return;

    const pushTz = () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          void apiClient.post('/api/v1/settings/notifications', { timezone: tz }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };

    pushTz();

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        pushTz();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [isAuthenticated]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
