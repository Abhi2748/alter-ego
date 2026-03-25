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

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function maskToDays(mask: boolean[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (mask[i]) out.push(i + 1);
  }
  return out;
}

function daysToMask(days: number[]): boolean[] {
  const m = [false, false, false, false, false, false, false];
  for (const d of days) {
    if (d >= 1 && d <= 7) m[d - 1] = true;
  }
  return m;
}

export type ScheduleSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  path: InterestPathDisplay | null;
  onSave: (active_days: number[]) => Promise<void>;
};

export function ScheduleSheet({ sheetRef, path, onSave }: ScheduleSheetProps) {
  const [mask, setMask] = useState<boolean[]>(() => daysToMask(path?.schedule_days ?? []));
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setMask(daysToMask(path?.schedule_days ?? [1, 2, 3, 4, 5, 6, 7]));
  }, [path?.path_id, path?.schedule_days]);

  const n = mask.filter(Boolean).length;

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

  const toggle = (i: number) => {
    setMask((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const save = async () => {
    const days = maskToDays(mask);
    if (days.length < 2) return;
    setSaving(true);
    try {
      await onSave(days);
      sheetRef.current?.dismiss();
    } catch {
      /* keep sheet open */
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["48%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#0F1220" }}
      handleIndicatorStyle={{ backgroundColor: "#2A3050" }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Practice Schedule</Text>
        <Text style={styles.sub}>
          Which days should {path?.interest_name ?? "this interest"} missions appear? Pick at
          least 2.
        </Text>

        <View style={styles.grid}>
          {LABELS.map((lbl, i) => {
            const on = mask[i];
            return (
              <Pressable
                key={i}
                onPress={() => toggle(i)}
                style={[styles.dayCell, on ? styles.dayOn : styles.dayOff]}
              >
                <Text style={[styles.dayLbl, on ? styles.dayLblOn : styles.dayLblOff]}>{lbl}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>
          {n} days selected · Takes effect from tomorrow
        </Text>

        <Pressable
          onPress={save}
          disabled={n < 2 || saving}
          style={[styles.saveWrap, (n < 2 || saving) && { opacity: 0.45 }]}
        >
          <LinearGradient
            colors={n < 2 ? ["#2A3050", "#2A3050"] : ["#6D28D9", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Save Schedule</Text>
            )}
          </LinearGradient>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
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
  grid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  dayCell: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOff: {
    borderWidth: 1,
    borderColor: "#1A1F30",
    backgroundColor: "#0C0E1A",
  },
  dayOn: {
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    backgroundColor: "rgba(139,92,246,0.1)",
  },
  dayLbl: { fontSize: 11, fontFamily: "Inter_700Bold" },
  dayLblOff: { color: "#4B5563" },
  dayLblOn: { color: "#A78BFA" },
  note: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
    textAlign: "center",
    marginTop: 10,
  },
  saveWrap: { marginTop: 18 },
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
