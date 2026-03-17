/**
 * Supabase client for the mobile app.
 * Uses anon key only — service role key never goes in the app.
 * Uses AsyncStorage for session persistence across app restarts.
 * Uses ExpoSecureStore for the session token (encrypted on device).
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Custom storage adapter.
 * Uses SecureStore on iOS/Android (encrypted) and AsyncStorage as fallback.
 * Supabase uses this to persist the session token between app opens.
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
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
      if (Platform.OS === 'web') {
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
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // detectSessionInUrl must be false for React Native
  },
});

