/**
 * In-app inbox — premium layout aligned with ALTER EGO tokens.
 * GET /api/v1/mail, mark read on open, mark all read from header.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  type ListRenderItem,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { mailService, type AppMail } from "@/services/mail";
import { useUserStore } from "@/store/userStore";
import { getErrorMessage } from "@/services/api";
import { COLORS, GRADIENTS, RADIUS, SPACING, SHADOWS, FONTS } from "@/constants/theme";
import type { MainStackParamList } from "@/navigation/types";
import { formatSentAt, TypeChip } from "@/components/mail/MailMessagePresentation";

export function MailInboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<MainStackParamList, "MailInbox">>();
  const fetchProfile = useUserStore((s) => s.fetchProfile);
  const [mails, setMails] = useState<AppMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await mailService.list();
      setMails(res.mails ?? []);
      void fetchProfile();
    } catch (e) {
      setError(getErrorMessage(e));
      setMails([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const unreadCount = useMemo(() => mails.filter((m) => !m.read_at).length, [mails]);

  const openMail = useCallback(
    (m: AppMail) => {
      navigation.navigate("MailDetail", { mail: m });
    },
    [navigation]
  );

  const renderMailItem = useCallback<ListRenderItem<AppMail>>(
    ({ item, index }) => <MailInboxRow item={item} index={index} onOpen={openMail} />,
    [openMail]
  );

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await mailService.markAllRead();
      setMails((prev) =>
        prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() }))
      );
      void fetchProfile();
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  };

  const emptyState = (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={["rgba(139,92,246,0.15)", "rgba(20,24,36,0.3)"]}
        style={styles.emptyIconRing}
      >
        <Ionicons name="mail-open-outline" size={40} color={COLORS.violet} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>{"You're all caught up"}</Text>
      <Text style={styles.emptySub}>
        {"When there's something worth your attention — a welcome, a win, or a gentle nudge — it will land here."}
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={GRADIENTS.background.colors}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerIconBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={COLORS.muted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Inbox</Text>
            {!loading && mails.length > 0 ? (
              <Text style={styles.headerMeta}>
                {mails.length} {mails.length === 1 ? "message" : "messages"}
                {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
              </Text>
            ) : null}
          </View>
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => void handleMarkAllRead()}
              disabled={markingAll}
              style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.85 }]}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color={COLORS.violetGlow} />
              ) : (
                <Text style={styles.markAllText}>Mark all read</Text>
              )}
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.violet} size="large" />
          <Text style={styles.loadingLabel}>Opening your letters…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.surface2} style={{ marginBottom: 12 }} />
          <Text style={styles.err}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <LinearGradient
              colors={[...GRADIENTS.button.colors]}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.retryGrad}
            >
              <Text style={styles.retryTxt}>Try again</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={mails}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={COLORS.violet}
            />
          }
          contentContainerStyle={{
            paddingBottom: insets.bottom + SPACING.xxxl,
            paddingHorizontal: SPACING.screenPadding,
            paddingTop: SPACING.sm,
            flexGrow: 1,
          }}
          ListEmptyComponent={emptyState}
          renderItem={renderMailItem}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg0 },
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
  headerMeta: {
    fontSize: FONTS.micro.size,
    fontFamily: "Inter_500Medium",
    color: COLORS.muted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  markAllBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  markAllText: {
    fontSize: FONTS.label.size,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.violetGlow,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.lg },
  loadingLabel: {
    marginTop: SPACING.md,
    fontSize: FONTS.bodySm.size,
    color: COLORS.text2,
    fontFamily: "Inter_400Regular",
  },
  err: {
    color: COLORS.text2,
    textAlign: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
    fontSize: FONTS.bodySm.size,
  },
  retry: { borderRadius: RADIUS.card, overflow: "hidden", ...SHADOWS.button },
  retryGrad: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.card,
  },
  retryTxt: { color: "#F3F4F6", fontFamily: "Inter_600SemiBold", fontSize: FONTS.bodyMd.size },

  heroWrap: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.md,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  heroFracture: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 1,
    backgroundColor: "rgba(192,132,252,0.35)",
  },
  heroKicker: {
    fontSize: FONTS.micro.size,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: COLORS.muted,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: FONTS.h2.size,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    letterSpacing: -0.4,
    marginBottom: SPACING.sm,
  },
  heroSub: {
    fontSize: FONTS.bodySm.size,
    fontFamily: "Inter_400Regular",
    color: COLORS.text2,
    lineHeight: 21,
  },

  infoCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    overflow: "hidden",
    padding: SPACING.cardPadding,
  },
  infoCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  infoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    fontSize: FONTS.bodyMd.size,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  infoHint: {
    fontSize: FONTS.micro.size,
    color: COLORS.muted,
    marginTop: 2,
  },
  infoBullets: { marginTop: SPACING.md, gap: SPACING.sm },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.violet,
    marginTop: 7,
    opacity: 0.85,
  },
  bulletText: {
    flex: 1,
    fontSize: FONTS.bodySm.size,
    color: COLORS.text2,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },

  mailCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  mailCardUnread: {
    borderColor: "rgba(139,92,246,0.35)",
    ...Platform.select({
      ios: SHADOWS.violet,
      android: {
        // Android elevation creates a grey drop shadow that looks wrong
        // on dark backgrounds — use a stronger border instead of shadow
        elevation: 0,
        borderColor: "rgba(139,92,246,0.55)",
        borderWidth: 1.5,
      },
    }),
  },
  mailCardPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  mailCardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(42,48,80,0.5)",
  },
  mailCardAccentUnread: {
    backgroundColor: "rgba(192,132,252,0.45)",
  },
  mailCardInner: { padding: SPACING.cardPadding },
  mailCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.violet,
  },
  readSpacer: { width: 8 },
  mailDate: {
    marginLeft: "auto",
    fontSize: FONTS.micro.size,
    color: COLORS.muted,
    fontFamily: "Inter_500Medium",
  },
  mailSubject: {
    fontSize: FONTS.bodyMd.size,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text2,
    lineHeight: 22,
    marginBottom: SPACING.xs,
  },
  mailSubjectUnread: {
    color: COLORS.text,
  },
  mailPreview: {
    fontSize: FONTS.bodySm.size,
    color: COLORS.muted,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  mailCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: SPACING.md,
  },
  tapToRead: {
    fontSize: FONTS.label.size,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.violet,
    letterSpacing: 0.2,
  },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: SPACING.xxxl + SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  emptyTitle: {
    fontSize: FONTS.h3.size,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  emptySub: {
    fontSize: FONTS.bodySm.size,
    color: COLORS.text2,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
    fontFamily: "Inter_400Regular",
  },
});

const MailInboxRow = React.memo(function MailInboxRow({
  item,
  index,
  onOpen,
}: {
  item: AppMail;
  index: number;
  onOpen: (m: AppMail) => void;
}) {
  const unread = !item.read_at;
  const rawBody = item.body_markdown ?? "";
  const preview =
    rawBody.replace(/\*\*/g, "").replace(/\n/g, " ").trim().slice(0, 120) +
    (rawBody.length > 120 ? "…" : "");

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.mailCard,
        unread && styles.mailCardUnread,
        pressed && styles.mailCardPressed,
        { marginTop: index === 0 ? 0 : SPACING.cardGap },
      ]}
    >
      <LinearGradient
        colors={
          unread
            ? ["rgba(139,92,246,0.14)", "rgba(20,24,36,0.95)"]
            : ["rgba(30,35,51,0.5)", "rgba(20,24,36,0.92)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.mailCardAccent, unread && styles.mailCardAccentUnread]} />
      <View style={styles.mailCardInner}>
        <View style={styles.mailCardTop}>
          {unread ? <View style={styles.unreadDot} /> : <View style={styles.readSpacer} />}
          <TypeChip type={item.mail_type} />
          <Text style={styles.mailDate}>{formatSentAt(item.sent_at)}</Text>
        </View>
        <Text style={[styles.mailSubject, unread && styles.mailSubjectUnread]} numberOfLines={2}>
          {item.subject}
        </Text>
        <Text style={styles.mailPreview} numberOfLines={2}>
          {preview}
        </Text>
        <View style={styles.mailCardFooter}>
          <Text style={styles.tapToRead}>Read</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.violet} />
        </View>
      </View>
    </Pressable>
  );
});
