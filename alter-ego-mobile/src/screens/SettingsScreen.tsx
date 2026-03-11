/**
 * Settings Screen §22 (v1.1). Accessed from Profile header.
 * Rows: Connect email/account (when anonymous), Anonymous Mode, Notifications, etc.
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { COLORS, SPACING, GRADIENTS, RADIUS } from "../constants/theme";
import { ToneHistoryModal } from "../components/ToneHistoryModal";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";
import { supabase } from "../utils/supabase";

const NUDGE_FREQUENCY_KEY = "nudge_frequency";
export type NudgeFrequency = "low" | "medium" | "high";
const NUDGE_FREQUENCY_DEFAULT: NudgeFrequency = "medium";

const ROW_HEIGHT = 56;
const ROW_PADDING_H = 16;
const ICON_SIZE = 24;
const ICON_COLOR = "#9CA3AF";
const CHEVRON_SIZE = 16;
const SWITCH_ACTIVE = COLORS.violet;
const SWITCH_INACTIVE = "#374151";

const STREAK_FREEZES_REMAINING = 2;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [nudgeFrequency, setNudgeFrequency] = useState<NudgeFrequency>(NUDGE_FREQUENCY_DEFAULT);
  const [toneHistoryVisible, setToneHistoryVisible] = useState(false);
  const [milestonePreviewVisible, setMilestonePreviewVisible] = useState(false);
  const [connectAccountVisible, setConnectAccountVisible] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [connectEmailInput, setConnectEmailInput] = useState("");
  const [connectSending, setConnectSending] = useState(false);
  const [connectLinking, setConnectLinking] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NUDGE_FREQUENCY_KEY);
        if (stored === "low" || stored === "medium" || stored === "high") {
          setNudgeFrequency(stored);
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAnonymous(session?.user?.is_anonymous === true);
      setUserEmail(session?.user?.email ?? null);
    })();
  }, [connectAccountVisible]);

  const showConnectAccount = isAnonymous || !userEmail;

  const redirectTo = makeRedirectUri({ scheme: "alterego", path: "auth" });

  const sendConnectEmailLink = useCallback(async () => {
    const email = connectEmailInput.trim();
    if (!email) return;
    setConnectSending(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setConnectAccountVisible(false);
      setConnectEmailInput("");
      Alert.alert(
        "Check your email",
        "We sent you a link to connect this account. Open it to finish.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to send link");
    } finally {
      setConnectSending(false);
    }
  }, [connectEmailInput, redirectTo]);

  const linkProvider = useCallback(async (provider: "apple" | "google") => {
    setConnectLinking(provider);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) {
        Alert.alert("Error", "Could not link account");
        return;
      }
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === "success" && res.url) {
        const fragment = res.url.includes("#") ? res.url.split("#")[1] : res.url.split("?")[1] || "";
        const params = new URLSearchParams(fragment);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          setConnectAccountVisible(false);
        }
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to link");
    } finally {
      setConnectLinking(null);
    }
  }, [redirectTo]);

  const setNudgeFrequencyAndSave = useCallback(async (value: NudgeFrequency) => {
    setNudgeFrequency(value);
    try {
      await AsyncStorage.setItem(NUDGE_FREQUENCY_KEY, value);
    } catch (_) {}
  }, []);

  const openNotifications = useCallback(() => {
    Linking.openSettings();
  }, []);

  const openToneHistory = useCallback(() => {
    setToneHistoryVisible(true);
  }, []);

  const deleteAccount = useCallback(() => {
    Alert.alert(
      "Delete account",
      "This will permanently delete all your progress. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {} },
      ]
    );
  }, []);

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
        {/* Connect email or account — when anonymous or no email */}
        {showConnectAccount && (
          <Pressable style={styles.row} onPress={() => setConnectAccountVisible(true)}>
            <Ionicons name="link-outline" size={ICON_SIZE} color={COLORS.violet} style={styles.rowIcon} />
            <View style={styles.rowLabelWrap}>
              <Text style={styles.rowLabel}>Connect email or account</Text>
              <Text style={styles.rowSubLabel}>
                Link your email or sign in with Google/Apple to save your progress
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={COLORS.muted} />
          </Pressable>
        )}

        {/* Row — Anonymous Mode */}
        <View style={styles.row}>
          <Ionicons
            name="eye-off-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel}>Anonymous Mode</Text>
            <Text style={styles.rowSubLabel}>
              Hide your identity from leaderboard
            </Text>
          </View>
          <Switch
            value={anonymousMode}
            onValueChange={setAnonymousMode}
            trackColor={{ false: SWITCH_INACTIVE, true: SWITCH_ACTIVE }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Row 2 — Notifications */}
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

        {/* Row 3 — Notification Frequency (segmented: Low | Medium | High) */}
        <View style={styles.row}>
          <Ionicons
            name="notifications-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <Text style={[styles.rowLabel, styles.rowLabelFlex]}>Notification Frequency</Text>
          <View style={styles.segmentedWrap}>
            <Pressable
              style={[
                styles.segmentedSegment,
                nudgeFrequency === "low" && styles.segmentedSegmentActive,
              ]}
              onPress={() => setNudgeFrequencyAndSave("low")}
            >
              <Text
                style={[
                  styles.segmentedText,
                  nudgeFrequency === "low" && styles.segmentedTextActive,
                ]}
              >
                Low
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segmentedSegment,
                nudgeFrequency === "medium" && styles.segmentedSegmentActive,
              ]}
              onPress={() => setNudgeFrequencyAndSave("medium")}
            >
              <Text
                style={[
                  styles.segmentedText,
                  nudgeFrequency === "medium" && styles.segmentedTextActive,
                ]}
              >
                Medium
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segmentedSegment,
                nudgeFrequency === "high" && styles.segmentedSegmentActive,
              ]}
              onPress={() => setNudgeFrequencyAndSave("high")}
            >
              <Text
                style={[
                  styles.segmentedText,
                  nudgeFrequency === "high" && styles.segmentedTextActive,
                ]}
              >
                High
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Row 4 — Streak Freezes (display only) */}
        <View style={styles.row}>
          <Ionicons
            name="snow-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel}>Streak Freezes</Text>
            <Text style={styles.rowSubLabel}>
              Applied automatically when you miss a day
            </Text>
          </View>
          <View style={styles.freezeBadge}>
            <Text style={styles.freezeBadgeText}>{STREAK_FREEZES_REMAINING}</Text>
          </View>
        </View>

        {/* Row 5 — Twin Tone History */}
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

        {/* Row 6 — Delete Account */}
        <Pressable style={styles.row} onPress={deleteAccount}>
          <Ionicons
            name="trash-outline"
            size={ICON_SIZE}
            color={COLORS.danger}
            style={styles.rowIcon}
          />
          <Text style={[styles.rowLabel, styles.rowLabelFlex, styles.rowLabelDanger]}>
            Delete Account
          </Text>
          <Ionicons
            name="chevron-forward"
            size={CHEVRON_SIZE}
            color={COLORS.danger}
          />
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

        {/* Temporary: preview Milestone Achievement Card */}
        <Pressable
          style={styles.row}
          onPress={() => setMilestonePreviewVisible(true)}
        >
          <Ionicons
            name="trophy-outline"
            size={ICON_SIZE}
            color={ICON_COLOR}
            style={styles.rowIcon}
          />
          <Text style={[styles.rowLabel, styles.rowLabelFlex]}>
            Preview Milestone Card
          </Text>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={COLORS.muted} />
        </Pressable>
      </View>

      <ToneHistoryModal
        visible={toneHistoryVisible}
        onClose={() => setToneHistoryVisible(false)}
      />
      <MilestoneAchievementCard
        visible={milestonePreviewVisible}
        onClose={() => setMilestonePreviewVisible(false)}
        interestName="Fitness"
        milestoneNumber={7}
        milestoneName="7 Days of Fitness"
        twinCongratulation="Seven days. You showed up. That's how the gap closes."
      />

      <Modal visible={connectAccountVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setConnectAccountVisible(false)}>
          <Pressable style={styles.connectModalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.connectModalTitle}>Connect email or account</Text>
            <Text style={styles.connectModalSub}>Link your progress to an email or Google/Apple.</Text>
            <TextInput
              style={styles.connectEmailInput}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.muted}
              value={connectEmailInput}
              onChangeText={setConnectEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!connectSending}
            />
            <Pressable
              style={[styles.connectBtn, (!connectEmailInput.trim() || connectSending) && styles.connectBtnDisabled]}
              onPress={sendConnectEmailLink}
              disabled={!connectEmailInput.trim() || connectSending}
            >
              {connectSending ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.connectBtnText}>Send verification link</Text>
              )}
            </Pressable>
            <View style={styles.connectDivider} />
            <Pressable
              style={styles.connectProviderBtn}
              onPress={() => linkProvider("google")}
              disabled={connectLinking !== null}
            >
              {connectLinking === "google" ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.connectProviderText}>Link with Google</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.connectProviderBtn}
              onPress={() => linkProvider("apple")}
              disabled={connectLinking !== null}
            >
              {connectLinking === "apple" ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.connectProviderText}>Link with Apple</Text>
              )}
            </Pressable>
            <Pressable style={styles.connectCancel} onPress={() => setConnectAccountVisible(false)}>
              <Text style={styles.connectCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
});
