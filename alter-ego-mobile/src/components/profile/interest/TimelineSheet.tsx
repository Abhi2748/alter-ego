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
import type { PostInterestPayload } from "@/utils/api";

const OPTIONS: {
  value: NonNullable<PostInterestPayload["target_timeline"]>;
  title: string;
  sub: string;
}[] = [
  { value: "no_deadline", title: "No fixed deadline", sub: "Open practice — arc adapts to your pace" },
  { value: "1_month", title: "About 1 month", sub: "Short sprint" },
  { value: "3_months", title: "About 3 months", sub: "Typical skill-building window" },
  { value: "6_months", title: "About 6 months", sub: "Steady long arc" },
  { value: "1_year", title: "About a year", sub: "Big goal on the horizon" },
];

export type TimelineSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  path: InterestPathDisplay | null;
  onSave: (target_timeline: string) => Promise<void>;
};

export function TimelineSheet({ sheetRef, path, onSave }: TimelineSheetProps) {
  const [selected, setSelected] = useState<string>("no_deadline");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setSelected("no_deadline");
  }, [path?.path_id]);

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
      await onSave(selected);
      sheetRef.current?.dismiss();
    } catch {
      /* keep open */
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["72%"]}
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
        <Text style={styles.title}>Target timeline</Text>
        <Text style={styles.sub}>
          We&apos;ll adjust your arc length and planned sessions for {path?.interest_name ?? "this interest"}.
        </Text>

        {OPTIONS.map((opt) => {
          const on = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setSelected(opt.value)}
              style={[styles.row, on && styles.rowOn]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, on && styles.rowTitleOn]}>{opt.title}</Text>
                <Text style={styles.rowSub}>{opt.sub}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>
                {on ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          );
        })}

        <Pressable onPress={save} disabled={saving} style={[styles.saveWrap, saving && { opacity: 0.6 }]}>
          <LinearGradient
            colors={["#6D28D9", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Save timeline</Text>
            )}
          </LinearGradient>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1A1F30",
    backgroundColor: "#0C0E1A",
    marginBottom: 8,
  },
  rowOn: {
    borderColor: "rgba(139,92,246,0.35)",
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#E5E7EB" },
  rowTitleOn: { color: "#C4B5FD" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: "#8B5CF6" },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B5CF6",
  },
  saveWrap: { marginTop: 14 },
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
