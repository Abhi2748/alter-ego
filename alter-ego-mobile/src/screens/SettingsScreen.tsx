/**
 * Settings Screen §22 (v1.1). Accessed from Profile header.
 * Header: glass, chevron-back, "Settings". Five rows: Anonymous Mode (switch), Notifications (→ system), Streak Freezes (badge), Twin Tone History (→ modal), Delete Account (danger + alert).
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, GRADIENTS, RADIUS } from "../constants/theme";
import { ToneHistoryModal } from "../components/ToneHistoryModal";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";

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
  const [toneHistoryVisible, setToneHistoryVisible] = useState(false);
  const [milestonePreviewVisible, setMilestonePreviewVisible] = useState(false);

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

        {/* Row 3 — Streak Freezes (display only) */}
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

        {/* Row 4 — Twin Tone History */}
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

        {/* Row 5 — Delete Account */}
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
        achievementName="7-Day Streak"
        subText="You're building something real."
        earnedBadge="Earned: 1 Streak Freeze"
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
