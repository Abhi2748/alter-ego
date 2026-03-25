import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { Ionicons } from "@expo/vector-icons";
import { SIGIL_LEVELS } from "@/constants/sigils";
import { useSigilData } from "@/hooks/useSigil";
import { SigilGlow } from "@/components/sigil/SigilGlow";
import { SigilRenderer } from "@/components/sigil/SigilRenderer";
import { getErrorMessage } from "@/services/api";

const BG = "#030305";
const TEXT_MUTED = "#6B7280";
const TEXT_DIM = "#9CA3AF";

export function SigilScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { data: sigilData, isLoading, isError, refetch, error } = useSigilData();

  const currentLevel = sigilData?.sigil_level ?? 1;
  const totalAether = sigilData?.total_aether ?? 0;
  const apiProgress = sigilData?.progress;
  const [viewingLevel, setViewingLevel] = useState(currentLevel);

  useEffect(() => {
    setViewingLevel(currentLevel);
  }, [currentLevel]);

  const meta = SIGIL_LEVELS[viewingLevel - 1];
  const isLocked = viewingLevel > currentLevel;

  const nextThreshold = useMemo(() => {
    if (viewingLevel >= 10) return SIGIL_LEVELS[9].aetherRequired;
    if (
      viewingLevel === currentLevel &&
      apiProgress != null &&
      apiProgress.aether_for_next > 0
    ) {
      return apiProgress.aether_for_next;
    }
    return SIGIL_LEVELS[viewingLevel].aetherRequired;
  }, [viewingLevel, currentLevel, apiProgress]);

  const fillPercent = useMemo(() => {
    if (isLocked) return 0;
    if (viewingLevel < currentLevel) return 100;
    if (viewingLevel === currentLevel) {
      return Math.min(100, Math.max(0, apiProgress?.progress_percent ?? 0));
    }
    return 0;
  }, [isLocked, viewingLevel, currentLevel, apiProgress]);

  const barLabelRight = useMemo(() => {
    if (viewingLevel >= 10) return "Maximum · The Eternal Flame";
    return `${totalAether.toLocaleString()} / ${nextThreshold.toLocaleString()}`;
  }, [viewingLevel, totalAether, nextThreshold]);

  const descParts = useMemo(() => {
    const d = meta.description;
    const idx = d.indexOf(".");
    if (idx === -1) return { lead: d, rest: "" };
    return { lead: d.slice(0, idx + 1), rest: d.slice(idx + 1).trim() };
  }, [meta.description]);

  const extraGlow =
    viewingLevel >= 9 ? (viewingLevel === 10 ? "rgba(253,230,138,0.12)" : meta.glowColor) : null;

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: BG }]}>
        <ActivityIndicator color="#A78BFA" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: BG, padding: 24 }]}>
        <Text style={styles.errText}>Couldn&apos;t load your Sigil.</Text>
        <Text style={[styles.errSub, { marginTop: 8 }]}>{getErrorMessage(error)}</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={meta.accentColor} />
        </Pressable>
        <Text style={[styles.title, { color: meta.accentColor }]}>AETHER SIGIL</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingBottom: 40 + insets.bottom,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.levelNum, { color: meta.accentColor }]}>
          LEVEL {String(viewingLevel).padStart(2, "0")}
        </Text>

        {isLocked ? (
          <Text style={styles.lockedName}>— — —</Text>
        ) : viewingLevel === 10 ? (
          <MaskedView
            style={{ height: 44, width: Dimensions.get("window").width - 32, marginBottom: 6 }}
            maskElement={
              <Text style={[styles.levelName, { color: "#000", textAlign: "center" }]}>
                {meta.name}
              </Text>
            }
          >
            <LinearGradient
              colors={["#FEF3C7", "#FDE68A", "#FFFFFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </MaskedView>
        ) : (
          <Text style={styles.levelName}>{meta.name}</Text>
        )}

        <Text style={[styles.aetherLabel, { color: meta.accentColor }]}>AETHER</Text>

        <View style={styles.canvasWrap}>
          {extraGlow ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: extraGlow, opacity: viewingLevel === 10 ? 0.08 : 0.04, borderRadius: 8 },
              ]}
            />
          ) : null}
          {!isLocked ? (
            <>
              <SigilGlow size={380} color={meta.glowColor} durationMs={4000} />
              <SigilGlow size={460} color={meta.glowColor2} durationMs={6000} delayMs={1000} />
              {viewingLevel >= 9 ? (
                <SigilGlow size={520} color={extraGlow ?? meta.glowColor} durationMs={3000} />
              ) : null}
              <SigilRenderer
                level={viewingLevel}
                size={300}
                accentColor={meta.accentColor}
                accentColor2={meta.accentColor2}
              />
            </>
          ) : (
            <View style={styles.fog}>
              <View
                style={[styles.fogTint, { shadowColor: meta.accentColor }]}
                pointerEvents="none"
              />
              <Text style={styles.fogQ}>?</Text>
              <Text style={styles.fogLocked}>LOCKED</Text>
            </View>
          )}
        </View>

        <View style={styles.barSection}>
          <View style={styles.barLabelRow}>
            <Text style={[styles.barLbl, { color: meta.accentColor }]}>AETHER</Text>
            <Text style={[styles.barLbl, { color: meta.accentColor }]}>{barLabelRight}</Text>
          </View>
          <View style={styles.trackRow}>
            <View style={styles.track}>
              {!isLocked && fillPercent > 0 ? (
                <LinearGradient
                  colors={[meta.accentColor2, meta.accentColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fill, { width: `${fillPercent}%` }]}
                />
              ) : null}
            </View>
            <View
              style={[
                styles.endDot,
                {
                  backgroundColor: meta.accentColor,
                  shadowColor: meta.accentColor,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.descBlock}>
          {isLocked ? (
            <Text style={styles.lockedDesc}>
              Earn {SIGIL_LEVELS[viewingLevel - 1].aetherRequired.toLocaleString()} Aether to reveal this
              sigil.
            </Text>
          ) : (
            <Text style={styles.descText}>
              <Text style={styles.descLead}>{descParts.lead}</Text>
              {descParts.rest ? ` ${descParts.rest}` : ""}
            </Text>
          )}
        </View>

        <View style={styles.dotsRow}>
          {SIGIL_LEVELS.map((s) => {
            const n = s.level;
            const active = n === viewingLevel;
            const unlocked = n <= currentLevel;
            const dm = SIGIL_LEVELS[n - 1];
            return (
              <Pressable key={n} onPress={() => setViewingLevel(n)} hitSlop={6}>
                <View
                  style={[
                    unlocked ? styles.dotUnlocked : styles.dotLocked,
                    active && {
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: dm.accentColor,
                      shadowColor: dm.accentColor,
                      shadowOpacity: 0.5,
                      shadowRadius: 6,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errText: { color: "#E5E7EB", textAlign: "center", fontWeight: "600", fontSize: 16 },
  errSub: { color: "#6B7280", textAlign: "center", fontSize: 13, marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "#1E2333" },
  retryTxt: { color: "#A78BFA", fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: { width: 28, height: 28, justifyContent: "center" },
  title: { fontSize: 10, fontWeight: "700", letterSpacing: 4 },
  levelNum: { fontSize: 10, fontWeight: "700", letterSpacing: 5, marginTop: 8, textTransform: "uppercase" },
  levelName: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 6,
  },
  lockedName: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "rgba(229,231,235,0.15)",
    marginBottom: 6,
  },
  aetherLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  canvasWrap: {
    width: 300,
    height: 300,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  fog: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,3,5,0.97)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  fogTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(139,92,246,0.04)",
  },
  fogQ: { fontSize: 56, fontWeight: "900", color: "rgba(255,255,255,0.07)" },
  fogLocked: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 4,
    color: "rgba(255,255,255,0.10)",
    marginTop: 4,
  },
  barSection: { width: 280, marginTop: 20 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  barLbl: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2 },
  endDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  descBlock: {
    marginTop: 28,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    width: "100%",
    maxWidth: 320,
  },
  descText: { fontSize: 15, color: TEXT_MUTED, lineHeight: 27, textAlign: "center" },
  descLead: { color: TEXT_DIM, fontWeight: "600" },
  lockedDesc: { fontSize: 15, lineHeight: 27, textAlign: "center", color: "rgba(107,114,128,0.35)" },
  dotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
  },
  dotLocked: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotUnlocked: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
});
