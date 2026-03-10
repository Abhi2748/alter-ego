import "./global.css";
import {
  useFonts,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, ActivityIndicator, AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { RootStack } from "./src/navigation/RootStack";
import { COLORS } from "./src/constants/theme";
import { supabase } from "./src/utils/supabase";
import { patchUserMe } from "./src/utils/api";

// Suppress React 19 ref warning from dependencies (e.g. React Navigation) until they support ref-as-prop
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : String(args[0]);
  if (msg.includes("Accessing element.ref was removed in React 19")) return;
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

async function registerPushTokenAndTimezone(accessToken: string) {
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
      await patchUserMe(accessToken, { push_token: pushToken || undefined, timezone });
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
  });

  useEffect(() => {
    const onSession = (token: string) => registerPushTokenAndTimezone(token);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
        onSession(session.access_token);
      }
    });
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData?.session?.access_token) onSession(sessionData.session.access_token);
    });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") return;
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.access_token) {
          patchUserMe(data.session.access_token, {
            last_opened_at: new Date().toISOString(),
          }).catch(() => {});
        }
      });
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.violet} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <RootStack />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
