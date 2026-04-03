import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import type { QuitTarget } from "@/types/quits";
import { QUIT_ORANGE } from "@/constants/missionColors";

export type QuitManageSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  target: QuitTarget | null;
  onDismiss: () => void;
  onUpdateTriggerProfile: () => void;
  onConquer: () => void;
  onDelete: () => void;
};

export function QuitManageSheet({
  sheetRef,
  target,
  onDismiss,
  onUpdateTriggerProfile,
  onConquer,
  onDelete,
}: QuitManageSheetProps) {
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
      snapPoints={["46%"]}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#0F1220" }}
      handleIndicatorStyle={{ backgroundColor: "#2A3050" }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {target?.habit_name ?? "—"}
        </Text>
        <Text style={styles.subtitle}>Manage quit target</Text>

        <Pressable style={styles.row} onPress={onUpdateTriggerProfile}>
          <View style={styles.iconAmber}>
            <Text style={styles.iconEmoji}>🎯</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.rowTitle}>Update Trigger Profile</Text>
            <Text style={styles.rowDesc}>Refine when and why this happens</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        {target?.status !== "completed" ? (
          <Pressable style={styles.row} onPress={onConquer}>
            <View
              style={[
                styles.iconAmber,
                { backgroundColor: "rgba(139,92,246,0.12)", borderColor: "rgba(139,92,246,0.22)" },
              ]}
            >
              <Text style={styles.iconEmoji}>🏆</Text>
            </View>
            <View style={styles.col}>
              <Text style={[styles.rowTitle, { color: "#A78BFA" }]}>I conquered this habit</Text>
              <Text style={styles.rowDesc}>Self-declare victory — keeps your progress as a trophy</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.row} onPress={onDelete}>
          <View style={styles.iconRed}>
            <Text style={styles.iconEmoji}>🗑</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.rowTitle, styles.rowTitleDanger]}>Delete Quit Target</Text>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  iconAmber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconRed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
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
  rowTitleDanger: { color: QUIT_ORANGE.text },
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
