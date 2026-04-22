/**
 * All authentication functions the app uses.
 *
 * signInAnonymously()   — "Sign in later" button
 * signInWithGoogle()    — "Continue with Google" button
 * linkGoogleAccount()   — Settings → "Connect Google account"
 * signOut()             — Settings → Sign out
 * getCurrentSession()   — Called on app startup
 * getAuthToken()        — Returns JWT for API calls
 */

import { supabase } from '@/utils/supabase';
import * as WebBrowser from 'expo-web-browser';
// Required for Google OAuth redirect to work on iOS
WebBrowser.maybeCompleteAuthSession();

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  userId?: string;
  isAnonymous?: boolean;
  error?: string;
}

// ── Sign in anonymously ("Sign in later") ──────────────────────────────────

export async function signInAnonymously(): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    return {
      success: true,
      userId: data.user.id,
      isAnonymous: true,
    };
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Anonymous sign-in failed:', error);
    return {
      success: false,
      error: error.message ?? 'Sign in failed',
    };
  }
}

// ── Sign in with Google ────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const redirectUri = "alter-ego://";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
        // skipBrowserRedirect: we handle opening the browser ourselves
        // so we can properly handle the redirect back to the app
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    // Open Google sign-in in a browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type !== 'success') {
      return { success: false, error: 'Sign in cancelled' };
    }

    let sessionData;
    let sessionError;
    if (result.url.includes('access_token')) {
      const fragment = result.url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token') ?? '';
      const refresh_token = params.get('refresh_token') ?? '';
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      sessionData = data;
      sessionError = error;
    } else {
      const { data, error } = await supabase.auth.exchangeCodeForSession(result.url);
      sessionData = data;
      sessionError = error;
    }

    if (sessionError) throw sessionError;

    return {
      success: true,
      userId: sessionData?.user?.id,
      isAnonymous: false,
    };
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Google sign-in failed:', error);
    return {
      success: false,
      error: error.message ?? 'Google sign in failed',
    };
  }
}

// ── Link Google to anonymous account ──────────────────────────────────────

export async function linkGoogleAccount(): Promise<AuthResult> {
  try {
    const redirectUri = "alter-ego://";

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type !== 'success') {
      return { success: false, error: 'Linking cancelled' };
    }

    // Exchange the PKCE code returned in the redirect URL.
    // refreshSession() alone is insufficient after linkIdentity.
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(result.url);
    if (exchangeError) throw exchangeError;

    const { data: refreshed, error: refreshError } =
      await supabase.auth.getSession();

    if (refreshError) throw refreshError;

    // Notify backend to update email_connected = true
    const token = await getAuthToken();
    if (token) {
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/link-google`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      success: true,
      userId: refreshed.session?.user?.id,
      isAnonymous: false,
    };
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Google link failed:', error);
    const msg = String(error?.message ?? error ?? '');
    const lower = msg.toLowerCase();
    if (lower.includes('manual linking') && lower.includes('disabled')) {
      return {
        success: false,
        error:
          'Google linking is turned off for this project. In Supabase Dashboard → Authentication → Settings, enable “Manual identity linking”, then try again. You can also use Email below to create a full account.',
      };
    }
    return {
      success: false,
      error: error.message ?? 'Linking failed',
    };
  }
}

// ── Sign out ───────────────────────────────────────────────────────────────

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── Get current session ────────────────────────────────────────────────────

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session;
}

// ── Get auth token (JWT) for API calls ────────────────────────────────────

export async function getAuthToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token ?? null;
}

// ── Check if current user is anonymous ────────────────────────────────────

export async function isAnonymousUser(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.is_anonymous ?? true;
}

// ── Auth state change listener ────────────────────────────────────────────
// Use this in your root App component to react to sign-in/sign-out events

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return subscription; // Call subscription.unsubscribe() in cleanup
}

// ── Email OTP ──────────────────────────────────────────────────────────────

export async function sendEmailOtp(email: string): Promise<AuthResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const isAnon = sessionData?.session?.user?.is_anonymous === true;

    if (isAnon) {
      // Link email to existing anonymous account
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    } else {
      // Fresh sign-in / sign-up via OTP
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Failed to send OTP' };
  }
}

export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return {
      success: true,
      userId: data.user?.id,
      isAnonymous: false,
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Invalid or expired code' };
  }
}

