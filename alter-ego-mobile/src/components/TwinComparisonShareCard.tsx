/**
 * Twin Comparison Share Card — Full-screen modal with shareable card.
 * Twin ahead (gap_days > 0): violet card. User ahead (gap_days <= 0): gold card.
 * Capture via react-native-view-shot and share via native share sheet.
 */

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useWindowDimensions,
  Share,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import type { TwinComparisonOut } from "../utils/api";

const CARD_PADDING_H = 20;
const CARD_MIN_WIDTH = 320;
const FIGURE_W = 118;
const FIGURE_H_TWIN_AHEAD = 160;
const FIGURE_H_USER_AHEAD_USER = 170;
const FIGURE_H_USER_AHEAD_TWIN = 130;
const FIGURE_GAP = 12;

type Props = {
  visible: boolean;
  onClose: () => void;
  comparison: TwinComparisonOut | null;
};

export function TwinComparisonShareCard({ visible, onClose, comparison }: Props) {
  const cardRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(CARD_MIN_WIDTH, screenWidth - CARD_PADDING_H * 2);
  const [sharing, setSharing] = React.useState(false);

  const gapDays = comparison?.gap_days ?? 0;
  const twinAhead = gapDays > 0;
  const userPower = comparison?.user_power_score != null ? Math.round(comparison.user_power_score) : 0;
  const twinPower = comparison?.twin_power_score != null ? Math.round(comparison.twin_power_score) : 0;
  const userStreak = comparison?.user_streak ?? 0;
  const twinStreak = comparison?.twin_streak ?? 0;

  const monthYear = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Share.share({
        url: Platform.OS === "ios" ? uri : `file://${uri}`,
        message: "I'm racing my Shadow Twin on ALTER EGO — alterego.app",
        title: "ALTER EGO — Shadow Twin",
      });
    } catch (e) {
      if ((e as Error).message?.includes("User did not share")) return;
      Alert.alert("Share", "Could not share card. Try again.");
    } finally {
      setSharing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.centered}>
          <View ref={cardRef} collapsable={false} style={[styles.cardOuter, { width: cardWidth }]}>
            {twinAhead ? (
              <LinearGradient
                colors={["#110E24", "#0D0B1C", "#09080F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, styles.cardViolet]}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.brandViolet}>ALTER EGO</Text>
                  <Text style={styles.subtitleDim}>YOU vs TWIN</Text>
                </View>
                <View style={styles.figuresRow}>
                  <View style={[styles.figureCard, styles.figureUserViolet]}>
                    <LinearGradient
                      colors={["rgba(40,20,80,0.5)", "rgba(8,8,18,0.9)"]}
                      style={[styles.figureFill, { height: FIGURE_H_TWIN_AHEAD }]}
                    />
                    <View style={[styles.petDot, styles.petDotUserViolet]} />
                  </View>
                  <View style={styles.fractureViolet} />
                  <View style={[styles.figureCard, styles.figureTwinViolet]}>
                    <LinearGradient
                      colors={["rgba(80,30,160,0.6)", "rgba(15,10,30,0.92)"]}
                      style={[styles.figureFill, { height: FIGURE_H_TWIN_AHEAD }]}
                    />
                    <View style={[styles.petDot, styles.petDotTwinViolet]} />
                  </View>
                </View>
                <View style={styles.statsRowCard}>
                  <View style={styles.statCell}>
                    <Text style={styles.statValueViolet}>{gapDays}</Text>
                    <Text style={styles.statLabelCard}>Gap (days)</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statValueViolet}>{userPower} / {twinPower}</Text>
                    <Text style={styles.statLabelCard}>Power Score</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statValueViolet}>{userStreak} / {twinStreak}</Text>
                    <Text style={styles.statLabelCard}>Streak</Text>
                  </View>
                </View>
                <Text style={styles.oracleViolet} numberOfLines={2}>
                  {comparison?.strip_message ?? "Your rival is you — one week ahead."}
                </Text>
                <View style={styles.footer}>
                  <Text style={styles.footerLeft}>alterego.app</Text>
                  <View style={styles.footerDivider} />
                  <Text style={styles.footerRight}>{monthYear}</Text>
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={["#18120A", "#120D06", "#0A0805"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, styles.cardGold]}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.brandGold}>ALTER EGO</Text>
                  <Text style={styles.subtitleDim}>YOU vs TWIN</Text>
                </View>
                <View style={styles.figuresRow}>
                  <View style={[styles.figureCard, styles.figureUserGold]}>
                    <Text style={styles.leadingBadge}>LEADING</Text>
                    <LinearGradient
                      colors={["rgba(200,140,40,0.4)", "rgba(30,22,10,0.9)"]}
                      style={[styles.figureFill, { height: FIGURE_H_USER_AHEAD_USER }]}
                    />
                    <View style={[styles.petDot, styles.petDotUserGold]} />
                  </View>
                  <View style={styles.fractureGold} />
                  <View style={[styles.figureCard, styles.figureTwinGold]}>
                    <View style={styles.figureTwinGoldDim}>
                      <LinearGradient
                        colors={["rgba(60,40,15,0.5)", "rgba(15,10,5,0.95)"]}
                        style={[styles.figureFill, { height: FIGURE_H_USER_AHEAD_TWIN }]}
                      />
                    </View>
                    <View style={[styles.petDot, styles.petDotTwinGold]} />
                  </View>
                </View>
                <View style={[styles.statsRowCard, styles.statsRowGold]}>
                  <View style={styles.statCell}>
                    <Text style={styles.statValueGold}>You're ahead</Text>
                    <Text style={styles.statLabelCard}>Gap</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statValueGold}>{userPower} / {twinPower}</Text>
                    <Text style={styles.statLabelCard}>Power Score</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statValueGold}>{userStreak} / {twinStreak}</Text>
                    <Text style={styles.statLabelCard}>Streak</Text>
                  </View>
                </View>
                <Text style={styles.oracleGold}>
                  You closed the gap. Now don't let it open again.
                </Text>
                <View style={styles.footer}>
                  <Text style={styles.footerLeftGold}>alterego.app</Text>
                  <View style={styles.footerDividerGold} />
                  <Text style={styles.footerRightGold}>{monthYear}</Text>
                </View>
              </LinearGradient>
            )}
          </View>
          <View style={styles.actionsRow}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnLabel}>Close</Text>
            </Pressable>
            <Pressable onPress={handleShare} style={styles.shareBtn} disabled={sharing}>
              {sharing ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color="#FFF" />
                  <Text style={styles.shareBtnLabel}>Share</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    alignItems: "center",
    paddingHorizontal: CARD_PADDING_H,
  },
  cardOuter: {
    borderRadius: 20,
    overflow: "hidden",
  },
  card: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderRadius: 20,
  },
  cardViolet: {
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
  },
  cardGold: {
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brandViolet: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    color: "#A78BFA",
  },
  brandGold: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    color: "rgba(245,158,11,0.9)",
  },
  subtitleDim: {
    fontSize: 9,
    color: "#374151",
  },
  figuresRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 16,
    gap: FIGURE_GAP,
  },
  figureCard: {
    width: FIGURE_W,
    position: "relative",
    alignItems: "center",
  },
  figureFill: {
    width: FIGURE_W,
    borderRadius: 14,
    borderWidth: 1,
  },
  figureUserViolet: {
    borderColor: "rgba(139,92,246,0.2)",
  },
  figureTwinViolet: {
    borderColor: "rgba(139,92,246,0.35)",
  },
  figureUserGold: {
    borderColor: "rgba(245,158,11,0.3)",
  },
  figureTwinGold: {
    borderColor: "rgba(245,158,11,0.15)",
  },
  figureTwinGoldDim: {
    opacity: 0.55,
  },
  petDot: {
    position: "absolute",
    bottom: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  petDotUserViolet: {
    left: 4,
    backgroundColor: "rgba(80,40,140,0.8)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  petDotTwinViolet: {
    right: 4,
    backgroundColor: "rgba(100,60,180,0.9)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.5)",
  },
  petDotUserGold: {
    left: 4,
    backgroundColor: "rgba(200,150,50,0.8)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.5)",
  },
  petDotTwinGold: {
    right: 4,
    backgroundColor: "rgba(100,80,30,0.6)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  fractureViolet: {
    width: 1,
    alignSelf: "stretch",
    marginBottom: 12,
    backgroundColor: "rgba(192,132,252,0.6)",
  },
  fractureGold: {
    width: 1,
    alignSelf: "stretch",
    marginBottom: 12,
    backgroundColor: "rgba(245,158,11,0.5)",
  },
  leadingBadge: {
    position: "absolute",
    top: -8,
    left: 0,
    right: 0,
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    color: "rgba(245,158,11,0.9)",
    textAlign: "center",
    zIndex: 1,
  },
  statsRowCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.10)",
    marginBottom: 10,
  },
  statsRowGold: {
    borderColor: "rgba(245,158,11,0.12)",
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statValueViolet: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#A78BFA",
  },
  statValueGold: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(245,158,11,0.85)",
  },
  statLabelCard: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 2,
  },
  oracleViolet: {
    fontSize: 10.5,
    fontStyle: "italic",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 10,
  },
  oracleGold: {
    fontSize: 10.5,
    fontStyle: "italic",
    color: "rgba(245,158,11,0.6)",
    textAlign: "center",
    marginBottom: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.4)",
    paddingTop: 8,
  },
  footerLeft: {
    fontSize: 9,
    color: "#6B7280",
  },
  footerLeftGold: {
    fontSize: 9,
    color: "rgba(245,158,11,0.5)",
  },
  footerDivider: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
  },
  footerDividerGold: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
    backgroundColor: "rgba(245,158,11,0.15)",
  },
  footerRight: {
    fontSize: 9,
    color: "#6B7280",
  },
  footerRightGold: {
    fontSize: 9,
    color: "rgba(245,158,11,0.4)",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  closeBtnLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#8B5CF6",
    minWidth: 100,
    justifyContent: "center",
  },
  shareBtnLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
});
