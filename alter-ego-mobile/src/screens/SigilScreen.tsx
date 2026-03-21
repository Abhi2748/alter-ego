import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SIGIL_LEVELS } from "@/constants/sigils";
import { SigilGlow } from "@/components/sigil/SigilGlow";
import { SigilRenderer } from "@/components/sigil/SigilRenderer";
import { useSigilData } from "@/hooks/useSigil";

function splitDescription(text: string): { first: string; rest: string } {
  const idx = text.indexOf(". ");
  if (idx === -1) return { first: text, rest: "" };
  return { first: text.slice(0, idx + 1), rest: text.slice(idx + 2) };
}

export function SigilScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { data: sigilData, isLoading, isError, refetch, isFetching } = useSigilData();

  const currentLevel = sigilData?.sigil_level ?? 1;
  const totalAether = sigilData?.total_aether ?? 0;
  const apiProgress = sigilData?.progress;

  const [viewingLevel, setViewingLevel] = useState(currentLevel);

  useEffect(() => {
    setViewingLevel(currentLevel);
  }, [currentLevel]);

  const meta = SIGIL_LEVELS[viewingLevel - 1];
  const { glowColor, glowColor2, ambientColor, accentColor, accentColor2 } = meta;
  const descParts = splitDescription(meta.description);
  const isLocked = viewingLevel > currentLevel;

  const fillPercent = useMemo(() => {
    if (!apiProgress) return 0;
    return Math.min(100, Math.max(0, apiProgress.progress_percent));
  }, [apiProgress]);

  const nextThreshold = apiProgress?.aether_for_next ?? SIGIL_LEVELS[Math.min(currentLevel, 9)].aetherRequired;
  const showBack = navigation.canGoBack();

  const extraGlowColor =
    viewingLevel >= 9 ? "rgba(255,250,220,0.16)" : glowColor;

  if (isLoading && !sigilData) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#A78BFA" />
        <Text style={styles.loadingText}>Loading Sigil…</Text>
      </View>
    );
  }

  if (isError && !sigilData) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Couldn&apos;t load your Sigil.</Text>
        <Pressable
          onPress={() => void refetch()}
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="Retry loading sigil"
        >
          <Text style={styles.retryLabel}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SigilGlow size={600} color={ambientColor} durationMs={5000} />

      <View style={styles.topBar}>
        {showBack ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color="#9CA3AF" />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
        <Text style={[styles.headerLabel, { color: accentColor }]}>AETHER SIGIL</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {isFetching && sigilData ? (
          <View style={styles.refreshHint}>
            <ActivityIndicator size="small" color="#6B7280" />
          </View>
        ) : null}

        <Text style={[styles.levelNum, { color: accentColor }]}>
          LEVEL {String(viewingLevel).padStart(2, "0")}
        </Text>

        {viewingLevel === 10 ? (
          <MaskedView
            style={styles.titleMask}
            maskElement={
              <Text style={styles.titleTextMask}>The Eternal Flame</Text>
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

        {isLocked ? (
          <Text style={styles.lockedHint}>
            Requires {SIGIL_LEVELS[viewingLevel - 1].aetherRequired.toLocaleString()} cumulative Aether
          </Text>
        ) : null}

        <Text style={[styles.aetherSectionLabel, { color: accentColor }]}>AETHER</Text>

        <View style={styles.canvasWrap}>
          <SigilGlow size={380} color={glowColor} durationMs={4000} />
          <SigilGlow size={460} color={glowColor2} durationMs={6000} delayMs={1000} />
          {(viewingLevel === 9 || viewingLevel === 10) && (
            <SigilGlow size={520} color={extraGlowColor} durationMs={3000} />
          )}
          <View style={[styles.sigilSvg, isLocked && { opacity: 0.6 }]}>
            <SigilRenderer
              level={viewingLevel}
              size={300}
              accentColor={accentColor}
              accentColor2={accentColor2}
            />
          </View>
          {isLocked ? (
            <View style={styles.lockOverlay} pointerEvents="none">
              <Text style={styles.lockLabel}>LOCKED</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressCaps, { color: accentColor }]}>AETHER</Text>
            <Text style={[styles.progressCaps, { color: accentColor }]}>
              {currentLevel >= 10 || (apiProgress?.level ?? 0) >= 10
                ? "Maximum · The Eternal Flame"
                : `${totalAether.toLocaleString()} / ${nextThreshold.toLocaleString()}`}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fillWrap,
                {
                  width: `${currentLevel >= 10 ? 100 : fillPercent}%`,
                  shadowColor: SIGIL_LEVELS[currentLevel - 1]?.accentColor ?? accentColor,
                },
              ]}
            >
              <LinearGradient
                colors={[
                  SIGIL_LEVELS[currentLevel - 1]?.accentColor2 ?? accentColor2,
                  SIGIL_LEVELS[currentLevel - 1]?.accentColor ?? accentColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fillGradient}
              />
            </View>
            <View
              style={[
                styles.endDot,
                {
                  backgroundColor: SIGIL_LEVELS[currentLevel - 1]?.accentColor ?? accentColor,
                  shadowColor: SIGIL_LEVELS[currentLevel - 1]?.accentColor ?? accentColor,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.descBlock}>
          <Text style={styles.descText}>
            <Text style={styles.descLead}>{descParts.first}</Text>
            {descParts.rest ? ` ${descParts.rest}` : ""}
          </Text>
        </View>

        <View style={styles.dotsRow}>
          {SIGIL_LEVELS.map((s) => {
            const active = s.level === viewingLevel;
            const earnedHere = s.level === currentLevel;
            return (
              <Pressable
                key={s.level}
                onPress={() => setViewingLevel(s.level)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Sigil level ${s.level}`}
                style={styles.dotHit}
              >
                <View
                  style={[
                    active ? styles.dotCurrent : styles.dotOther,
                    active && {
                      backgroundColor: accentColor,
                      shadowColor: accentColor,
                      shadowOpacity: 0.55,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 6,
                    },
                    !active && earnedHere && styles.dotEarnedRing,
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
  root: {
    flex: 1,
    backgroundColor: "#030305",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#9CA3AF",
    fontSize: 14,
  },
  errorText: {
    color: "#9CA3AF",
    fontSize: 15,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  retryLabel: {
    color: "#A78BFA",
    fontSize: 15,
    fontWeight: "600",
  },
  refreshHint: {
    paddingVertical: 8,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
  },
  levelNum: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 5,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  levelName: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#E5E7EB",
    marginBottom: 8,
    textAlign: "center",
  },
  lockedHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  titleMask: {
    height: 44,
    width: 320,
    marginBottom: 8,
    justifyContent: "center",
  },
  titleTextMask: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    textAlign: "center",
    color: "#000",
  },
  aetherSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 6,
  },
  canvasWrap: {
    width: 300,
    height: 300,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sigilSvg: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  lockLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(229,231,235,0.85)",
    letterSpacing: 3,
  },
  progressBlock: {
    width: 280,
    marginTop: 20,
    alignSelf: "center",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  progressCaps: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  track: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "visible",
    position: "relative",
  },
  fillWrap: {
    height: 3,
    borderRadius: 3,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  fillGradient: {
    height: 3,
    borderRadius: 3,
    width: "100%",
  },
  endDot: {
    position: "absolute",
    right: -3,
    top: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  descBlock: {
    maxWidth: 320,
    marginTop: 28,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
  },
  descText: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 27,
    textAlign: "center",
  },
  descLead: {
    color: "#9CA3AF",
    fontWeight: "600",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
    flexWrap: "wrap",
  },
  dotHit: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dotCurrent: {
    width: 14,
    height: 14,
    borderRadius: 7,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  dotOther: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotEarnedRing: {
    borderWidth: 1.5,
    borderColor: "#A78BFA",
  },
});
