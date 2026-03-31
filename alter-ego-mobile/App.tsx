import "./global.css";
import {
  useFonts,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, AppState, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme, type Theme } from "@react-navigation/native";
import { RootStack } from "./src/navigation/RootStack";
import { COLORS } from "./src/constants/theme";
import { AppProviders } from "./src/providers/AppProviders";
import { supabase } from "@/utils/supabase";
import { apiClient } from "./src/services/api";
import { useAuthStore } from "./src/store/authStore";
import { twinService, type GapMoment } from "./src/services/twin";
import { GapMomentScreen } from "./src/screens/GapMomentScreen";

// Suppress React 19 ref warning from dependencies (e.g. React Navigation) until they support ref-as-prop
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : String(args[0]);
  if (msg.includes("Accessing element.ref was removed in React 19")) return;
  // Supabase still console.error()s on INITIAL_SESSION when refresh token is stale/revoked,
  // even after clearing storage — avoid LogBox noise; user is treated as signed out.
  const flat = args
    .map((a) => (a instanceof Error ? a.message : String(a)))
    .join(" ")
    .toLowerCase();
  if (
    flat.includes("invalid refresh token") ||
    flat.includes("refresh token not found")
  ) {
    return;
  }
  originalError.apply(console, args);
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#0D0F1A",
    card: "#0D0F1A",
  },
};

/**
 * Register push token and timezone with backend when the user has a session.
 * In Expo Go (SDK 53+), expo-notifications shows a warning and push does not work;
 * use a development build for real push. The warning appears when this code runs
 * (e.g. after sign-in or on app open with existing session).
 */
async function registerPushTokenAndTimezone() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== "granted") return;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData?.data ?? "";
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    if (pushToken || timezone) {
      await apiClient.post("/api/v1/settings/notifications", {
        push_token: pushToken || undefined,
        timezone,
        notifications_enabled: true,
      });
    }
  } catch (_) {
    // Non-blocking; nudge/report still work without token
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    const onSession = () => {
      void registerPushTokenAndTimezone();
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
        onSession();
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (sessionData?.session?.access_token) onSession();
      })
      .catch(() => {});
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.violet} />
      </View>
    );
  }

  return (
    <AppProviders>
      <AppRootWithGapMoment navTheme={navTheme} />
    </AppProviders>
  );
}

function AppRootWithGapMoment({ navTheme }: { navTheme: Theme }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [pendingMoment, setPendingMoment] = useState<GapMoment | null>(null);

  const checkMoment = useCallback(async () => {
    if (!isAuthenticated || isLoading) return;
    try {
      const moment = await twinService.getGapMoment();
      if (moment) setPendingMoment(moment);
    } catch {
      // non-blocking
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    void checkMoment();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkMoment();
    });
    return () => sub.remove();
  }, [checkMoment]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <RootStack />
        </NavigationContainer>
        {pendingMoment ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <GapMomentScreen moment={pendingMoment} onDismiss={() => setPendingMoment(null)} />
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}
