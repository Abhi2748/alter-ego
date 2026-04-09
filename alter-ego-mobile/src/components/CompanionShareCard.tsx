import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Share,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import { getPetImageSource } from "@/constants/characterPetAssets";

export type CompanionShareCardProps = {
  stage: number; // 1-8
  petName: string;
  username: string;
  reachedDay: number;
  reachedDate: string; // "Month DD, YYYY" or ISO; shown as-is
  totalDays: number;
  totalPF: number;
  tierLabel: string;
  /** Not yet unlocked — preview copy, share disabled */
  lockedPreview?: boolean;
  /** PF threshold to reach this stage (shown when lockedPreview) */
  unlockPfRequired?: number;
};

type StageStyle = {
  cardBg: string[];
  borderColor: string;
  borderWidth: number;
  topAccent: { colors: string[]; fullWidth?: boolean };
  brandColor: string;
  stageChip: { bg: string; border: string; text: string; borderWidth?: number };
  creatureZone: { bg: string; border: string; glow: string; glowSize: number; placeholder: string };
  nameColor: string;
  nameSize: number;
  statValueColor: string;
  statLabelColor: string;
  dateColor: string;
  quote: { bg: string; border: string; left: string; leftWidth: number; text: string };
  shareBtn: { colors: string[]; height: number; radius: number; label: string };
  legendary?: { badgeColor: string; accentGlow: string };
  boxShadow?: { shadowColor: string; shadowRadius: number; shadowOffsetY: number; elevation: number };
  shareShadow?: { shadowColor: string; shadowRadius: number; shadowOffsetY: number; elevation: number };
};

