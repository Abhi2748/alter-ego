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
import { makeRedirectUri } from 'expo-auth-session';

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
    // Build the redirect URI — this is where Google sends the user back
    // In Expo Go / development: uses the Expo proxy
    // In production build: uses your app scheme
    const redirectUri = makeRedirectUri({
      scheme: 'alter-ego',
      // For Expo Go testing, use: scheme: undefined, useProxy: true
    });

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

    // Extract the session from the redirect URL
    const { url } = result;
    const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1]);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken) {
      return { success: false, error: 'No access token in redirect' };
    }

    // Set the session in Supabase client
    const { data: sessionData, error: sessionError } =
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      });

    if (sessionError) throw sessionError;

    return {
      success: true,
      userId: sessionData.user?.id,
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
    const redirectUri = makeRedirectUri({ scheme: 'alter-ego' });

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

    // Refresh the session after linking
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

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
      userId: refreshed.user?.id,
      isAnonymous: false,
    };
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Google link failed:', error);
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

