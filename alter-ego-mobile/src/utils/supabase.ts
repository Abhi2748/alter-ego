/**
 * Supabase client for ALTER EGO mobile. Uses anon key + RLS.
 * Session persisted with AsyncStorage (required for React Native).
 * When "Sign in later" is used and Anonymous sign-in is disabled in Supabase,
 * we fall back to guest mode: a local-only session so the app can be used with mock API.
 *
 * In project root .env add (Expo loads EXPO_PUBLIC_* automatically):
 *   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 */

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  console.warn(
    "Supabase URL or anon key missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  );
}

/** Retry fetch on transient "Network request failed" (common on Android / flaky networks). */
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
        /network request failed|failed to fetch|network error|could not connect/i.test(msg);
      if (!isNetworkFailure || attempt === MAX_FETCH_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

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

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchWithRetry },
  auth: {
    storage: AsyncStorage,
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
  return originalGetSession();
};