const STYLES: Record<number, StageStyle> = {
  1: {
    cardBg: ["#060E08", "#030906"],
    borderColor: "rgba(16,185,129,0.18)",
    borderWidth: 1,
    topAccent: { colors: ["rgba(16,185,129,0.30)", "rgba(16,185,129,0.30)"] },
    brandColor: "rgba(16,185,129,0.45)",
    stageChip: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", text: "rgba(16,185,129,0.70)" },
    creatureZone: {
      bg: "rgba(6,78,59,0.10)",
      border: "rgba(16,185,129,0.10)",
      glow: "rgba(16,185,129,0.18)",
      glowSize: 80,
      placeholder: "rgba(16,185,129,0.28)",
    },
    nameColor: "#E5E7EB",
    nameSize: 22,
    statValueColor: "rgba(16,185,129,0.80)",
    statLabelColor: "rgba(16,185,129,0.18)",
    dateColor: "rgba(16,185,129,0.25)",
    quote: {
      bg: "rgba(6,78,59,0.12)",
      border: "rgba(16,185,129,0.14)",
      left: "rgba(16,185,129,0.40)",
      leftWidth: 2,
      text: "rgba(16,185,129,0.60)",
    },
    shareBtn: { colors: ["#047857", "#10B981"], height: 44, radius: 14, label: "Share" },
    shareShadow: { shadowColor: "rgba(16,185,129,0.18)", shadowRadius: 14, shadowOffsetY: 10, elevation: 10 },
  },
  2: {
    cardBg: ["#070F09", "#040A06"],
    borderColor: "rgba(16,185,129,0.22)",
    borderWidth: 1,
    topAccent: { colors: ["rgba(16,185,129,0.35)", "rgba(16,185,129,0.35)"] },
    brandColor: "rgba(16,185,129,0.50)",
    stageChip: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", text: "rgba(16,185,129,0.70)" },
    creatureZone: {
      bg: "rgba(6,78,59,0.12)",
      border: "rgba(16,185,129,0.10)",
      glow: "rgba(16,185,129,0.20)",
      glowSize: 90,
      placeholder: "rgba(16,185,129,0.28)",
    },
    nameColor: "#E5E7EB",
    nameSize: 22,
    statValueColor: "rgba(16,185,129,0.82)",
    statLabelColor: "rgba(16,185,129,0.18)",
    dateColor: "rgba(16,185,129,0.28)",
    quote: {
      bg: "rgba(6,78,59,0.12)",
      border: "rgba(16,185,129,0.14)",
      left: "rgba(16,185,129,0.45)",
      leftWidth: 2,
      text: "rgba(16,185,129,0.65)",
    },
    shareBtn: { colors: ["#047857", "#10B981"], height: 44, radius: 14, label: "Share" },
    shareShadow: { shadowColor: "rgba(16,185,129,0.18)", shadowRadius: 14, shadowOffsetY: 10, elevation: 10 },
  },
  3: {
    cardBg: ["#071008", "#040B06"],
    borderColor: "rgba(52,211,153,0.25)",
    borderWidth: 1,
    topAccent: { colors: ["rgba(52,211,153,0.40)", "rgba(52,211,153,0.40)"] },
    brandColor: "rgba(52,211,153,0.50)",
    stageChip: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", text: "rgba(52,211,153,0.80)" },
    creatureZone: {
      bg: "rgba(6,78,59,0.12)",
      border: "rgba(16,185,129,0.10)",
      glow: "rgba(52,211,153,0.20)",
      glowSize: 100,
      placeholder: "rgba(52,211,153,0.30)",
    },
    nameColor: "#A7F3D0",
    nameSize: 22,
    statValueColor: "#34D399",
    statLabelColor: "rgba(16,185,129,0.18)",
    dateColor: "rgba(52,211,153,0.26)",
    quote: {
      bg: "rgba(6,78,59,0.12)",
      border: "rgba(16,185,129,0.14)",
      left: "rgba(52,211,153,0.45)",
      leftWidth: 2,
      text: "#34D399",
    },
    shareBtn: { colors: ["#065F46", "#34D399"], height: 44, radius: 14, label: "Share" },
    shareShadow: { shadowColor: "rgba(16,185,129,0.20)", shadowRadius: 16, shadowOffsetY: 12, elevation: 12 },
  },
  4: {
    cardBg: ["#071108", "#040B06"],
    borderColor: "rgba(52,211,153,0.30)",
    borderWidth: 1,
    topAccent: { colors: ["rgba(52,211,153,0.48)", "rgba(52,211,153,0.48)"] },
    brandColor: "rgba(52,211,153,0.55)",
    stageChip: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.24)", text: "rgba(110,231,183,0.85)" },
    creatureZone: {
      bg: "rgba(6,78,59,0.14)",
      border: "rgba(16,185,129,0.12)",
      glow: "rgba(52,211,153,0.22)",
      glowSize: 110,
      placeholder: "rgba(52,211,153,0.30)",
    },
    nameColor: "#A7F3D0",
    nameSize: 22,
    statValueColor: "#6EE7B7",
    statLabelColor: "rgba(16,185,129,0.18)",
    dateColor: "rgba(52,211,153,0.24)",
    quote: {
      bg: "rgba(6,78,59,0.14)",
      border: "rgba(16,185,129,0.14)",
      left: "rgba(52,211,153,0.50)",
      leftWidth: 2,
      text: "#6EE7B7",
    },
    shareBtn: { colors: ["#065F46", "#34D399"], height: 44, radius: 14, label: "Share" },
    boxShadow: { shadowColor: "rgba(16,185,129,0.20)", shadowRadius: 18, shadowOffsetY: 10, elevation: 10 },
    shareShadow: { shadowColor: "rgba(16,185,129,0.20)", shadowRadius: 18, shadowOffsetY: 12, elevation: 12 },
  },
  5: {
    cardBg: ["#071209", "#040C07"],
    borderColor: "rgba(110,231,183,0.28)",
    borderWidth: 1,
    topAccent: { colors: ["rgba(110,231,183,0.50)", "rgba(110,231,183,0.50)"] },
    brandColor: "rgba(110,231,183,0.55)",
    stageChip: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", text: "rgba(110,231,183,0.85)" },
    creatureZone: {
      bg: "rgba(6,78,59,0.16)",
      border: "rgba(110,231,183,0.16)",
      glow: "rgba(110,231,183,0.20)",
      glowSize: 120,
      placeholder: "rgba(110,231,183,0.30)",
    },
    nameColor: "#A7F3D0",
    nameSize: 22,
    statValueColor: "#6EE7B7",
    statLabelColor: "rgba(6,78,59,0.60)",
    dateColor: "rgba(110,231,183,0.22)",
    quote: {
      bg: "rgba(6,78,59,0.16)",
      border: "rgba(52,211,153,0.20)",
      left: "rgba(110,231,183,0.50)",
      leftWidth: 2,
      text: "#6EE7B7",
    },
    shareBtn: { colors: ["#064E3B", "#10B981"], height: 44, radius: 14, label: "Share" },
    boxShadow: { shadowColor: "rgba(16,185,129,0.25)", shadowRadius: 20, shadowOffsetY: 12, elevation: 12 },
    shareShadow: { shadowColor: "rgba(16,185,129,0.25)", shadowRadius: 20, shadowOffsetY: 12, elevation: 12 },
  },
  6: {
    cardBg: ["#081409", "#050D07"],
    borderColor: "rgba(110,231,183,0.35)",
    borderWidth: 1,
    topAccent: { colors: ["rgba(110,231,183,0.55)", "rgba(110,231,183,0.55)"] },
    brandColor: "rgba(110,231,183,0.60)",
    stageChip: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.28)", text: "rgba(110,231,183,0.90)" },
    creatureZone: {
      bg: "rgba(6,78,59,0.18)",
      border: "rgba(110,231,183,0.18)",
      glow: "rgba(110,231,183,0.24)",
      glowSize: 130,
      placeholder: "rgba(110,231,183,0.32)",
    },
    nameColor: "#6EE7B7",
    nameSize: 22,
    statValueColor: "#6EE7B7",
    statLabelColor: "#064E3B",
    dateColor: "rgba(110,231,183,0.20)",
    quote: {
      bg: "rgba(6,78,59,0.18)",
      border: "rgba(52,211,153,0.20)",
      left: "rgba(110,231,183,0.55)",
      leftWidth: 2,
      text: "#6EE7B7",
    },
    shareBtn: { colors: ["#064E3B", "#10B981"], height: 44, radius: 14, label: "Share" },
    boxShadow: { shadowColor: "rgba(16,185,129,0.28)", shadowRadius: 22, shadowOffsetY: 12, elevation: 12 },
    shareShadow: { shadowColor: "rgba(16,185,129,0.28)", shadowRadius: 22, shadowOffsetY: 12, elevation: 12 },
  },
  7: {
    cardBg: ["#081509", "#050E07"],
    borderColor: "rgba(52,211,153,0.45)",
    borderWidth: 1.5,
    topAccent: { colors: ["rgba(110,231,183,0.65)", "rgba(110,231,183,0.65)"] },
    brandColor: "rgba(110,231,183,0.65)",
    stageChip: { bg: "rgba(167,243,208,0.10)", border: "rgba(110,231,183,0.22)", text: "#A7F3D0" },
    creatureZone: {
      bg: "rgba(6,78,59,0.18)",
      border: "rgba(110,231,183,0.18)",
      glow: "rgba(110,231,183,0.24)",
      glowSize: 140,
      placeholder: "rgba(110,231,183,0.32)",
    },
    nameColor: "#6EE7B7",
    nameSize: 24,
    statValueColor: "#A7F3D0",
    statLabelColor: "#064E3B",
    dateColor: "rgba(110,231,183,0.22)",
    quote: {
      bg: "rgba(6,78,59,0.18)",
      border: "rgba(52,211,153,0.22)",
      left: "rgba(110,231,183,0.55)",
      leftWidth: 3,
      text: "#A7F3D0",
    },
    shareBtn: { colors: ["#022C22", "#047857", "#34D399"], height: 44, radius: 14, label: "✦ Share" },
    boxShadow: { shadowColor: "rgba(16,185,129,0.30)", shadowRadius: 26, shadowOffsetY: 14, elevation: 14 },
    shareShadow: { shadowColor: "rgba(16,185,129,0.30)", shadowRadius: 26, shadowOffsetY: 14, elevation: 14 },
  },
  8: {
    cardBg: ["#0A1A0C", "#061008"],
    borderColor: "rgba(52,211,153,0.60)",
    borderWidth: 2,
    topAccent: { colors: ["rgba(52,211,153,0.20)", "rgba(110,231,183,0.80)", "rgba(52,211,153,0.20)"], fullWidth: true },
    brandColor: "rgba(167,243,208,0.85)",
    stageChip: {
      bg: "rgba(167,243,208,0.14)",
      border: "rgba(167,243,208,0.50)",
      text: "#A7F3D0",
      borderWidth: 2,
    },
    creatureZone: {
      bg: "rgba(6,78,59,0.22)",
      border: "rgba(52,211,153,0.22)",
      glow: "rgba(52,211,153,0.30)",
      glowSize: 180,
      placeholder: "rgba(167,243,208,0.22)",
    },
    nameColor: "#34D399",
    nameSize: 26,
    statValueColor: "#A7F3D0",
    statLabelColor: "#064E3B",
    dateColor: "rgba(167,243,208,0.22)",
    quote: {
      bg: "rgba(6,78,59,0.22)",
      border: "rgba(52,211,153,0.25)",
      left: "#34D399",
      leftWidth: 3,
      text: "#D1FAE5",
    },
    shareBtn: { colors: ["#022C22", "#065F46", "#10B981", "#6EE7B7"], height: 48, radius: 15, label: "✦ Share this milestone" },
    legendary: { badgeColor: "rgba(52,211,153,0.35)", accentGlow: "rgba(16,185,129,0.14)" },
    boxShadow: { shadowColor: "rgba(16,185,129,0.40)", shadowRadius: 28, shadowOffsetY: 16, elevation: 16 },
    shareShadow: { shadowColor: "rgba(16,185,129,0.40)", shadowRadius: 24, shadowOffsetY: 14, elevation: 14 },
  },
};

