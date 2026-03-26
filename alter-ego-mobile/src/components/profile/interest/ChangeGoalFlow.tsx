import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

export type ChangeGoalFlowProps = {
  visible: boolean;
  onClose: () => void;
  interestName: string;
  insightsUnlocked: number;
  onSubmit: (goal: string, level: "beginner" | "intermediate" | "advanced") => Promise<void>;
  onSuccessMessage: () => void;
  onSubmitError?: (e: unknown) => void;
};

export function ChangeGoalFlow({
  visible,
  onClose,
  interestName,
  insightsUnlocked,
  onSubmit,
  onSuccessMessage,
  onSubmitError,
}: ChangeGoalFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced" | null>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setStep(1);
      setGoal("");
      setLevel(null);
      setLoading(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!level || goal.trim().length <= 10) return;
    setLoading(true);
    try {
      await onSubmit(goal.trim(), level);
      onClose();
      onSuccessMessage();
    } catch (e) {
      onSubmitError?.(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.overlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.overlayTint} />

          {step === 1 ? (
            <View style={styles.card}>
              <Text style={styles.warnIcon}>⚠️</Text>
              <Text style={styles.cardTitle}>Change Your Goal?</Text>
              <Text style={styles.body}>
                Changing your goal for{" "}
                <Text style={styles.strongRed}>{interestName}</Text> will permanently delete your
                current Path, all Quest progress, and{" "}
                <Text style={styles.strongRed}>{insightsUnlocked} Insights earned</Text>.
                {"\n\n"}
                Your Craft SP and character level are{" "}
                <Text style={styles.strongViolet}>not affected</Text>. Only the path plan resets.
              </Text>
              <Pressable
                style={styles.btnDanger}
                onPress={() => setStep(2)}
              >
                <Text style={styles.btnDangerText}>Yes, change my goal</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={onClose}>
                <Text style={styles.btnGhostText}>Keep current goal</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Pressable
                onPress={() => setStep(1)}
                disabled={loading}
                style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.75 }]}
                hitSlop={8}
              >
                <Text style={styles.backLinkText}>← Back</Text>
              </Pressable>
              <Text style={styles.cardTitle}>What&apos;s your new goal?</Text>
              <Text style={styles.sub2}>
                Be specific. This becomes the destination of your new Path.
              </Text>
              <TextInput
                value={goal}
                onChangeText={setGoal}
                editable={!loading}
                multiline
                maxLength={150}
                placeholder="e.g. Learn fingerstyle arrangements of 5 songs I love"
                placeholderTextColor="#4B5563"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={[
                  styles.input,
                  focused && { borderColor: "rgba(139,92,246,0.4)" },
                ]}
              />
              <Text style={styles.expLabel}>YOUR LEVEL NOW</Text>
              <View style={styles.levelRow}>
                {(
                  [
                    ["beginner", "Beginner"],
                    ["intermediate", "Intermediate"],
                    ["advanced", "Advanced"],
                  ] as const
                ).map(([k, label]) => {
                  const sel = level === k;
                  return (
                    <Pressable
                      key={k}
                      disabled={loading}
                      onPress={() => setLevel(k)}
                      style={[styles.levelChip, sel && styles.levelChipSel]}
                    >
                      <Text style={[styles.levelChipText, sel && styles.levelChipTextSel]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={submit}
                disabled={goal.trim().length <= 10 || !level || loading}
                style={[
                  styles.btnPrimaryWrap,
                  (goal.trim().length <= 10 || !level || loading) && { opacity: 0.45 },
                ]}
              >
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnPrimary}
                >
                  {loading ? (
                    <ActivityIndicator color="#E5E7EB" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Build New Path →</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  card: {
    width: "100%",
    backgroundColor: "#0F1220",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 2,
  },
  warnIcon: {
    fontSize: 32,
    textAlign: "center",
    marginBottom: 8,
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 10,
    paddingVertical: 4,
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 12,
  },
  sub2: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 18,
  },
  body: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  strongRed: { color: "#F87171", fontFamily: "Inter_700Bold" },
  strongViolet: { color: "#A78BFA", fontFamily: "Inter_700Bold" },
  btnDanger: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    alignItems: "center",
    marginBottom: 8,
  },
  btnDangerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F87171",
  },
  btnGhost: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  btnGhostText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
  input: {
    minHeight: 80,
    backgroundColor: "#141825",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3050",
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#E5E7EB",
    textAlignVertical: "top",
  },
  expLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#6B7280",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: "row",
    gap: 8,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1A1F30",
    backgroundColor: "#0C0E1A",
    alignItems: "center",
  },
  levelChipSel: {
    borderColor: "rgba(139,92,246,0.4)",
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  levelChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
  levelChipTextSel: { color: "#E5E7EB" },
  btnPrimaryWrap: { marginTop: 20 },
  btnPrimary: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
