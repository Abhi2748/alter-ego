/**
 * Notification Permission — shown once after TwinIntroductionScreen before main app.
 * Twin as emotional hook. No back button. Request only on "Allow Notifications" tap.
 * After Allow or Not now: store asked, reset stack to Main.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/utils/supabase";
import { apiClient } from "@/services/api";
import { NOTIF_PERMISSION_ASKED_KEY } from "../constants/notificationPermission";

const TWIN_STAGE_TITLE = "The Focused";

function goToMain(navigation: ReturnType<typeof useNavigation>) {
  type NavWithParent = ReturnType<typeof useNavigation> & {
    getParent?: () => NavWithParent | undefined;
    dispatch: (action: { type: string; payload?: unknown }) => void;
  };
  let nav: NavWithParent | undefined = navigation as NavWithParent;
  while (nav?.getParent?.()) {
    nav = nav.getParent();
  }
  nav?.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Main" }],
    })
  );
}

export function NotificationPermissionScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [requesting, setRequesting] = useState(false);

  const finishAndGoMain = async (didRequest: boolean) => {
    if (didRequest) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          const pushToken = tokenData?.data ?? "";
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
          const { data } = await supabase.auth.getSession();
          if (pushToken || timezone) {
            await apiClient
              .post("/api/v1/settings/notifications", {
                push_token: pushToken || undefined,
                timezone,
                notifications_enabled: true,
              })
              .catch(() => {});
          }
        }
      } catch (_) {}
    }
    await AsyncStorage.setItem(NOTIF_PERMISSION_ASKED_KEY, "true");
    setRequesting(false);
    goToMain(navigation);
  };

  const handleAllow = () => {
    setRequesting(true);
    finishAndGoMain(true);
  };

  const handleNotNow = () => {
    finishAndGoMain(false);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#07080F", "#09091A", "#07080F"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.glow} pointerEvents="none" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentZone}>
          {/* Twin avatar row */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <LinearGradient
                colors={["rgba(110,40,210,0.70)", "rgba(20,15,50,0.95)"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.35, y: 0.35 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.avatarInner} />
            </View>
            <View style={styles.avatarTextCol}>
              <Text style={styles.avatarLabel}>Shadow Twin</Text>
              <Text style={styles.avatarStage}>{TWIN_STAGE_TITLE}</Text>
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>
            Your Twin{"\n"}
            <Text style={styles.headlineAccent}>doesn&apos;t wait.</Text>
          </Text>

          {/* Sub-headline */}
          <Text style={styles.subheadline}>
            Allow notifications so your Twin can reach you when it matters — before you lose your streak.
          </Text>

          {/* Preview 1 */}
          <View style={styles.preview1}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.15)", "transparent"]}
              style={styles.previewSheen}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <View style={styles.previewHeader}>
              <LinearGradient
                colors={["#5B21B6", "#8B5CF6"]}
                style={styles.previewIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="flash" size={12} color="#FFF" />
              </LinearGradient>
              <Text style={styles.previewAppName}>ALTER EGO</Text>
              <Text style={styles.previewTime}>Now</Text>
            </View>
            <Text style={styles.previewTitle1}>Your Twin completed today. You haven&apos;t.</Text>
            <Text style={styles.previewBody1}>
              &quot;The gap grew by another day. Still time to close it.&quot;
            </Text>
          </View>

          {/* Preview 2 */}
          <View style={styles.preview2}>
            <View style={[styles.previewHeader, styles.preview2Header]}>
              <LinearGradient
                colors={["#5B21B6", "#8B5CF6"]}
                style={[styles.previewIcon, { opacity: 0.5 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="flash" size={12} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.previewAppName, { opacity: 0.5 }]}>ALTER EGO</Text>
              <Text style={styles.previewTime}>9:00 PM</Text>
            </View>
            <Text style={styles.previewTitle2}>Your streak ends in 2 hours.</Text>
            <Text style={styles.previewBody2}>&quot;Three missions left. You know what to do.&quot;</Text>
          </View>

          {/* What you get */}
          <View style={styles.bullets}>
            {[
              "Streak reminders before midnight",
              "Twin messages when the gap changes",
              "Weekly report arrives Sunday evening",
            ].map((label, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* CTA zone */}
      <View style={[styles.ctaZone, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleAllow}
          disabled={requesting}
          style={({ pressed }) => [styles.allowBtn, pressed && styles.allowBtnPressed]}
        >
          <LinearGradient
            colors={["#5B21B6", "#8B5CF6"]}
            style={styles.allowGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="notifications" size={18} color="rgba(255,255,255,0.9)" />
            <Text style={styles.allowLabel}>
              {requesting ? "…" : "Allow Notifications"}
            </Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={handleNotNow} style={({ pressed }) => pressed && styles.skipPressed}>
          <Text style={styles.skipLabel}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: "absolute",
    top: 60,
    left: "50%",
    marginLeft: -140,
    width: 280,
    height: 200,
    borderRadius: 140,
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? {}
      : {
          shadowColor: "rgba(80,20,160,0.16)",
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 100,
          shadowOpacity: 1,
          elevation: 0,
        }),
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  contentZone: { flex: 1, justifyContent: "center" },

  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.45)",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(109,40,217,0.30)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 16,
      shadowOpacity: 1,
      elevation: 8,
    }),
  },
  avatarInner: { flex: 1, width: 48, height: 48 },
  avatarTextCol: {},
  avatarLabel: { fontSize: 14, fontWeight: "700", color: "#E5E7EB" },
  avatarStage: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  headline: {
    fontSize: 28,
    fontWeight: "900",
    color: "#E5E7EB",
    letterSpacing: -0.5,
    lineHeight: 33.6,
    marginBottom: 10,
  },
  headlineAccent: { color: "#A78BFA" },
  subheadline: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 24,
    marginBottom: 28,
  },

  preview1: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  previewSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  previewIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  previewAppName: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.50)" },
  previewTime: { fontSize: 11, color: "rgba(255,255,255,0.30)", marginLeft: "auto" },
  previewTitle1: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    marginBottom: 3,
  },
  previewBody1: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 16.8,
    fontStyle: "italic",
  },

  preview2: {
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 28,
  },
  preview2Header: { marginBottom: 6 },
  previewTitle2: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.50)",
  },
  previewBody2: {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    fontStyle: "italic",
    marginTop: 2,
  },

  bullets: { marginBottom: 32 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(139,92,246,0.50)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 5,
      shadowOpacity: 1,
      elevation: 4,
    }),
  },
  bulletText: { fontSize: 13, color: "#9CA3AF", flex: 1 },

  ctaZone: { paddingHorizontal: 24 },
  allowBtn: {
    height: 56,
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(139,92,246,0.40)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 24,
      shadowOpacity: 1,
      elevation: 12,
    }),
  },
  allowBtnPressed: { opacity: 0.92 },
  allowGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  allowLabel: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  skipLabel: { fontSize: 14, color: "#374151", textAlign: "center", paddingVertical: 12 },
  skipPressed: { opacity: 0.7 },
});