const QUOTES: Record<number, string> = {
  1: "The day you proved you would show up. Your Cat arrived.",
  2: "The Fox watched you work. It grew.",
  3: "Fifty days. Clever and capable. So are you.",
  4: "Four months. The Panther arrives for people who stayed.",
  5: "Nine months. Snow Leopard. Rare. Patient. Exactly like you became.",
  6: "The Tiger is what discipline looks like when it stops being hard.",
  7: "The Phoenix exists because you refused to stop.",
  8: "A Dragon is not an achievement. It is a biography.",
};

export const CompanionShareCard = forwardRef<View, CompanionShareCardProps>(
  (
    {
      stage,
      petName,
      username,
      reachedDay,
      reachedDate,
      totalDays,
      totalPF,
      tierLabel,
      lockedPreview = false,
      unlockPfRequired = 0,
    },
    ref
  ) => {
    const [sharing, setSharing] = useState(false);
    const innerRef = useRef<View>(null);
    const s = STYLES[Math.min(8, Math.max(1, stage))] ?? STYLES[1];
    const quoteUnlocked = QUOTES[Math.min(8, Math.max(1, stage))] ?? "";
    const quote =
      lockedPreview && unlockPfRequired > 0
        ? `Preview — reach ${unlockPfRequired.toLocaleString()} PF total to unlock ${petName}. Your companion art is waiting.`
        : lockedPreview
          ? `Preview — keep earning Pet Food to unlock ${petName}.`
          : quoteUnlocked;

    useImperativeHandle(ref, () => innerRef.current as View, []);

    const shadowStyle = useMemo(() => {
      if (!s.boxShadow) return null;
      return Platform.OS === "ios"
        ? {
            shadowColor: s.boxShadow.shadowColor,
            shadowOpacity: 1,
            shadowRadius: s.boxShadow.shadowRadius,
            shadowOffset: { width: 0, height: s.boxShadow.shadowOffsetY },
          }
        : { elevation: s.boxShadow.elevation };
    }, [s.boxShadow]);

    const shareShadowStyle = useMemo(() => {
      if (!s.shareShadow) return null;
      return Platform.OS === "ios"
        ? {
            shadowColor: s.shareShadow.shadowColor,
            shadowOpacity: 1,
            shadowRadius: s.shareShadow.shadowRadius,
            shadowOffset: { width: 0, height: s.shareShadow.shadowOffsetY },
          }
        : { elevation: s.shareShadow.elevation };
    }, [s.shareShadow]);

    const handleShare = async () => {
      if (lockedPreview) return;
      const node = innerRef.current;
      if (!node) return;
      setSharing(true);
      try {
        const uri = await captureRef(node, {
          format: "png",
          quality: 0.95,
          result: "tmpfile",
        });
        await Share.share({
          url: Platform.OS === "ios" ? uri : `file://${uri}`,
          message: `My ALTER EGO companion: ${petName} (Stage ${stage})`,
          title: "Companion",
        });
      } catch (e) {
        if ((e as Error).message?.includes("User did not share")) return;
      } finally {
        setSharing(false);
      }
    };

    return (
      <View
        ref={innerRef}
        collapsable={false}
        style={[
          styles.card,
          shadowStyle,
          { borderColor: s.borderColor, borderWidth: s.borderWidth },
        ]}
      >
        <LinearGradient
          colors={s.cardBg as [string, string, ...string[]]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* top accent */}
        <LinearGradient
          colors={s.topAccent.colors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.topAccent,
            s.topAccent.fullWidth ? styles.topAccentFull : styles.topAccentInset,
          ]}
        />

        {/* Legendary atmospheric glow */}
        {stage === 8 && (
          <View
            pointerEvents="none"
            style={[
              styles.legendaryAtmosphere,
              { backgroundColor: s.legendary?.accentGlow ?? "rgba(16,185,129,0.14)" },
            ]}
          />
        )}

        <View style={styles.inner}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.brand, { color: s.brandColor }]}>
                ALTER EGO · COMPANION
              </Text>
              {stage === 8 && (
                <Text style={[styles.legendaryBadge, { color: s.legendary?.badgeColor ?? "rgba(52,211,153,0.35)" }]}>
                  ✦ LEGENDARY
                </Text>
              )}
            </View>
            <View
              style={[
                styles.stageChip,
                {
                  backgroundColor: s.stageChip.bg,
                  borderColor: s.stageChip.border,
                  borderWidth: s.stageChip.borderWidth ?? 1,
                },
              ]}
            >
              <Text style={[styles.stageChipText, { color: s.stageChip.text }]}>
                {`Stage ${stage}`}
              </Text>
            </View>
          </View>

          {/* Top row: pet left, info right (Identity-style) */}
          <View style={styles.topRow}>
            <View style={styles.petLeftArt}>
              <Image
                source={getPetImageSource(Math.min(8, Math.max(1, stage)))}
                style={styles.petLeftImage}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <View style={styles.petMetaCol}>
              <Text style={[styles.petName, { color: s.nameColor, fontSize: s.nameSize }]}>
                {petName}
                {lockedPreview ? (
                  <Text style={styles.previewBadge}> · Preview</Text>
                ) : null}
              </Text>
              <Text style={styles.userLine}>{`${username} · Day ${reachedDay}`}</Text>
              <Text style={[styles.dateLine, { color: s.dateColor }]}>{reachedDate}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: s.statValueColor }]}>
                {totalDays}
              </Text>
              <Text style={[styles.statLabel, { color: s.statLabelColor }]}>DAYS</Text>
            </View>
            <View style={[styles.stat, styles.statDivided]}>
              <Text style={[styles.statValue, { color: s.statValueColor }]}>
                {totalPF.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: s.statLabelColor }]}>PF</Text>
            </View>
            <View style={[styles.stat, styles.statDivided]}>
              <Text style={[styles.statValue, { color: s.statValueColor }]}>
                {tierLabel}
              </Text>
              <Text style={[styles.statLabel, { color: s.statLabelColor }]}>TIER</Text>
            </View>
          </View>

          {/* Quote box */}
          <View
            style={[
              styles.quoteBox,
              {
                backgroundColor: s.quote.bg,
                borderColor: s.quote.border,
                borderLeftColor: s.quote.left,
                borderLeftWidth: s.quote.leftWidth,
              },
            ]}
          >
            <Text style={[styles.quoteText, { color: s.quote.text }]}>{quote}</Text>
          </View>

          {/* Share button */}
          <Pressable
            onPress={handleShare}
            disabled={sharing || lockedPreview}
            style={({ pressed }) => [
              styles.shareBtnWrap,
              shareShadowStyle,
              !lockedPreview && pressed ? { transform: [{ scale: 0.98 }] } : null,
            ]}
          >
            <LinearGradient
              colors={
                lockedPreview
                  ? (["#1f2937", "#374151"] as [string, string, ...string[]])
                  : (s.shareBtn.colors as [string, string, ...string[]])
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.shareBtn,
                {
                  height: s.shareBtn.height,
                  borderRadius: s.shareBtn.radius,
                  opacity: lockedPreview ? 0.55 : 1,
                },
              ]}
            >
              <Text style={styles.shareBtnText}>
                {lockedPreview ? "Unlock to share" : s.shareBtn.label}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }
);

