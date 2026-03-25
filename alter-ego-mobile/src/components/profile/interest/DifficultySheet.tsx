import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import type { InterestPathDisplay } from "@/types/interestPath";

const OPTIONS: { tier: "easy" | "medium" | "hard"; title: string; desc: string }[] = [
  {
    tier: "easy",
    title: "Easy",
    desc: "Short sessions, light tasks. Good for busy weeks.",
  },
  {
    tier: "medium",
    title: "Balanced",
    desc: "Mix of short and medium sessions. Recommended.",
  },
  {
    tier: "hard",
    title: "Challenging",
    desc: "Longer, harder sessions. Maximum growth.",
  },
];

export type DifficultySheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  path: InterestPathDisplay | null;
  onSave: (tier: "easy" | "medium" | "hard") => Promise<void>;
};

export function DifficultySheet({ sheetRef, path, onSave }: DifficultySheetProps) {
  const [sel, setSel] = useState<"easy" | "medium" | "hard">("medium");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (path?.difficulty) setSel(path.difficulty);
  }, [path?.difficulty, path?.path_id]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.52}
      />
    ),
    []
  );

  const save = async () => {
    setSaving(true);
    try {
      await onSave(sel);
      sheetRef.current?.dismiss();
    } catch {
      /* keep sheet open; parent shows error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["55%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#0F1220" }}
      handleIndicatorStyle={{ backgroundColor: "#2A3050" }}
    >
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Mission Difficulty</Text>
        <Text style={styles.sub}>
          How hard should your daily missions be? You can change this anytime.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((o) => {
            const selected = sel === o.tier;
            return (
              <Pressable
                key={o.tier}
                onPress={() => setSel(o.tier)}
                style={[styles.opt, selected ? styles.optSel : styles.optUnsel]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: o.dot,
                      shadowColor: o.glow,
                      shadowOpacity: 0.9,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 4,
                    },
                  ]}
                />
                <View style={styles.optTextCol}>
                  <Text style={styles.optTitle}>{o.title}</Text>
                  <Text style={styles.optDesc}>{o.desc}</Text>
                </View>
                <View
                  style={[
                    styles.check,
                    selected && { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
                  ]}
                >
                  {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.saveWrap, saving && { opacity: 0.7 }]}
        >
          <LinearGradient
            colors={["#6D28D9", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Save Difficulty</Text>
            )}
          </LinearGradient>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  title: {
    fontSize: 15,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 18,
  },
  options: { marginTop: 12, gap: 8 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: 12,
  },
  optUnsel: {
    borderWidth: 1,
    borderColor: "#1A1F30",
    backgroundColor: "#0C0E1A",
  },
  optSel: {
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotMuted: {
    backgroundColor: "#374151",
    shadowOpacity: 0,
    elevation: 0,
  },
  optTextCol: { flex: 1, minWidth: 0 },
  optTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  optDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#2A3050",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: "#FFFFFF", fontSize: 9, fontFamily: "Inter_800ExtraBold" },
  saveWrap: { marginTop: 20 },
  saveBtn: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
