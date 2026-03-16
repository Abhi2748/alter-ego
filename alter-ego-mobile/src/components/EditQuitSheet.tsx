/**
 * Edit Quit Target — update description and triggers. Amber styling. Ref: EditInterestSheet / AddQuitSheet.
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
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { QuitTargetOut } from "../utils/api";
import type { PatchQuitTargetPayload } from "../utils/api";

const SHEET_BG = "#111623";
const BORDER = "rgba(42,48,80,0.50)";
const EMBER = "#F97316";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

interface EditQuitSheetProps {
  visible: boolean;
  target: QuitTargetOut;
  onClose: () => void;
  onSave: (targetId: string, payload: PatchQuitTargetPayload) => Promise<void>;
  onDelete: (targetId: string) => Promise<void>;
  onSuccess: () => void;
}

export function EditQuitSheet({
  visible,
  target,
  onClose,
  onSave,
  onDelete,
  onSuccess,
}: EditQuitSheetProps) {
  const insets = useSafeAreaInsets();
  const [quitDescription, setQuitDescription] = useState(target.quit_description ?? "");
  const [triggerDescription, setTriggerDescription] = useState(target.trigger_description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuitDescription(target.quit_description ?? "");
      setTriggerDescription(target.trigger_description ?? "");
    }
  }, [visible, target.quit_description, target.trigger_description]);

  const hasChanges =
    quitDescription.trim() !== (target.quit_description ?? "").trim() ||
    triggerDescription.trim() !== (target.trigger_description ?? "").trim();
  const canSave = quitDescription.trim().length >= 10 && triggerDescription.trim().length >= 10 && hasChanges;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(target.id, {
        quit_description: quitDescription.trim(),
        trigger_description: triggerDescription.trim(),
      });
      onSuccess();
    } catch (_) {
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, target.id, quitDescription, triggerDescription, onSave, onSuccess]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete quit target",
      `Remove "${target.quit_name}"? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await onDelete(target.id);
              onSuccess();
            } catch (_) {
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [target.id, target.quit_name, deleting, onDelete, onSuccess]);

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
          <View style={styles.header}>
            <Text style={styles.title}>Update quit target</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={MUTED} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>What are you quitting?</Text>
            <TextInput
              style={styles.input}
              value={quitDescription}
              onChangeText={setQuitDescription}
              placeholder="e.g. Social media scrolling after 9pm"
              placeholderTextColor={VERY_DIM}
              multiline
              numberOfLines={2}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Triggers (what makes it harder?)</Text>
            <TextInput
              style={styles.input}
              value={triggerDescription}
              onChangeText={setTriggerDescription}
              placeholder="e.g. Boredom, stress, phone in bed"
              placeholderTextColor={VERY_DIM}
              multiline
              numberOfLines={2}
            />

            <Pressable
              onPress={handleSave}
              disabled={!canSave || saving}
              style={({ pressed }) => [
                styles.saveBtn,
                (!canSave || saving) && styles.saveBtnDisabled,
                pressed && styles.saveBtnPressed,
              ]}
            >
              <Text style={[styles.saveBtnText, (!canSave || saving) && styles.saveBtnTextDisabled]}>
                {saving ? "Saving…" : "Save changes"}
              </Text>
            </Pressable>

            <View style={styles.deleteSection}>
              <Text style={styles.deleteLabel}>Remove this target</Text>
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && styles.deleteBtnPressed,
                ]}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.deleteBtnText}>{deleting ? "Deleting…" : "Delete quit target"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomWidth: 0,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: { fontSize: 18, fontWeight: "800", color: TEXT },
  closeBtn: { padding: 4 },
  scroll: { maxHeight: 400 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: "700", color: MUTED, marginBottom: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
    minHeight: 44,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: 24,
    backgroundColor: EMBER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnPressed: { opacity: 0.9 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#0D0F1A" },
  saveBtnTextDisabled: { color: DIM },
  deleteSection: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: BORDER },
  deleteLabel: { fontSize: 11, fontWeight: "600", color: MUTED, marginBottom: 8 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  deleteBtnPressed: { opacity: 0.8 },
  deleteBtnText: { fontSize: 14, fontWeight: "600", color: "#EF4444" },
});
