/**
 * Zustand auth store.
 * Single source of truth for the user's authentication state.
 *
 * Screens read from this store — never call supabase.auth directly from screens.
 */

import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { migrateLegacyAuthSessionFromSecureStore, supabase } from '@/utils/supabase';

/** Avoid duplicate onAuthStateChange subscriptions if initialize() runs more than once. */
let authListenerAttached = false;

interface AuthState {
  // State
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  signInAnonymously: () => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAnonymous: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      isAnonymous: session?.user?.is_anonymous ?? false,
      isLoading: false,
    });
  },

  initialize: async () => {
    // Called once on app startup — restores session from AsyncStorage (legacy: copy from SecureStore once).
    set({ isLoading: true });
    try {
      await migrateLegacyAuthSessionFromSecureStore();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        get().setSession(null);
      } else {
        get().setSession(session);
      }
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      get().setSession(null);
    }

    if (!authListenerAttached) {
      authListenerAttached = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        get().setSession(session);
      });
    }
  },

  signInAnonymously: async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      get().setSession(data.session);
      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Sign in failed';
      return { success: false, error: message };
    }
  },

  signInWithGoogle: async () => {
    // Delegates to auth service — same implementation as B2
    try {
      const { signInWithGoogle } = await import('@/services/auth');
      const result = await signInWithGoogle();
      if (result.success) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        get().setSession(session);
      }
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Google sign in failed';
      return { success: false, error: message };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      isAuthenticated: false,
      isAnonymous: false,
    });
  },

  refreshSession: async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        const msg = String((error as { message?: string }).message || error).toLowerCase();
        if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        get().setSession(null);
        return;
      }
      get().setSession(data.session ?? null);
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      get().setSession(null);
    }
  },
}));
