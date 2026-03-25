/**
 * Absence escalation — interstitial (days 3+), question + Twin response (day 7+).
 * Visual language aligned with Fracture / SevenDayMirror; LinearGradient glows (Android-safe).
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient } from "@/services/api";

const EASE = Easing.out(Easing.cubic);

export interface TwinAccomplishment {
  text: string;
  time_label: string;
}

export interface AbsenceInterstitialProps {
  visible: boolean;
  absenceDays: number;
  /** Server copy when set (ABSENCE_INTERSTITIAL_MESSAGES). */
  interstitialMessage?: string | null;
  accomplishments: TwinAccomplishment[];
  onDismiss: () => void;
  onReasonSubmitted?: (twinResponse: string, silent: boolean) => void;
  /** 14+ days — acknowledgment path instead of question */
  isLongAbsence?: boolean;
  longAbsenceMessage?: string | null;
  /** Backend-driven; default falls back to absenceDays >= 7 */
  shouldAskQuestion?: boolean;
  /** After long-absence acknowledgment — persist long_absence_shown */
  onLongAbsenceDismiss?: () => void;
}

type Stage = "interstitial" | "long_absence" | "question" | "response";

const RETURN_REASONS = [
  { key: "life", label: "Life got in the way." },
  { key: "motivation", label: "I lost motivation." },
  { key: "forgot", label: "I forgot." },
  { key: "break", label: "I needed a break." },
  { key: "unsure", label: "I'm not sure this is for me." },
] as const;

type ReasonKey = (typeof RETURN_REASONS)[number]["key"];

interface ReturnReasonApiResponse {
  twin_response: string;
  tone_override: string;
  silent_mode: boolean;
}

const PARTICLES = [
  { l: "18%", b: "12%", s: 2, d: 0, dur: 9000, c: "rgba(239,68,68,0.35)" },
  { l: "38%", b: "20%", s: 2, d: 1500, dur: 12000, c: "rgba(220,38,38,0.28)" },
  { l: "58%", b: "15%", s: 3, d: 3000, dur: 10000, c: "rgba(239,68,68,0.22)" },
  { l: "75%", b: "25%", s: 2, d: 800, dur: 14000, c: "rgba(139,92,246,0.18)" },
  { l: "85%", b: "10%", s: 2, d: 2000, dur: 11000, c: "rgba(139,92,246,0.15)" },
  { l: "8%", b: "30%", s: 2, d: 4000, dur: 13000, c: "rgba(239,68,68,0.25)" },
] as const;

function AbsenceParticle({
  cfg,
  active,
}: {
  cfg: (typeof PARTICLES)[number];
  active: boolean;
}) {
  const ty = useSharedValue(0);
  const op = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(ty);
      cancelAnimation(op);
      ty.value = 0;
      op.value = 0;
      return;
    }

    let cancelled = false;
    let tOuter: ReturnType<typeof setTimeout> | undefined;
    let tMid: ReturnType<typeof setTimeout> | undefined;
    let tLoop: ReturnType<typeof setTimeout> | undefined;

    const loop = () => {
      if (cancelled) return;
      ty.value = 0;
      op.value = 0;
      tOuter = setTimeout(() => {
        if (cancelled) return;
        op.value = withTiming(0.7, { duration: cfg.dur * 0.15 });
        ty.value = withTiming(-100, { duration: cfg.dur, easing: Easing.linear });
        tMid = setTimeout(() => {
          if (cancelled) return;
          op.value = withTiming(0, { duration: cfg.dur * 0.2 });
          tLoop = setTimeout(loop, 300);
        }, cfg.dur * 0.75);
      }, cfg.d);
    };
    loop();

    return () => {
      cancelled = true;
      if (tOuter) clearTimeout(tOuter);
      if (tMid) clearTimeout(tMid);
      if (tLoop) clearTimeout(tLoop);
    };
  }, [active, cfg.d, cfg.dur]);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: cfg.s,
          height: cfg.s,
          borderRadius: cfg.s / 2,
          backgroundColor: cfg.c,
          left: cfg.l as `${number}%`,
          bottom: cfg.b as `${number}%`,
        },
        style,
      ]}
    />
  );
}

