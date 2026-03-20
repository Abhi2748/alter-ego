/**
 * Shimmer placeholders for Home mission lists while /missions/today is loading.
 * Mirrors section structure (CORE / INTEREST / RESISTANCE / PERSONAL) so layout feels stable.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonCard } from "@/components/SkeletonCard";

const RED_CORE = "#EF4444";
const RED_DARK = "#991B1B";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const EMBER = "#F97316";
const PERSONAL_GREY = "#4B5563";
const PERSONAL_GREY_DARK = "#1F2937";
const TEXT_MUTED = "#6B7280";

export function HomeMissionSectionsSkeleton() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{"Loading today's missions…"}</Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <LinearGradient colors={[RED_CORE, RED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.sectionBar} />
            <Text style={[styles.sectionTitle, { color: RED_CORE }]}>CORE</Text>
          </View>
          <View style={styles.fractionShimmer} />
        </View>
        <View style={styles.cards}>
          <SkeletonCard leftEdgeColor="#7F1D1D" delay={0} />
          <SkeletonCard leftEdgeColor="#7F1D1D" delay={80} />
          <SkeletonCard leftEdgeColor="#7F1D1D" delay={160} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <LinearGradient colors={[VIOLET, VIOLET_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.sectionBar} />
            <Text style={[styles.sectionTitle, { color: VIOLET }]}>INTEREST</Text>
          </View>
          <View style={styles.fractionShimmer} />
        </View>
        <View style={styles.cards}>
          <SkeletonCard leftEdgeColor="#8B5CF6" delay={200} />
          <SkeletonCard leftEdgeColor="#8B5CF6" delay={280} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionBar, { backgroundColor: EMBER }]} />
            <Text style={[styles.sectionTitle, { color: EMBER, fontSize: 13, fontWeight: "600" }]}>RESISTANCE</Text>
          </View>
          <View style={styles.fractionShimmer} />
        </View>
        <View style={styles.cards}>
          <SkeletonCard leftEdgeColor="#7F1D1D" delay={360} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <LinearGradient colors={[PERSONAL_GREY, PERSONAL_GREY_DARK]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.sectionBar} />
            <Text style={[styles.sectionTitle, { color: TEXT_MUTED }]}>PERSONAL</Text>
          </View>
          <View style={styles.fractionShimmer} />
        </View>
        <View style={styles.cards}>
          <SkeletonCard delay={420} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 9,
    paddingHorizontal: 16,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionBar: {
    width: 3,
    height: 13,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  fractionShimmer: {
    width: 52,
    height: 10,
    borderRadius: 4,
    backgroundColor: "#1E2333",
    opacity: 0.9,
  },
  cards: {
    gap: 7,
  },
});
