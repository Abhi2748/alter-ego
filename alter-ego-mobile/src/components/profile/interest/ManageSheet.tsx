import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import type { InterestPathDisplay } from "@/types/interestPath";

export type ManageSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  path: InterestPathDisplay | null;
  /** Invoked when sheet is dismissed (swipe, backdrop, Cancel) — parent clears selection unless suppressed */
  onDismiss: () => void;
  onChangeDifficulty: () => void;
  onChangeSchedule: () => void;
  onChangeGoal: () => void;
  onDelete: () => void;
};

export function ManageSheet({
  sheetRef,
  path,
  onDismiss,
  onChangeDifficulty,
  onChangeSchedule,
  onChangeGoal,
  onDelete,
}: ManageSheetProps) {
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

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["45%"]}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {path?.interest_name ?? "—"}
        </Text>
        <Text style={styles.subtitle}>Manage this interest</Text>

        <Pressable style={styles.row} onPress={onChangeDifficulty}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(139,92,246,0.1)" }]}>
            <Text style={styles.iconEmoji}>⚡</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.rowTitle}>Change Difficulty</Text>
            <Text style={styles.rowDesc}>Currently: {path?.difficulty_label ?? "—"}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={onChangeSchedule}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(96,165,250,0.1)" }]}>
            <Text style={styles.iconEmoji}>📅</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.rowTitle}>Change Schedule</Text>
            <Text style={styles.rowDesc}>{path?.schedule_abbrev ?? "—"}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={onChangeGoal}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(251,191,36,0.1)" }]}>
            <Text style={styles.iconEmoji}>🎯</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.rowTitle}>Change Goal</Text>
            <Text style={styles.rowDesc}>Resets your current path</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={onDelete}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(248,113,113,0.1)" }]}>
            <Text style={styles.iconEmoji}>🗑</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.rowTitle, { color: "#F87171" }]}>Delete Interest</Text>
            <Text style={styles.rowDesc}>Removes all progress permanently</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.cancel} onPress={() => sheetRef.current?.dismiss()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: "#141824",
  },
  handleIndicator: {
    backgroundColor: "#2A3050",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: "#141824",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginBottom: 18,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#141825",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 18 },
  col: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  rowDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  chev: { fontSize: 14, color: "#3D4460" },
  cancel: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
});
