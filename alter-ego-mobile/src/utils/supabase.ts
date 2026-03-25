/**
 * Single Supabase client for ALTER EGO mobile. Uses anon key + RLS.
 * Session persisted with Expo SecureStore (iOS/Android) or AsyncStorage (web).
 * Optional guest mode when "Sign in later" is used and anonymous sign-in is disabled.
 *
 * In .env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  console.warn(
    "Supabase URL or anon key missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  );
}

/** Retry fetch on transient network failures (common on Android / flaky networks). */
const MAX_FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY_MS = 800;

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isNetworkFailure =
        /network request failed|failed to fetch|network error|could not connect/i.test(
          msg
        );
      if (!isNetworkFailure || attempt === MAX_FETCH_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        return AsyncStorage.getItem(key);
      }
      const value = await SecureStore.getItemAsync(key);
      return value ?? null;
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

const GUEST_STORAGE_KEY = "alter_ego_guest";

const guestSession = {
  access_token: "guest",
  refresh_token: "",
  expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
  expires_in: 86400 * 365,
  token_type: "bearer",
  user: {
    id: "guest-user",
    email: null,
    is_anonymous: true,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

export async function setGuestMode(): Promise<void> {
  await AsyncStorage.setItem(GUEST_STORAGE_KEY, "1");
}

export async function clearGuestMode(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
}

export async function isGuestMode(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_STORAGE_KEY)) === "1";
}

/** Revoked / missing refresh token on server — treat as signed out, no red screen noise. */
function isInvalidRefreshAuthError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("invalid refresh token") ||
    msg.includes("refresh token not found")
  );
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchWithRetry },
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async () => {
  const guest = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
  if (guest === "1") {
    return { data: { session: guestSession }, error: null };
  }
  try {
    const result = await originalGetSession();
    const err = result.error;
    if (err && isInvalidRefreshAuthError(err)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return { data: { session: null }, error: null };
    }
    return result;
  } catch (e: unknown) {
    if (isInvalidRefreshAuthError(e)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return { data: { session: null }, error: null };
    }
    // Network / storage / transient Supabase errors must not reject cold start —
    // otherwise Splash never navigates (unhandled rejection in setTimeout).
    console.warn("[supabase] getSession failed; treating as signed out", e);
    return { data: { session: null }, error: null };
  }
};
