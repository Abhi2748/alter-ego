/**
 * Onboarding Q12 — 2-step bottom sheet: Description → Trigger. Amber theme.
 * Adds OnboardingQuitTarget on complete.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { OnboardingQuitTarget } from "../context/OnboardingAnswersContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (quit: OnboardingQuitTarget) => void;
  quitName: string;
};

type Step = 1 | 2;

export function QuitWizardSheet({ visible, onClose, onAdd, quitName }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");

  useEffect(() => {
    if (visible) {
      setStep(1);
      setDescription("");
      setTrigger("");
    }
  }, [visible, quitName]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleStep1Next = useCallback(() => {
    if (description.trim().length >= 10) setStep(2);
  }, [description]);

  const handleAdd = useCallback(() => {
    if (description.trim().length < 10 || trigger.trim().length < 10) return;
    onAdd({
      name: quitName.trim(),
      description: description.trim(),
      trigger: trigger.trim(),
    });
    onClose();
  }, [quitName, description, trigger, onAdd, onClose]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={handleClose} />
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onStartShouldSetResponder={() => true}>
          <LinearGradient
            colors={["#0E0A04", "#090804"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={styles.accentLine} />
          <View style={styles.dragHandle} />
          <View style={styles.dots}>
            {[1, 2].map((i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>
              STEP {step} OF 2 · <Text style={styles.headerName}>{quitName.trim() || "Quit"}</Text>
            </Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={12} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && (
              <>
                <Text style={styles.question}>Tell us more about this habit.</Text>
                <Text style={styles.hint}>
                  Be specific — when, how often, what triggers it? The more detail the better.
                </Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="e.g. I scroll Instagram for 2-3 hours every night in bed."
                  placeholderTextColor="#4B5563"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={300}
                />
                <Pressable
                  onPress={handleStep1Next}
                  disabled={description.trim().length < 10}
                  style={[styles.primaryBtn, description.trim().length < 10 && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={description.trim().length >= 10 ? ["#C2410C", "#F97316"] : ["#2A3050", "#2A3050"]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 2 && (
              <>
                <Pressable onPress={() => setStep(1)} style={styles.backLink}>
                  <Text style={styles.backLinkText}>← Back</Text>
                </Pressable>
                <Text style={styles.question}>When does the urge usually hit?</Text>
                <Text style={styles.hint}>
                  Describe it freely — we time your missions around your triggers.
                </Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="e.g. Always at night in bed. Also when I'm bored at work."
                  placeholderTextColor="#4B5563"
                  value={trigger}
                  onChangeText={setTrigger}
                  multiline
                  maxLength={300}
                />
                <Pressable
                  onPress={handleAdd}
                  disabled={trigger.trim().length < 10}
                  style={[styles.primaryBtn, trigger.trim().length < 10 && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={trigger.trim().length >= 10 ? ["#C2410C", "#F97316"] : ["#2A3050", "#2A3050"]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryBtnLabel}>Add Quit Target →</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.70)",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(249,115,22,0.25)",
    paddingHorizontal: 20,
    paddingTop: 16,
    overflow: "hidden",
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(249,115,22,0.40)",
  },
  dragHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 10,
    marginBottom: 14,
    alignSelf: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(42,48,80,0.60)",
  },
  dotActive: {
    width: 16,
    backgroundColor: "#F97316",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
  },
  headerName: { color: "#F97316" },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { maxHeight: 400 },
  scrollContent: { paddingBottom: 24 },
  question: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 5,
  },
  hint: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 12,
  },
  backLink: { marginBottom: 10 },
  backLinkText: { fontSize: 12, color: "#4B5563" },
  textArea: {
    minHeight: 70,
    maxHeight: 140,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(249,115,22,0.30)",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 13,
    color: "#E5E7EB",
    lineHeight: 20.8,
    marginBottom: 16,
    textAlignVertical: "top",
  },
  primaryBtn: {
    height: 44,
    borderRadius: 13,
    overflow: "hidden",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
