/**
 * Settings Screen §22 (v1.1). Accessed from Profile header.
 * Rows: Profile, Notifications, Twin Tone History, Subscription, Logout.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { COLORS, SPACING, GRADIENTS, RADIUS } from "../constants/theme";
import { ToneHistoryModal } from "../components/ToneHistoryModal";
import { supabase } from "../utils/supabase";

const ROW_HEIGHT = 56;
const ROW_PADDING_H = 16;
const ICON_SIZE = 24;
const ICON_COLOR = "#9CA3AF";
const CHEVRON_SIZE = 16;
const SWITCH_ACTIVE = COLORS.violet;
const SWITCH_INACTIVE = "#374151";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [toneHistoryVisible, setToneHistoryVisible] = useState(false);

  const openNotifications = useCallback(() => {
    Linking.openSettings();
  }, []);

  const openToneHistory = useCallback(() => {
    setToneHistoryVisible(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      (navigation as any).reset({
        index: 0,
        routes: [{ name: "SignUp" }],
      });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not log out");
    }
  }, [navigation]);

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.list}>
        {/* Profile */}
        <Pressable
          style={styles.row}
          onPress={() => {
          const nav = navigation as any;
          if (nav.navigate) nav.navigate("SettingsProfile");
          else nav.getParent()?.navigate("SettingsProfile");
        }}
        >
          <Ionicons
            name="person-circle-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel}>Profile</Text>
            <Text style={styles.rowSubLabel}>Edit your information</Text>
          </View>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={COLORS.muted} />
        </Pressable>

        {/* Notifications */}
        <Pressable style={styles.row} onPress={openNotifications}>
          <Ionicons
            name="notifications-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <Text style={[styles.rowLabel, styles.rowLabelFlex]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={COLORS.muted} />
        </Pressable>

        {/* Twin Tone History */}
        <Pressable style={styles.row} onPress={openToneHistory}>
          <Ionicons
            name="heart-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel}>Twin Tone History</Text>
            <Text style={styles.rowSubLabel}>
              See what tones you've responded to
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={COLORS.muted} />
        </Pressable>

        {/* Subscription — subscribe anytime; Paywall also shown automatically when trial ends */}
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate("Paywall" as never)}
        >
          <Ionicons
            name="card-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel}>Subscription</Text>
            <Text style={styles.rowSubLabel}>
              Subscribe now or when your trial ends
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={COLORS.muted} />
        </Pressable>

        {/* Logout — full-width primary-style button */}
        <View style={styles.logoutWrap}>
          <Pressable onPress={logout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}>
            <LinearGradient
              colors={GRADIENTS.button.colors}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.logoutBtnGradient}
            >
              <Text style={styles.logoutLabel}>Log out</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <ToneHistoryModal
        visible={toneHistoryVisible}
        onClose={() => setToneHistoryVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    backgroundColor: COLORS.glass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  backBtn: { marginRight: SPACING.sm },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  list: {
    paddingTop: 16,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    paddingHorizontal: ROW_PADDING_H,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface2,
  },
  rowIcon: {
    marginRight: 16,
  },
  rowLabelWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  rowLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
  },
  rowLabelFlex: {
    flex: 1,
  },
  rowLabelDanger: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.danger,
  },
  segmentedWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  segmentedSegment: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentedSegmentActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: COLORS.violet,
  },
  segmentedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: COLORS.muted,
  },
  segmentedTextActive: {
    color: COLORS.violet,
  },
  rowSubLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  freezeBadge: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.chip,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  freezeBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.violet,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.screenPadding,
  },
  connectModalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.modal,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connectModalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 4,
  },
  connectModalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    marginBottom: SPACING.md,
  },
  connectEmailInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.bg1,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  connectBtn: {
    backgroundColor: COLORS.violet,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  connectBtnDisabled: { opacity: 0.6 },
  connectBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
  },
  connectDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  connectProviderBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  connectProviderText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.violet,
  },
  connectCancel: {
    paddingVertical: SPACING.sm,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  connectCancelText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
  },
  logoutWrap: {
    marginTop: SPACING.xl,
    paddingHorizontal: ROW_PADDING_H,
    paddingBottom: SPACING.xl,
  },
  logoutBtn: {
    height: 52,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  logoutBtnPressed: {
    opacity: 0.9,
  },
  logoutBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