CompanionShareCard.displayName = "CompanionShareCard";

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  topAccent: {
    position: "absolute",
    top: 0,
    height: 1,
  },
  topAccentInset: {
    left: "15%",
    right: "15%",
  },
  topAccentFull: {
    left: 0,
    right: 0,
  },
  legendaryAtmosphere: {
    position: "absolute",
    top: -60,
    left: "50%",
    width: 180,
    height: 180,
    borderRadius: 999,
    transform: [{ translateX: -90 }],
    opacity: 1,
  },
  inner: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  brand: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  legendaryBadge: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 12,
  },
  stageChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  stageChipText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14,
  },
  petLeftArt: {
    width: 92,
    height: 92,
    justifyContent: "center",
    alignItems: "center",
  },
  petLeftImage: {
    width: 92,
    height: 92,
  },
  previewBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(52,211,153,0.55)",
  },
  petMetaCol: {
    flex: 1,
    justifyContent: "center",
  },
  petName: {
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 3,
  },
  userLine: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 1,
  },
  dateLine: {
    fontSize: 10,
    color: "rgba(16,185,129,0.30)",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(16,185,129,0.08)",
    paddingTop: 10,
    marginBottom: 10,
  },
  stat: {
    flex: 1,
    paddingRight: 10,
  },
  statDivided: {
    borderLeftWidth: 1,
    borderLeftColor: "rgba(16,185,129,0.08)",
    paddingLeft: 10,
    paddingRight: 0,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quoteBox: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 12,
    borderWidth: 1,
  },
  quoteText: {
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 17,
  },
  shareBtnWrap: {},
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
});

