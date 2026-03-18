/**
 * Root providers wrapper.
 * Wraps the entire app with React Query and initialises auth on startup.
 *
 * Add this as the outermost wrapper in App.tsx (or _layout.tsx if using Expo Router).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';

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

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
