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
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { mailService, type AppMail } from "@/services/mail";
import { useUserStore } from "@/store/userStore";
import { getErrorMessage } from "@/services/api";
import { COLORS, GRADIENTS, RADIUS, SPACING, SHADOWS, FONTS } from "@/constants/theme";
import { IS_CLOSED_BETA } from "@/constants/closedBeta";

function formatMailType(raw: string): string {
  const t = raw.toLowerCase().replace(/_/g, " ").trim();
  if (!t) return "Message";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSentAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Split markdown-ish body into paragraphs; inline **bold**. */
function MailBodyText({ body }: { body: string }) {
  const paragraphs = body.replace(/\r/g, "").split(/\n\n+/);
  return (
    <View style={{ gap: SPACING.md }}>
      {paragraphs.map((para, pi) => {
        if (!para.trim()) return null;
        const lines = para.split("\n");
        return (
          <View key={pi} style={{ gap: SPACING.xs }}>
            {lines.map((line, li) => (
              <Text key={li} style={styles.sheetBodyLine}>
                {renderInlineBold(line)}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function renderInlineBold(line: string): React.ReactNode {
  const parts = line.split(/\*\*/);
  if (parts.length === 1) return line;
  return parts.map((segment, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={styles.sheetBodyBold}>
        {segment}
      </Text>
    ) : (
      <Text key={i}>{segment}</Text>
    )
  );
}

function TypeChip({ type }: { type: string }) {
  return (
    <View style={styles.typeChip}>
      <Text style={styles.typeChipText}>{formatMailType(type)}</Text>
    </View>
  );
}

export function MailInboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const fetchProfile = useUserStore((s) => s.fetchProfile);
  const [mails, setMails] = useState<AppMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppMail | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(true);

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

  const openMail = async (m: AppMail) => {
    setSelected(m);
    if (!m.read_at) {
      try {
        await mailService.markRead(m.id);
        setMails((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x))
        );
        void fetchProfile();
      } catch {
        /* ignore */
      }
    }
  };

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

  const listHeader = (
    <View style={{ marginBottom: SPACING.lg }}>
      {/* Hero */}
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["rgba(109,40,217,0.18)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroFracture} />
        <Text style={styles.heroKicker}>ALTER EGO</Text>
        <Text style={styles.heroTitle}>Inbox</Text>
        <Text style={styles.heroSub}>
          Letters from your journey — welcome notes, milestones, and in-app updates. Everything here stays inside the
          app; we do not sell your data.
        </Text>
      </View>

      {/* How it works — collapsible */}
      <Pressable
        onPress={() => setInfoExpanded(!infoExpanded)}
        style={({ pressed }) => [styles.infoCard, pressed && { opacity: 0.92 }]}
      >
        <LinearGradient
          colors={["rgba(139,92,246,0.12)", "rgba(20,24,36,0.4)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.infoCardTop}>
          <View style={styles.infoIconCircle}>
            <Ionicons name="information-circle-outline" size={22} color={COLORS.violetGlow} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>How your inbox works</Text>
            <Text style={styles.infoHint}>{infoExpanded ? "Tap to collapse" : "Tap to expand"}</Text>
          </View>
          <Ionicons
            name={infoExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.muted}
          />
        </View>
        {infoExpanded ? (
          <View style={styles.infoBullets}>
            <Bullet text="Welcome and tips from the team when you join or hit key moments." />
            <Bullet text="Your Twin and systems may surface nudges and milestones here — always pride-first, never guilt." />
            <Bullet text="Tap a message to read in full; unread items glow violet until you open them." />
            {IS_CLOSED_BETA ? (
              <Bullet text="Closed beta: you may see test mail as we tune delivery — thank you for bearing with us." />
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );

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
          ListHeaderComponent={listHeader}
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
          renderItem={({ item, index }) => {
            const unread = !item.read_at;
            return (
              <Pressable
                onPress={() => openMail(item)}
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
                    {(item.body_markdown ?? "").replace(/\*\*/g, "").replace(/\n/g, " ").trim().slice(0, 120)}
                    {(item.body_markdown?.length ?? 0) > 120 ? "…" : ""}
                  </Text>
                  <View style={styles.mailCardFooter}>
                    <Text style={styles.tapToRead}>Read</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.violet} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={selected != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + SPACING.md }]}>
            <View style={styles.sheetGrab}>
              <View style={styles.sheetGrabBar} />
            </View>
            {selected ? (
              <>
                <ScrollView
                  style={{ maxHeight: 420 }}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={{ paddingBottom: SPACING.lg }}
                >
                  <View style={styles.sheetMetaRow}>
                    <TypeChip type={selected.mail_type} />
                    <Text style={styles.sheetDate}>{formatSentAt(selected.sent_at)}</Text>
                  </View>
                  <Text style={styles.sheetTitle}>{selected.subject}</Text>
                  <View style={styles.sheetDivider} />
                  <MailBodyText body={selected.body_markdown ?? ""} />
                </ScrollView>
                <Pressable onPress={() => setSelected(null)} style={styles.doneBtnWrap}>
                  <LinearGradient
                    colors={[...GRADIENTS.button.colors]}
                    start={GRADIENTS.button.start}
                    end={GRADIENTS.button.end}
                    style={styles.doneBtnGrad}
                  >
                    <Text style={styles.doneTxt}>Done</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
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
    ...SHADOWS.violet,
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
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(109,40,217,0.25)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  typeChipText: {
    fontSize: FONTS.micro.size,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    color: COLORS.violetGlow,
    textTransform: "uppercase",
  },
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

  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.cardPadding,
    paddingTop: SPACING.sm,
    maxHeight: "88%",
  },
  sheetGrab: { alignItems: "center", paddingVertical: SPACING.sm },
  sheetGrabBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface2,
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  sheetDate: {
    fontSize: FONTS.label.size,
    color: COLORS.muted,
    fontFamily: "Inter_500Medium",
  },
  sheetTitle: {
    fontSize: FONTS.h3.size,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: SPACING.sm,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "rgba(42,48,80,0.6)",
    marginBottom: SPACING.md,
  },
  sheetBodyLine: {
    fontSize: FONTS.bodyMd.size,
    color: COLORS.text2,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  sheetBodyBold: {
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
  doneBtnWrap: {
    marginTop: SPACING.md,
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
