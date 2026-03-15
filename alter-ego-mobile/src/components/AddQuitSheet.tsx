/**
 * Add Quit Target — 2-step bottom sheet. Spec §4.
 * No schedule step. Amber styling. KeyboardAvoidingView.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PostQuitTargetPayload } from "../utils/api";

const SHEET_BG = "#111623";
const BORDER = "rgba(42,48,80,0.50)";
const EMBER = "#F97316";
const EMBER_DEEP = "#C2410C";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

interface AddQuitSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: PostQuitTargetPayload) => Promise<void>;
  onSuccess: () => void;
}

export function AddQuitSheet({ visible, onClose, onSave, onSuccess }: AddQuitSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [quitDescription, setQuitDescription] = useState("");
  const [triggerDescription, setTriggerDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const canNext1 = quitDescription.trim().length >= 10;
  const canSave = triggerDescription.trim().length >= 10;

  useEffect(() => {
    if (visible) {
      setStep(1);
      setQuitDescription("");
      setTriggerDescription("");
    }
  }, [visible]);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        quit_description: quitDescription.trim(),
        trigger_description: triggerDescription.trim(),
      });
      onSuccess();
    } catch (_) {
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, quitDescription, triggerDescription, onSave, onSuccess]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
          <View style={styles.dots}>
            <View style={[styles.dot, step === 1 && styles.dotActive]} />
            <View style={[styles.dot, step === 2 && styles.dotActive]} />
          </View>
          <View style={styles.topRow}>
            {step === 1 ? (
              <View style={styles.placeholder} />
            ) : (
              <Pressable onPress={() => setStep(1)} style={styles.backBtn}>
                <Text style={styles.backText}>← Back</Text>
              </Pressable>
            )}
            <Text style={styles.stepLabel}>Step {step} of 2</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={12} color={MUTED} />
            </Pressable>
          </View>

          {step === 1 && (
            <>
              <Text style={styles.question}>What do you want to quit or reduce?</Text>
              <Text style={styles.hint}>
                Be specific — "I spend 3 hours on TikTok every night before bed" tells us more than just "social media".
              </Text>
              <TextInput
                style={[styles.input, quitDescription.length >= 10 && styles.inputFocused]}
                value={quitDescription}
                onChangeText={setQuitDescription}
                placeholder="e.g. I want to stop scrolling social media for hours, especially Instagram and TikTok late at night."
                placeholderTextColor={VERY_DIM}
                multiline
                minHeight={80}
                maxHeight={160}
              />
              <Pressable
                onPress={() => setStep(2)}
                disabled={!canNext1}
                style={[styles.primaryBtn, !canNext1 && styles.primaryBtnDisabled]}
              >
                {canNext1 ? (
                  <LinearGradient
                    colors={[EMBER_DEEP, EMBER]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>Next</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.primaryBtnDisabledInner}>
                    <Text style={styles.primaryBtnTextDisabled}>Next</Text>
                  </View>
                )}
              </Pressable>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.question}>When does the urge usually hit?</Text>
              <Text style={styles.hint}>
                Describe it in your own words — the more specific, the better we can time your missions.
              </Text>
              <TextInput
                style={[styles.input, triggerDescription.length >= 10 && styles.inputFocused]}
                value={triggerDescription}
                onChangeText={setTriggerDescription}
                placeholder="e.g. Late at night when I'm in bed, and also whenever I'm bored or stressed at work and need a break."
                placeholderTextColor={VERY_DIM}
                multiline
                minHeight={90}
                maxHeight={180}
              />
              <Pressable
                onPress={handleSave}
                disabled={!canSave || saving}
                style={[styles.primaryBtn, (!canSave || saving) && styles.primaryBtnDisabled]}
              >
                {canSave && !saving ? (
                  <LinearGradient
                    colors={[EMBER_DEEP, EMBER]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Start Tracking"}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.primaryBtnDisabledInner}>
                    <Text style={styles.primaryBtnTextDisabled}>Start Tracking</Text>
                  </View>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomWidth: 0,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(249,115,22,0.25)" },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMBER,
    shadowColor: "rgba(249,115,22,0.50)",
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  placeholder: { width: 50 },
  backBtn: {},
  backText: { fontSize: 13, color: "#4B5563" },
  stepLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", color: DIM },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  question: { fontSize: 20, fontWeight: "800", color: TEXT, letterSpacing: -0.3, marginBottom: 6 },
  hint: { fontSize: 13, color: "#4B5563", marginBottom: 18, lineHeight: 20 },
  input: {
    minHeight: 80,
    maxHeight: 160,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(249,115,22,0.35)",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: TEXT,
    marginBottom: 16,
  },
  inputFocused: { borderColor: "rgba(249,115,22,0.55)" },
  primaryBtn: { height: 52, borderRadius: 16, overflow: "hidden" },
  primaryBtnDisabled: {},
  primaryBtnGradient: { height: "100%", alignItems: "center", justifyContent: "center" },
  primaryBtnDisabledInner: {
    height: "100%",
    backgroundColor: "rgba(42,48,80,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  primaryBtnTextDisabled: { fontSize: 16, fontWeight: "600", color: DIM },
});
