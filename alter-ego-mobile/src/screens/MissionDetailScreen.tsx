import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import Svg, { Path, Circle } from "react-native-svg";
import type { MainStackParamList } from "@/navigation/types";
import { useCompleteMission, useRateMission } from "@/hooks/useMissions";

type MissionDetailRoute = RouteProp<MainStackParamList, "MissionDetail">;

const BG_GRADIENT = ["#0D0F1A", "#07080F"] as const;

export function MissionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<MissionDetailRoute>();
  const { mission } = route.params;

  const [selectedRating, setSelectedRating] = useState<1 | 3 | 5 | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(mission.completed);

  const { mutate: completeMission } = useCompleteMission();
  const { mutate: submitRating, isPending: isSubmittingRating } = useRateMission();

  const handleComplete = (missionId: string) => {
    completeMission(missionId, {
      onSuccess: () => {
        setIsCompleted(true);
        setTimeout(() => navigation.goBack(), 600);
      },
    });
  };

  const handleRatingSelect = (rating: 1 | 3 | 5) => {
    setSelectedRating(rating);
    setRatingSubmitted(false);
  };

  const handleSendFeedback = () => {
    if (selectedRating == null) return;
    submitRating(
      {
        missionId: mission.id,
        rating: selectedRating,
        feedback: feedbackText.trim().length > 0 ? feedbackText : undefined,
      },
      {
        onSuccess: () => setRatingSubmitted(true),
        onError: () => {},
      }
    );
  };

  const typeBadge = (() => {
    if (mission.type === "core")
      return {
        bg: "rgba(127,29,29,0.15)",
        border: "rgba(127,29,29,0.35)",
        dot: "#7F1D1D",
        label: "CORE MISSION",
      };
    if (mission.type === "interest")
      return {
        bg: "rgba(139,92,246,0.15)",
        border: "rgba(139,92,246,0.30)",
        dot: "#8B5CF6",
        label: "INTEREST MISSION",
      };
    if (mission.type === "personal")
      return {
        bg: "rgba(107,114,128,0.12)",
        border: "rgba(107,114,128,0.25)",
        dot: "#6B7280",
        label: "PERSONAL MISSION",
      };
    return {
      bg: "rgba(127,29,29,0.15)",
      border: "rgba(127,29,29,0.35)",
      dot: "#7F1D1D",
      label: "RESISTANCE MISSION",
    };
  })();

  const difficultyChip = (() => {
    if (mission.difficulty === "easy")
      return {
        bg: "rgba(139,92,246,0.12)",
        border: "rgba(139,92,246,0.30)",
        text: "#8B5CF6",
        label: "EASY",
      };
    if (mission.difficulty === "medium")
      return {
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.30)",
        text: "#F59E0B",
        label: "MEDIUM",
      };
    if (mission.difficulty === "hard")
      return {
        bg: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.30)",
        text: "#EF4444",
        label: "HARD",
      };
    return {
      bg: "rgba(167,139,250,0.12)",
      border: "rgba(167,139,250,0.30)",
      text: "#A78BFA",
      label: "ELITE",
    };
  })();

  const rationaleText =
    mission.rationale != null
      ? mission.rationale
      : mission.type === "core"
        ? "This is a core discipline mission — the biological\nfoundation of every other habit. Sleep, movement, hydration,\nmindfulness, and focused attention are the non-negotiable\nsubstrate that makes every other goal possible."
        : "Mission rationale is being generated.";

  const showResearch =
    mission.domain_knowledge != null && mission.domain_knowledge.trim().length > 0;

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ZONE 1 — HEADER BAR */}
            <View style={styles.headerBar}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
                hitSlop={10}
              >
                <Ionicons name="chevron-back" size={24} color="#E5E7EB" />
              </Pressable>
              <Text style={styles.headerTitle}>MISSION</Text>
              <View style={{ width: 44 }} />
            </View>

          {/* ZONE 2 — TYPE BADGE + TITLE + CHIPS */}
          <View style={styles.zone2}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: typeBadge.bg, borderColor: typeBadge.border },
              ]}
            >
              <View style={[styles.typeDot, { backgroundColor: typeBadge.dot }]} />
              <Text style={[styles.typeText, { color: typeBadge.dot }]}>
                {typeBadge.label}
              </Text>
            </View>

            <Text style={styles.missionTitle}>{mission.title}</Text>

            <View style={styles.chipsRow}>
              <View style={styles.rewardChip}>
                <Ionicons name="star" size={12} color="#A78BFA" />
                <Text style={styles.rewardChipText}>{`${mission.xp_value} XP`}</Text>
              </View>
              <View style={styles.rewardChip}>
                <Ionicons name="leaf" size={12} color="#F59E0B" />
                <Text style={styles.pfChipText}>{`${mission.pf_value} PF`}</Text>
              </View>
              <View
                style={[
                  styles.diffChip,
                  { backgroundColor: difficultyChip.bg, borderColor: difficultyChip.border },
                ]}
              >
                <Text style={[styles.diffChipText, { color: difficultyChip.text }]}>
                  {difficultyChip.label}
                </Text>
              </View>
              {mission.estimated_minutes != null ? (
                <View style={styles.durationChip}>
                  <Text
                    style={styles.durationChipText}
                  >{`~${mission.estimated_minutes} min`}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* DIVIDER */}
          <View style={{ paddingHorizontal: 20 }}>
            <LinearGradient
              colors={["transparent", "#1E2333", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.divider}
            />
          </View>

          {/* ZONE 3 — WHY THIS MISSION */}
          <View style={styles.zone3}>
            <View style={styles.sectionHeaderRow}>
              <LinearGradient
                colors={["#8B5CF6", "#6D28D9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.accentBar}
              />
              <Text style={styles.sectionLabel}>WHY THIS MISSION</Text>
            </View>
            <Text style={styles.rationaleBody}>{rationaleText}</Text>
          </View>

          {/* ZONE 4 — THE RESEARCH */}
          {showResearch ? (
            <View style={styles.zone4}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.accentBar, { backgroundColor: "#374151" }]} />
                <Text style={styles.researchLabel}>THE RESEARCH</Text>
              </View>
              <Text style={styles.researchBody}>{mission.domain_knowledge}</Text>
            </View>
          ) : null}

          {/* DIVIDER */}
          <View style={{ paddingHorizontal: 20, marginTop: showResearch ? 16 : 0 }}>
            <LinearGradient
              colors={["transparent", "#1E2333", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.divider}
            />
          </View>

          {/* ZONE 5 — RATE THIS MISSION */}
          <View style={styles.zone5}>
            <View style={styles.sectionHeaderRow}>
              <LinearGradient
                colors={["#FBBF24", "#D97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.accentBar}
              />
              <Text style={styles.sectionLabel}>RATE THIS MISSION</Text>
            </View>

            <View style={styles.ratingRow}>
              <Pressable
                onPress={() => handleRatingSelect(1)}
                style={[
                  styles.ratingCard,
                  selectedRating === 1
                    ? styles.ratingCardHardSelected
                    : styles.ratingCardUnselected,
                ]}
              >
                {selectedRating === 1 ? (
                  <View style={[styles.ratingCheck, { backgroundColor: "#EF4444" }]}>
                    <Text style={styles.ratingCheckText}>✓</Text>
                  </View>
                ) : null}
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 6 L12 12"
                    stroke="#EF4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <Circle cx="12" cy="16.5" r="1.5" fill="#EF4444" />
                  <Circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#EF4444"
                    strokeWidth="1.5"
                    opacity={0.4}
                  />
                </Svg>
                <Text
                  style={[
                    styles.ratingLabel,
                    { color: selectedRating === 1 ? "#EF4444" : "#9CA3AF" },
                  ]}
                >
                  Too Hard
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleRatingSelect(3)}
                style={[
                  styles.ratingCard,
                  selectedRating === 3
                    ? styles.ratingCardRightSelected
                    : styles.ratingCardUnselected,
                ]}
              >
                {selectedRating === 3 ? (
                  <View style={[styles.ratingCheck, { backgroundColor: "#8B5CF6" }]}>
                    <Text style={styles.ratingCheckText}>✓</Text>
                  </View>
                ) : null}
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 13 L11 17 L17 9"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#8B5CF6"
                    strokeWidth="1.5"
                    opacity={0.4}
                  />
                </Svg>
                <Text
                  style={[
                    styles.ratingLabel,
                    { color: selectedRating === 3 ? "#8B5CF6" : "#9CA3AF" },
                  ]}
                >
                  Just Right
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleRatingSelect(5)}
                style={[
                  styles.ratingCard,
                  selectedRating === 5
                    ? styles.ratingCardEasySelected
                    : styles.ratingCardUnselected,
                ]}
              >
                {selectedRating === 5 ? (
                  <View style={[styles.ratingCheck, { backgroundColor: "#6B7280" }]}>
                    <Text style={styles.ratingCheckText}>✓</Text>
                  </View>
                ) : null}
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 14 L12 11 L15 14"
                    stroke="#6B7280"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M9 17.5 L12 14.5 L15 17.5"
                    stroke="#6B7280"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.5}
                  />
                  <Circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#6B7280"
                    strokeWidth="1.5"
                    opacity={0.3}
                  />
                </Svg>
                <Text
                  style={[
                    styles.ratingLabel,
                    { color: selectedRating === 5 ? "#9CA3AF" : "#9CA3AF" },
                  ]}
                >
                  Too Easy
                </Text>
              </Pressable>
            </View>

            <View style={styles.feedbackInputWrap}>
              <TextInput
                placeholder="Tell us more (optional)..."
                placeholderTextColor="#4B5563"
                value={feedbackText}
                onChangeText={setFeedbackText}
                style={styles.feedbackInput}
                multiline
                numberOfLines={2}
                maxLength={500}
              />
            </View>

            {!ratingSubmitted ? (
              <Pressable
                onPress={handleSendFeedback}
                disabled={selectedRating == null || isSubmittingRating}
                style={({ pressed }) => [
                  styles.sendFeedbackBtn,
                  selectedRating == null || isSubmittingRating ? styles.sendFeedbackBtnDisabled : null,
                  pressed && selectedRating != null && !isSubmittingRating ? { transform: [{ scale: 0.98 }] } : null,
                ]}
              >
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendFeedbackBtnGradient}
                >
                  <Text style={styles.sendFeedbackBtnText}>
                    {isSubmittingRating ? "Sending..." : "Send feedback"}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}

            {ratingSubmitted ? (
              <View style={styles.ratingConfirmRow}>
                <Ionicons name="checkmark-circle" size={14} color="#8B5CF6" />
                <Text style={styles.ratingConfirmText}>
                  Feedback saved. Your missions will adapt.
                </Text>
              </View>
            ) : null}
          </View>

          {/* ZONE 6 — COMPLETE BUTTON */}
          <View style={styles.zone6}>
            {!isCompleted ? (
              <Pressable
                onPress={() => handleComplete(mission.id)}
                style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}
              >
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.completeBtn}
                >
                  <View style={styles.completeBtnRow}>
                    <Text style={styles.completeBtnText}>Complete Mission</Text>
                    <Text style={styles.completeBtnSub}>{`★ ${mission.xp_value} XP`}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.completedBtn}>
                <Ionicons name="checkmark-circle" size={18} color="#6B7280" />
                <Text style={styles.completedBtnText}>Already Completed</Text>
              </View>
            )}
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },

  headerBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(20,24,36,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  zone2: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  typeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  missionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E5E7EB",
    lineHeight: 30,
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rewardChip: {
    backgroundColor: "rgba(30,35,51,0.8)",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  rewardChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E5E7EB",
  },
  pfChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
  },
  diffChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  diffChipText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  durationChip: {
    backgroundColor: "rgba(30,35,51,0.6)",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },

  divider: { height: 1, marginHorizontal: 0 },

  zone3: { paddingHorizontal: 20, paddingTop: 20 },
  zone4: { paddingHorizontal: 20, paddingTop: 16 },
  zone5: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  zone6: { paddingHorizontal: 20, paddingBottom: 32 },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  accentBar: { width: 3, height: 16, borderRadius: 2 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#6B7280",
  },
  rationaleBody: {
    color: "#E5E7EB",
    fontSize: 14,
    lineHeight: 24,
  },

  researchLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#4B5563",
  },
  researchBody: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 22,
  },

  ratingRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  ratingCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
  },
  ratingCardUnselected: {
    backgroundColor: "rgba(30,35,51,0.8)",
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  ratingCardHardSelected: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.40)",
  },
  ratingCardRightSelected: {
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.40)",
  },
  ratingCardEasySelected: {
    backgroundColor: "rgba(107,114,128,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(107,114,128,0.35)",
  },
  ratingCheck: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingCheckText: { fontSize: 9, color: "#FFFFFF", fontWeight: "700" },
  ratingLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  feedbackInputWrap: {
    marginTop: 12,
    backgroundColor: "rgba(30,35,51,0.6)",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sendFeedbackBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sendFeedbackBtnDisabled: {
    opacity: 0.5,
  },
  sendFeedbackBtnGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  sendFeedbackBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E5E7EB",
    letterSpacing: 0.2,
  },
  feedbackInput: {
    color: "#E5E7EB",
    fontSize: 13,
    lineHeight: 18,
    padding: 0,
    margin: 0,
    textAlignVertical: "top",
  },
  ratingConfirmRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ratingConfirmText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8B5CF6",
  },

  completeBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
        }
      : { elevation: 8 }),
  },
  completeBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  completeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  completeBtnSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },
  completedBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#1E2333",
    borderWidth: 1,
    borderColor: "#2A3050",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completedBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.5,
  },
});

