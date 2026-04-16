/**
 * Full-screen in-app mail message (opened from Mail inbox).
 */

import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { MainStackParamList } from "@/navigation/types";
import { mailService } from "@/services/mail";
import { useUserStore } from "@/store/userStore";
import { COLORS, GRADIENTS, RADIUS, SPACING, SHADOWS, FONTS } from "@/constants/theme";
import {
  formatSentAt,
  MailBodyText,
  TypeChip,
} from "@/components/mail/MailMessagePresentation";

export function MailDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "MailDetail">>();
  const mail = route.params.mail;
  const fetchProfile = useUserStore((s) => s.fetchProfile);

  useEffect(() => {
    if (mail.read_at) return;
    let cancelled = false;
    void (async () => {
      try {
        await mailService.markRead(mail.id);
        if (!cancelled) void fetchProfile();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mail.id, mail.read_at, fetchProfile]);

  const onDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerIconBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={COLORS.muted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Message</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: SPACING.screenPadding,
          paddingTop: SPACING.md,
          paddingBottom: Math.max(insets.bottom, 16) + SPACING.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <TypeChip type={mail.mail_type} />
          <Text style={styles.date}>{formatSentAt(mail.sent_at)}</Text>
        </View>
        <Text style={styles.title}>{mail.subject}</Text>
        <View style={styles.divider} />
        <MailBodyText body={mail.body_markdown ?? ""} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16) + SPACING.sm,
            paddingHorizontal: SPACING.screenPadding,
          },
        ]}
      >
        <Pressable onPress={onDone} style={styles.doneBtnWrap}>
          <LinearGradient
            colors={[...GRADIENTS.button.colors]}
            start={GRADIENTS.button.start}
            end={GRADIENTS.button.end}
            style={styles.doneBtnGrad}
          >
            <Text style={styles.doneTxt}>Done</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    overflow: "hidden",
    backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(9,9,26,0.92)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: FONTS.h3.size,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  scroll: { flex: 1 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  date: {
    fontSize: FONTS.label.size,
    color: COLORS.muted,
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: FONTS.h3.size,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(42,48,80,0.6)",
    marginBottom: SPACING.md,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.35)",
    backgroundColor: COLORS.bg0,
    paddingTop: SPACING.md,
  },
  doneBtnWrap: {
    borderRadius: RADIUS.card,
    overflow: "hidden",
    ...SHADOWS.button,
  },
  doneBtnGrad: {
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.card,
  },
  doneTxt: {
    color: "#F3F4F6",
    fontFamily: "Inter_600SemiBold",
    fontSize: FONTS.bodyMd.size,
  },
});
