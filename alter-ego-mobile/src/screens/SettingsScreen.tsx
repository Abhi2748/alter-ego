/**
 * Settings Screen §22 (v1.1). Accessed from Profile header.
 * Rows: Anonymous Mode, Notifications, Notification Frequency (segmented Low|Medium|High), Streak Freezes, Twin Tone History, Delete Account, etc.
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, GRADIENTS, RADIUS } from "../constants/theme";
import { ToneHistoryModal } from "../components/ToneHistoryModal";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";

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
        {/* Row 1 — Anonymous Mode */}
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
});