export function AbsenceInterstitial({
  visible,
  absenceDays,
  interstitialMessage,
  accomplishments,
  onDismiss,
  onReasonSubmitted,
  isLongAbsence = false,
  longAbsenceMessage = null,
  shouldAskQuestion,
  onLongAbsenceDismiss,
}: AbsenceInterstitialProps) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>("interstitial");
  const [selectedReason, setSelectedReason] = useState<ReasonKey | null>(null);
  const [twinResponse, setTwinResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const overlayOp = useSharedValue(0);
  const contentOp = useSharedValue(0);
  const contentTy = useSharedValue(16);
  const questionOp = useSharedValue(0);
  const questionTy = useSharedValue(16);
  const longAbsenceOp = useSharedValue(0);
  const longAbsenceTy = useSharedValue(16);
  const responseOp = useSharedValue(0);
  const responseTy = useSharedValue(16);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(overlayOp);
      cancelAnimation(contentOp);
      cancelAnimation(contentTy);
      cancelAnimation(questionOp);
      cancelAnimation(questionTy);
      cancelAnimation(longAbsenceOp);
      cancelAnimation(longAbsenceTy);
      cancelAnimation(responseOp);
      cancelAnimation(responseTy);
      overlayOp.value = 0;
      contentOp.value = 0;
      contentTy.value = 16;
      questionOp.value = 0;
      questionTy.value = 16;
      longAbsenceOp.value = 0;
      longAbsenceTy.value = 16;
      responseOp.value = 0;
      responseTy.value = 16;
      setStage("interstitial");
      setSelectedReason(null);
      setTwinResponse("");
      return;
    }
    overlayOp.value = withTiming(1, { duration: 400, easing: EASE });
    contentOp.value = withDelay(200, withTiming(1, { duration: 600, easing: EASE }));
    contentTy.value = withDelay(200, withTiming(0, { duration: 600, easing: EASE }));
  }, [visible]);

  const showQuestion = () => {
    setStage("question");
    questionOp.value = withDelay(100, withTiming(1, { duration: 500, easing: EASE }));
    questionTy.value = withDelay(100, withTiming(0, { duration: 500, easing: EASE }));
  };

  const showLongAbsence = () => {
    setStage("long_absence");
    longAbsenceOp.value = withDelay(80, withTiming(1, { duration: 500, easing: EASE }));
    longAbsenceTy.value = withDelay(80, withTiming(0, { duration: 500, easing: EASE }));
  };

  const bodyCopy =
    interstitialMessage?.trim() ||
    (absenceDays >= 14
      ? "You were gone longer than most people come back from."
      : absenceDays >= 7
        ? "Seven days. Before we continue — I have one question."
        : absenceDays >= 5
          ? "Five days of your life. I lived them better than you did."
          : "Three days. I didn't slow down. I didn't wonder where you went. I just kept going. That's the part that should bother you.");

  const resolvedLongAbsenceCopy =
    longAbsenceMessage?.trim() || (isLongAbsence ? bodyCopy : "");

  const askQuestionEffective = shouldAskQuestion ?? absenceDays >= 7;

  const handleInterstitialContinue = () => {
    if (isLongAbsence && resolvedLongAbsenceCopy) {
      showLongAbsence();
    } else if (askQuestionEffective) {
      showQuestion();
    } else {
      onDismiss();
    }
  };

  const continueBtnLabel =
    isLongAbsence ? "Continue →" : askQuestionEffective ? "Answer →" : "Continue →";

  const submitReason = async (reason: ReasonKey) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post<ReturnReasonApiResponse>("/api/v1/profile/return-reason", {
        reason,
      });
      setTwinResponse(res.twin_response ?? "");
      setStage("response");
      responseOp.value = withDelay(150, withTiming(1, { duration: 600, easing: EASE }));
      responseTy.value = withDelay(150, withTiming(0, { duration: 600, easing: EASE }));
      onReasonSubmitted?.(res.twin_response ?? "", res.silent_mode === true);
    } catch {
      onDismiss();
    } finally {
      setSubmitting(false);
    }
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOp.value,
    transform: [{ translateY: contentTy.value }],
  }));
  const questionStyle = useAnimatedStyle(() => ({
    opacity: questionOp.value,
    transform: [{ translateY: questionTy.value }],
  }));
  const longAbsenceStyle = useAnimatedStyle(() => ({
    opacity: longAbsenceOp.value,
    transform: [{ translateY: longAbsenceTy.value }],
  }));
  const responseStyle = useAnimatedStyle(() => ({
    opacity: responseOp.value,
    transform: [{ translateY: responseTy.value }],
  }));

  if (!visible) {
    return null;
  }

  const isDay5 = absenceDays >= 5 && absenceDays < 7;
  const isVioletAmbient = stage === "response" || stage === "long_absence";

  const padTop = Math.max(insets.top, 12);
  const padBottom = Math.max(insets.bottom, 16);

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none">
      <Animated.View style={[styles.overlay, overlayStyle, { paddingTop: padTop + 44, paddingBottom: padBottom + 24 }]}>
        <LinearGradient
          colors={
            isVioletAmbient
              ? ["transparent", "rgba(109,40,217,0.1)", "rgba(76,29,149,0.06)"]
              : ["transparent", "rgba(127,29,29,0.14)", "rgba(185,28,28,0.08)"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.ambientGlow}
          pointerEvents="none"
        />

        <View
          style={[styles.crackLine, isVioletAmbient && styles.crackLineViolet]}
          pointerEvents="none"
        />

        {PARTICLES.map((cfg, i) => (
          <AbsenceParticle key={i} cfg={cfg} active={visible && !isVioletAmbient} />
        ))}

        {stage === "interstitial" && (
          <Animated.View style={[styles.content, contentStyle]}>
            <View style={styles.badge}>
              <View style={styles.badgeLine} />
              <Text style={styles.badgeText}>
                {absenceDays >= 7 ? `${absenceDays} DAYS` : "ABSENT"}
              </Text>
              <View style={[styles.badgeLine, { transform: [{ scaleX: -1 }] }]} />
            </View>

            <Text style={styles.bigNumber}>{absenceDays}</Text>
            <Text style={styles.daysWord}>DAYS</Text>
            <View style={styles.hDivider} />

            <View style={styles.messageCard}>
              <View style={styles.messageCardTopLine} />
              <Text style={styles.messageText}>{bodyCopy}</Text>
            </View>

            {isDay5 && accomplishments.length > 0 && (
              <View style={styles.feedList}>
                {accomplishments.slice(0, 3).map((a, i) => (
                  <View key={`${a.time_label}-${i}`} style={styles.feedEntry}>
                    <View style={styles.feedAccent} />
                    <View style={styles.feedBody}>
                      <Text style={styles.feedText}>{a.text}</Text>
                      <Text style={styles.feedTime}>{a.time_label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Pressable style={styles.continueBtn} onPress={handleInterstitialContinue}>
              <Text style={styles.continueTxt}>{continueBtnLabel}</Text>
            </Pressable>
          </Animated.View>
        )}

        {stage === "long_absence" && resolvedLongAbsenceCopy ? (
          <Animated.View style={[styles.content, longAbsenceStyle]}>
            <View style={styles.badge}>
              <View style={[styles.badgeLine, styles.badgeLineViolet]} />
              <Text style={[styles.badgeText, styles.badgeTextViolet]}>YOUR TWIN</Text>
              <View
                style={[
                  styles.badgeLine,
                  styles.badgeLineViolet,
                  { transform: [{ scaleX: -1 }] },
                ]}
              />
            </View>

            <View style={[styles.messageCard, styles.messageCardViolet]}>
              <View style={styles.messageCardTopLine} />
              <Text style={styles.messageText}>{resolvedLongAbsenceCopy}</Text>
            </View>

            <Pressable
              style={[styles.continueBtn, styles.continueBtnViolet]}
              onPress={() => {
                onLongAbsenceDismiss?.();
                onDismiss();
              }}
            >
              <Text style={[styles.continueTxt, styles.continueTxtViolet]}>Continue →</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {stage === "question" && (
          <Animated.View style={[styles.content, questionStyle]}>
            <View style={styles.badge}>
              <View style={styles.badgeLine} />
              <Text style={styles.badgeText}>YOUR TWIN</Text>
              <View style={[styles.badgeLine, { transform: [{ scaleX: -1 }] }]} />
            </View>

            <View style={styles.messageCard}>
              <View style={styles.messageCardTopLine} />
              <Text style={styles.messageText}>
                Before we continue, I have one question.
              </Text>
            </View>

            <View style={styles.hDivider} />
            <Text style={styles.questionPrompt}>Why did you leave?</Text>

            <View style={styles.optionsList}>
              {RETURN_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.option,
                    selectedReason === r.key && styles.optionSelected,
                  ]}
                  onPress={() => {
                    setSelectedReason(r.key);
                    setTimeout(() => submitReason(r.key), 300);
                  }}
                  activeOpacity={0.7}
                  disabled={submitting}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedReason === r.key && styles.optionTextSelected,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {stage === "response" && (
          <Animated.View style={[styles.content, responseStyle]}>
            <View style={styles.badge}>
              <View style={[styles.badgeLine, styles.badgeLineViolet]} />
              <Text style={[styles.badgeText, styles.badgeTextViolet]}>YOUR TWIN</Text>
              <View
                style={[
                  styles.badgeLine,
                  styles.badgeLineViolet,
                  { transform: [{ scaleX: -1 }] },
                ]}
              />
            </View>

            {twinResponse ? (
              <View style={styles.messageCard}>
                <View style={styles.messageCardTopLine} />
                <Text style={styles.messageText}>{twinResponse}</Text>
              </View>
            ) : (
              <View style={styles.silenceWrap}>
                <View style={styles.silenceDot} />
                <Text style={styles.silenceText}>{"No response.\nCheck back tomorrow."}</Text>
              </View>
            )}

            <Pressable style={[styles.continueBtn, styles.continueBtnViolet]} onPress={onDismiss}>
              <Text style={[styles.continueTxt, styles.continueTxtViolet]}>Continue →</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    overflow: "hidden",
  },
  ambientGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  crackLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    marginLeft: -0.5,
    backgroundColor: "rgba(185,28,28,0.08)",
  },
  crackLineViolet: {
    backgroundColor: "rgba(139,92,246,0.07)",
  },
  content: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    opacity: 0.7,
  },
  badgeLine: {
    width: 20,
    height: 1,
    backgroundColor: "rgba(239,68,68,0.4)",
  },
  badgeLineViolet: {
    backgroundColor: "rgba(139,92,246,0.4)",
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 3,
    color: "rgba(239,68,68,0.55)",
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  badgeTextViolet: {
    color: "rgba(139,92,246,0.55)",
  },
  bigNumber: {
    fontSize: 96,
    fontWeight: "800",
    color: "#E5E7EB",
    letterSpacing: -5,
    lineHeight: 96,
    textShadowColor: "rgba(229,231,235,0.1)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 32,
    fontFamily: "Inter_800ExtraBold",
  },
  daysWord: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 5,
    color: "rgba(229,231,235,0.2)",
    textTransform: "uppercase",
    marginTop: -8,
    fontFamily: "Inter_600SemiBold",
  },
  hDivider: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(185,28,28,0.2)",
  },
  messageCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.06)",
    borderRadius: 16,
    padding: 22,
    position: "relative",
    overflow: "hidden",
    width: "100%",
  },
  messageCardViolet: {
    borderColor: "rgba(139,92,246,0.08)",
  },
  messageCardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(229,231,235,0.06)",
  },
  messageText: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(229,231,235,0.8)",
    lineHeight: 23,
    fontStyle: "italic",
    textAlign: "center",
    fontFamily: "Inter_400Regular_Italic",
  },
  feedList: {
    width: "100%",
    gap: 8,
  },
  feedEntry: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 11,
    flexDirection: "row",
    gap: 10,
    position: "relative",
    overflow: "hidden",
  },
  feedAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(167,139,250,0.4)",
    borderRadius: 2,
  },
  feedBody: {
    flex: 1,
    paddingLeft: 4,
  },
  feedText: {
    fontSize: 12,
    color: "rgba(229,231,235,0.65)",
    fontFamily: "Inter_400Regular",
  },
  feedTime: {
    fontSize: 10,
    color: "rgba(107,114,128,0.5)",
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  questionPrompt: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(229,231,235,0.85)",
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  optionsList: {
    width: "100%",
    gap: 8,
  },
  option: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: 14,
  },
  optionSelected: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.25)",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(229,231,235,0.6)",
    fontFamily: "Inter_500Medium",
  },
  optionTextSelected: {
    color: "rgba(229,231,235,0.9)",
  },
  silenceWrap: {
    alignItems: "center",
    gap: 16,
    padding: 32,
  },
  silenceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(229,231,235,0.15)",
  },
  silenceText: {
    fontSize: 13,
    color: "rgba(229,231,235,0.3)",
    textAlign: "center",
    lineHeight: 20,
    fontStyle: "italic",
    fontFamily: "Inter_400Regular_Italic",
  },
  continueBtn: {
    width: "100%",
    backgroundColor: "rgba(185,28,28,0.08)",
    borderWidth: 1,
    borderColor: "rgba(185,28,28,0.2)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    minHeight: 48,
  },
  continueBtnViolet: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.2)",
  },
  continueTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(185,28,28,0.6)",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },
  continueTxtViolet: {
    color: "rgba(167,139,250,0.7)",
  },
});
