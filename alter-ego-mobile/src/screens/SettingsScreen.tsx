/**
 * Settings Screen — Premium dark single-column grouped list.
 * Accessed from Profile settings icon. Pushed screen with back button.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";
import { supabase } from "@/utils/supabase";
import { NOTIF_PERMISSION_ASKED_KEY } from "../constants/notificationPermission";

const PRIVACY_POLICY_URL = "https://alterego.app/privacy";
const SERVICE_TERMS_URL = "https://alterego.app/terms";
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

// -----------------------------------------------------------------------------
// SVG ICONS (18×18 unless noted)
// -----------------------------------------------------------------------------

function IconProfile() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={6.5} r={3} fill="#8B5CF6" opacity={0.9} />
      <Path
        d="M3 15c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="#6D28D9"
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function IconAccount() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect
        x={2}
        y={4}
        width={14}
        height={10}
        rx={2}
        stroke="#8B5CF6"
        strokeWidth={1.5}
        fill="none"
      />
      <Path d="M2 7h14" stroke="#8B5CF6" strokeWidth={1.5} />
      <Rect x={4} y={10} width={4} height={1.5} rx={0.75} fill="#6D28D9" />
    </Svg>
  );
}

function IconNotifications() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 2.5C6.5 2.5 4.5 4.5 4.5 7v3.5L3 12h12l-1.5-1.5V7C13.5 4.5 11.5 2.5 9 2.5Z"
        fill="#8B5CF6"
        opacity={0.8}
      />
      <Path
        d="M7.5 13.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5"
        stroke="#6D28D9"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={13} cy={4} r={2.5} fill="#F97316" />
    </Svg>
  );
}

function IconContactUs() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6l-3 3V4a1 1 0 0 1 1-1Z"
        fill="#8B5CF6"
        opacity={0.8}
      />
      <Circle cx={6.5} cy={8} r={1} fill="white" opacity={0.9} />
      <Circle cx={9} cy={8} r={1} fill="white" opacity={0.9} />
      <Circle cx={11.5} cy={8} r={1} fill="white" opacity={0.9} />
    </Svg>
  );
}

function IconSubscription() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect
        x={2}
        y={5}
        width={14}
        height={9}
        rx={2}
        stroke="#8B5CF6"
        strokeWidth={1.5}
        fill="none"
      />
      <Path d="M2 8h14" stroke="#8B5CF6" strokeWidth={1.5} />
      <Path
        d="M5.5 11.5h3"
        stroke="#6D28D9"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Circle cx={13} cy={11.5} r={1.2} fill="#8B5CF6" />
    </Svg>
  );
}

function IconToneHistory() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 2C5.7 2 3 4.7 3 8c0 1.4.5 2.7 1.3 3.7L3 15l3.5-1.2C7.5 14.6 8.2 15 9 15c3.3 0 6-2.7 6-6S12.3 2 9 2Z"
        fill="#8B5CF6"
        opacity={0.85}
      />
      <Path
        d="M6 7.5h6M6 10h4"
        stroke="white"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.9}
      />
    </Svg>
  );
}

function IconPrivacyPolicy() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 2L4 4.5v4C4 11.5 6.2 14.3 9 16c2.8-1.7 5-4.5 5-7.5v-4L9 2Z"
        fill="#8B5CF6"
        opacity={0.8}
      />
      <Path
        d="M6.5 9l1.5 1.5 3-3"
        stroke="white"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.9}
      />
    </Svg>
  );
}

function IconServiceTerms() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect
        x={4}
        y={2}
        width={10}
        height={14}
        rx={2}
        stroke="#8B5CF6"
        strokeWidth={1.5}
        fill="none"
      />
      <Line
        x1={6.5}
        y1={6}
        x2={11.5}
        y2={6}
        stroke="#6D28D9"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Line
        x1={6.5}
        y1={9}
        x2={11.5}
        y2={9}
        stroke="#6D28D9"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Line
        x1={6.5}
        y1={12}
        x2={9.5}
        y2={12}
        stroke="#6D28D9"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconDeleteAccount() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3 5h12M7 5V3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V5M6 5l.5 10h5L12 5"
        stroke="#F87171"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Line
        x1={9}
        y1={8}
        x2={9}
        y2={12.5}
        stroke="#F87171"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconLogOut() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"
        stroke="#8B5CF6"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M11 11l3-3-3-3"
        stroke="#8B5CF6"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={14}
        y1={8}
        x2={6}
        y2={8}
        stroke="#8B5CF6"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// -----------------------------------------------------------------------------
// ROW ITEM
// -----------------------------------------------------------------------------

type RowItemProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  showDivider?: boolean;
};

function RowItem({ icon, label, onPress, danger, showDivider }: RowItemProps) {
  return (
    <>
      {showDivider && <View style={styles.rowDivider} />}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
          danger && styles.rowDangerLabel,
        ]}
      >
        <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>{icon}</View>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={danger ? "rgba(248,113,113,0.35)" : "#2D3146"}
        />
      </Pressable>
    </>
  );
}

// -----------------------------------------------------------------------------
// SCREEN
// -----------------------------------------------------------------------------

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const nav = navigation as any;

  const openNotifications = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }, []);

  const resetNotificationPrompt = useCallback(() => {
    Alert.alert(
      "Show notification prompt again",
      "The notification permission screen will appear again the next time you reach the Twin Introduction screen and tap Begin. (Sign out and go through onboarding again to get there.)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            await AsyncStorage.removeItem(NOTIF_PERMISSION_ASKED_KEY);
            Alert.alert("Done", "Next time you go through onboarding and tap Begin, you’ll see the notification screen again.");
          },
        },
      ]
    );
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session?.access_token) {
                await supabase.auth.signOut();
                nav.reset?.({ index: 0, routes: [{ name: "SignUp" }] });
                return;
              }
              const res = await fetch(`${API_BASE}/api/v1/user/account`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Delete failed");
              }
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not delete account");
              return;
            }
            await supabase.auth.signOut();
            nav.reset?.({ index: 0, routes: [{ name: "SignUp" }] });
          },
        },
      ]
    );
  }, [nav]);

  const handleLogOut = useCallback(() => {
    Alert.alert(
      "Log Out",
      "You'll be returned to the sign-in screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              nav.reset?.({ index: 0, routes: [{ name: "SignUp" }] });
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not log out");
            }
          },
        },
      ]
    );
  }, [nav]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 14,
            paddingHorizontal: 16,
          }]
        }
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 20,
            paddingBottom: 40,
            paddingHorizontal: 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Group card 1 — 8 rows */}
        <View style={styles.groupCard}>
          <RowItem
            icon={<IconProfile />}
            label="Profile"
            onPress={() => nav.navigate?.("SettingsProfile")}
            showDivider={false}
          />
          <RowItem
            icon={<IconAccount />}
            label="Account"
            onPress={() => nav.navigate?.("AccountSettings")}
            showDivider
          />
          <RowItem
            icon={<IconNotifications />}
            label="Notifications"
            onPress={openNotifications}
            showDivider
          />
          <RowItem
            icon={<IconNotifications />}
            label="Show notification prompt again"
            onPress={resetNotificationPrompt}
            showDivider
          />
          <RowItem
            icon={<IconContactUs />}
            label="Contact Us"
            onPress={() => nav.navigate?.("ContactUs")}
            showDivider
          />
          <RowItem
            icon={<IconSubscription />}
            label="Subscription"
            onPress={() => nav.navigate?.("Paywall", { dismissable: true })}
            showDivider
          />
          <RowItem
            icon={<IconToneHistory />}
            label="Tone History"
            onPress={() => nav.navigate?.("ToneHistory")}
            showDivider
          />
          <RowItem
            icon={<IconSubscription />}
            label="Shareable cards preview"
            onPress={() => nav.navigate?.("ShareableCardsPreview")}
            showDivider
          />
          <RowItem
            icon={<IconPrivacyPolicy />}
            label="Privacy Policy"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            showDivider
          />
          <RowItem
            icon={<IconServiceTerms />}
            label="Service Terms"
            onPress={() => Linking.openURL(SERVICE_TERMS_URL)}
            showDivider
          />
        </View>

        {/* Group card 2 — Danger zone */}
        <View style={[styles.groupCard, styles.groupCardDanger]}>
          <RowItem
            icon={<IconDeleteAccount />}
            label="Delete Account"
            onPress={handleDeleteAccount}
            danger
            showDivider={false}
          />
        </View>

        {/* Log Out button */}
        <Pressable
          onPress={handleLogOut}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
        >
          <IconLogOut />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.4)",
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.3,
  },
  scroll: { flex: 1 },
  scrollContent: {},

  groupCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 16,
    overflow: "hidden",
  },
  groupCardDanger: {
    borderColor: "rgba(127,29,29,0.30)",
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
    backgroundColor: "rgba(42,48,80,0.5)",
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(109,40,217,0.12)",
    borderWidth: 1,
    borderColor: "rgba(109,40,217,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconBoxDanger: {
    backgroundColor: "rgba(127,29,29,0.15)",
    borderColor: "rgba(239,68,68,0.20)",
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#E5E7EB",
  },
  rowLabelDanger: {
    color: "#F87171",
  },
  rowDangerLabel: {},

  logoutBtn: {
    height: 52,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.20)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutBtnPressed: {
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  logoutLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#8B5CF6",
  },
});
