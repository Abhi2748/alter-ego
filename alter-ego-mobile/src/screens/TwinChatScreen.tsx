/**
 * Twin Chat Screen — Premium dark cinematic chat. Left-aligned header, atmosphere glow,
 * styled Twin/user bubbles, tone rating row, typing indicator, gradient send button.
 * Spec: §1–§14.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ListRenderItem,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { MainStackParamList } from "../navigation/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTwinChatHistory, useSendTwinMessage, useRateTwinMessage } from "@/hooks/useTwin";
import { twinService } from "@/services/twin";
import { useUserStore } from "@/store/userStore";
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

// -----------------------------------------------------------------------------
// DESIGN TOKENS — Spec §1
// -----------------------------------------------------------------------------
const BG_GRADIENT = ["#08091A", "#06070E"] as const;
const HEADER_BG = "rgba(8,9,26,0.88)";
const TWIN_BUBBLE_BG = "rgba(10,8,22,0.60)";
const TWIN_BUBBLE_BORDER = "rgba(139,92,246,0.35)";
const USER_BUBBLE_BORDER = "rgba(42,48,80,0.40)";
const INPUT_BG = "rgba(255,255,255,0.04)";
const INPUT_BORDER = "rgba(42,48,80,0.50)";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";
const TWIN_TEXT = "#C4B5FD";
const USER_TEXT = "#E5E7EB";

// -----------------------------------------------------------------------------
// TYPES & DATA — Spec §12, §13
// -----------------------------------------------------------------------------
export interface ChatMessage {
  id: string;
  role: "user" | "twin";
  content: string;
  timestamp: string;
  rated?: boolean;
  isProactive?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLocalDateKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateKey: string): string {
  const today = new Date();
  const todayKey = toLocalDateKey(today.toISOString());
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayKey = toLocalDateKey(yesterday.toISOString());
  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  const d = new Date(dateKey + "T12:00:00");
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const day = d.getDate();
  const monthShort = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday}, ${day} ${monthShort}`;
}

type ListItem =
  | { type: "date"; id: string; label: string }
  | { type: "message"; message: ChatMessage };

function buildListData(messages: ChatMessage[]): ListItem[] {
  const out: ListItem[] = [];
  const oldestFirst = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let prevDateKey: string | null = null;
  for (let i = 0; i < oldestFirst.length; i++) {
    const msg = oldestFirst[i];
    const dateKey = toLocalDateKey(msg.timestamp);
    if (prevDateKey !== dateKey) {
      out.push({ type: "date", id: "date-" + dateKey, label: formatDateLabel(dateKey) });
      prevDateKey = dateKey;
    }
    out.push({ type: "message", message: msg });
  }
  return out;
}

// -----------------------------------------------------------------------------
// TYPING DOTS — Spec §9 (scale 0.6→1→0.6, opacity 0.4→1→0.4, 600ms, stagger 150ms)
// -----------------------------------------------------------------------------
function TypingDots() {
  const s1 = useSharedValue(0.6);
  const o1 = useSharedValue(0.4);
  const s2 = useSharedValue(0.6);
  const o2 = useSharedValue(0.4);
  const s3 = useSharedValue(0.6);
  const o3 = useSharedValue(0.4);

  React.useEffect(() => {
    const duration = 300;
    const easing = Easing.inOut(Easing.ease);
    const cycle = (s: SharedValue<number>, o: SharedValue<number>) =>
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing }),
          withTiming(0.6, { duration, easing })
        ),
        -1,
        false
      );
    s1.value = cycle(s1, o1);
    o1.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing }),
        withTiming(0.4, { duration, easing })
      ),
      -1,
      false
    );
    s2.value = withDelay(150, cycle(s2, o2));
    o2.value = withDelay(
      150,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing }),
          withTiming(0.4, { duration, easing })
        ),
        -1,
        false
      )
    );
    s3.value = withDelay(300, cycle(s3, o3));
    o3.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing }),
          withTiming(0.4, { duration, easing })
        ),
        -1,
        false
      )
    );
  }, []);

  const a1 = useAnimatedStyle(() => ({
    transform: [{ scale: s1.value }],
    opacity: o1.value,
  }));
  const a2 = useAnimatedStyle(() => ({
    transform: [{ scale: s2.value }],
    opacity: o2.value,
  }));
  const a3 = useAnimatedStyle(() => ({
    transform: [{ scale: s3.value }],
    opacity: o3.value,
  }));

  return (
    <View style={styles.typingBubbleWrap}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDotsRow}>
          <Animated.View style={[styles.typingDot, a1]} />
          <Animated.View style={[styles.typingDot, a2]} />
          <Animated.View style={[styles.typingDot, a3]} />
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// SCREEN
// -----------------------------------------------------------------------------
export function TwinChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<MainStackParamList, "TwinChat">>();
  const route = useRoute<RouteProp<MainStackParamList, "TwinChat">>();
  const [inputText, setInputText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [ratedMessageIds, setRatedMessageIds] = useState<Record<string, boolean>>({});
  const listRef = useRef<FlatList<ListItem> | null>(null);
  const initialMessageSentRef = useRef(false);

  const profile = useUserStore((state) => state.profile);
  const { data: chatData, isLoading: historyLoading } = useTwinChatHistory(50);
  const { mutate: sendTwinMessage, isPending: isSending } = useSendTwinMessage();
  const { mutate: rateTwinMessageMutate } = useRateTwinMessage();

  const messages: ChatMessage[] = useMemo(() => {
    const raw = chatData?.messages ?? [];
    return raw.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      rated:
        Boolean(m.tone_rating) ||
        Boolean(ratedMessageIds[m.id]),
    }));
  }, [chatData?.messages, ratedMessageIds]);

  const listData = useMemo(() => buildListData(messages), [messages]);
  const listDataReversed = useMemo(() => [...listData].reverse(), [listData]);
  const handleClose = () => navigation.goBack();

  // No Reanimated — immediate state update to avoid iOS crash when rating
  const rateTone = useCallback(
    (messageId: string, rating: "positive" | "neutral" | "negative") => {
      setRatedMessageIds((prev) => ({ ...prev, [messageId]: true }));
      const numeric: -1 | 0 | 1 =
        rating === "positive" ? 1 : rating === "negative" ? -1 : 0;
      rateTwinMessageMutate(
        { messageId, rating: numeric },
        {
          onError: () => {
            setRatedMessageIds((prev) => {
              const next = { ...prev };
              delete next[messageId];
              return next;
            });
          },
        }
      );
    },
    [rateTwinMessageMutate]
  );

  const sendMessage = useCallback(
    (overrideText?: string) => {
      const raw = overrideText !== undefined ? overrideText : inputText;
      const text = (typeof raw === "string" ? raw : "").trim();
      if (!text) return;
      if (isSending) return;

      if (overrideText === undefined) {
        setInputText("");
      }

      sendTwinMessage(text, {
        onError: () => {
          if (overrideText === undefined) {
            setInputText(text);
          }
        },
      });
    },
    [inputText, isSending, sendTwinMessage]
  );

  useEffect(() => {
    const initialMessage = route.params?.initialMessage;
    if (!initialMessage || initialMessageSentRef.current) return;
    initialMessageSentRef.current = true;
    navigation.setParams({ initialMessage: undefined });
    setTimeout(() => sendMessage(initialMessage), 0);
  }, [route.params?.initialMessage, navigation, sendMessage]);

  useEffect(() => {
    if (messages.length <= 0) return;
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages.length]);

  const getMarginTop = useCallback(
    (index: number) => {
      const item = listData[index];
      if (item.type !== "message") return 0;
      const prev = index > 0 ? listData[index - 1] : null;
      if (!prev || prev.type === "date") return 12;
      if (prev.type === "message") {
        if (prev.message.role !== item.message.role) return 12;
        return 3;
      }
      return 12;
    },
    [listData]
  );

  // For inverted FlatList: reversed index -> logical index in listData (oldest-first)
  const getMarginTopReversed = useCallback(
    (reversedIndex: number) => getMarginTop(listData.length - 1 - reversedIndex),
    [listData.length, getMarginTop]
  );

  const renderItem: ListRenderItem<ListItem> = useCallback(
    ({ item, index }) => {
      if (item.type === "date") {
        return (
          <View style={styles.dateSep}>
            <View style={styles.dateLine} />
            <Text style={styles.dateLabel}>{item.label}</Text>
            <View style={styles.dateLine} />
          </View>
        );
      }
      const msg = item.message;
      const marginTop = getMarginTopReversed(index);

      if (msg.role === "user") {
        return (
          <View style={[styles.userBubbleWrap, { marginTop }]}>
            <LinearGradient
              colors={["rgba(26,28,68,0.95)", "rgba(18,20,52,0.98)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userBubble}
            >
              <Text style={styles.userBubbleText}>{msg.content}</Text>
              <Text style={styles.timestampRight}>{formatTime(msg.timestamp)}</Text>
            </LinearGradient>
          </View>
        );
      }

      const showToneRow = !msg.rated;
      const proactive = msg.isProactive;
      return (
        <View style={[styles.twinBubbleWrap, { marginTop }]}>
          <View
            style={[
              styles.twinBubble,
              proactive && { borderColor: "rgba(192,132,252,0.45)", borderWidth: 1 },
            ]}
          >
            {proactive ? (
              <Text style={styles.proactiveLabel} accessibilityLabel="Unprompted message">
                Unprompted
              </Text>
            ) : null}
            <View style={styles.twinBubbleAccentLine}>
              <LinearGradient
                colors={["transparent", "rgba(139,92,246,0.50)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={styles.twinBubbleTopGlow} />
            <Text style={styles.twinBubbleText}>{msg.content}</Text>
            <Text style={styles.timestampLeft}>{formatTime(msg.timestamp)}</Text>
          </View>
          {showToneRow && (
            <View style={styles.toneRow}>
              <TouchableOpacity
                onPress={() => rateTone(msg.id, "positive")}
                style={styles.toneBtn}
                activeOpacity={0.6}
              >
                <Ionicons name="thumbs-up-outline" size={14} color={MUTED} />
              </TouchableOpacity>
              <View style={styles.toneSep} />
              <TouchableOpacity
                onPress={() => rateTone(msg.id, "neutral")}
                style={styles.toneBtn}
                activeOpacity={0.6}
              >
                <Text style={styles.toneBtnDash}>—</Text>
              </TouchableOpacity>
              <View style={styles.toneSep} />
              <TouchableOpacity
                onPress={() => rateTone(msg.id, "negative")}
                style={styles.toneBtn}
                activeOpacity={0.6}
              >
                <Ionicons name="thumbs-down-outline" size={14} color={MUTED} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [getMarginTopReversed, rateTone]
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.type === "date") return item.id;
    return item.message.id;
  }, []);

  // KeyboardAvoidingView is the ROOT — nothing wraps it
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: "#08091A" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      //keyboardVerticalOffset={HEADER_HEIGHT}
      keyboardVerticalOffset={0}
    >
      {/* Background + atmosphere (absolute, do not affect layout) */}
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={styles.atmosphere} pointerEvents="none" />
      <LinearGradient
        colors={["rgba(80,20,160,0.18)", "transparent"]}
        style={styles.atmosphereGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header inside KeyboardAvoidingView */}
      <View
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        {Platform.OS === "ios" ? <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={16} color={MUTED} />
          </Pressable>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={["rgba(110,40,210,0.70)", "rgba(20,15,50,0.95)"]}
              start={{ x: 0.2, y: 0.2 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarCircle}
            />
            <View style={styles.petDot}>
              <LinearGradient
                colors={["rgba(100,40,200,0.80)", "rgba(20,15,50,0.95)"]}
                start={{ x: 0.2, y: 0.2 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>
          <View style={styles.nameColumn}>
            <Text style={styles.headerName}>Shadow Twin</Text>
            <Text style={styles.headerStage}>
              {profile?.character_stage_name ?? "—"} · {profile?.pet_name ?? "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* FlatList takes all remaining flex space; inverted so newest at bottom */}
      <FlatList
        ref={listRef}
        data={listDataReversed}
        inverted
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          isSending ? (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <TypingDots />
            </Animated.View>
          ) : null
        }
        ListEmptyComponent={
          historyLoading ? (
            <View style={{ paddingVertical: 24 }}>
              <Text style={styles.emptyText}>Loading…</Text>
            </View>
          ) : (
            <View style={{ paddingVertical: 24 }}>
              <Text style={styles.emptyText}>
                Your Twin is watching. Say something.
              </Text>
            </View>
          )
        }
      />

      {/* Input bar — apply safe area here only when keyboard is closed */}
      <View
        style={[
          styles.inputBarOuter,
          { paddingBottom: inputFocused ? 0 : insets.bottom }
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.inputBarInner}>
          <TextInput
            style={[
              styles.input,
              inputFocused ? styles.inputBorderFocused : styles.inputBorder,
            ]}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => {
              setInputFocused(true);
              setTimeout(() => {
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }, 100);
            }}
            onBlur={() => setInputFocused(false)}
            placeholder="Say something..."
            placeholderTextColor="#4B5563"
            multiline={false}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
            blurOnSubmit={false}
          />
          {inputText.length >= 400 ? (
            <Text style={styles.charCount}>{inputText.length}/500</Text>
          ) : null}
          {inputFocused && (
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.keyboardDismissBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-down" size={20} color={MUTED} />
            </TouchableOpacity>
          )}
          <Pressable
            onPress={() => sendMessage()}
            disabled={!(inputText ?? "").trim() || isSending}
            style={({ pressed }) => [
              styles.sendBtnWrap,
              (!(inputText ?? "").trim() || isSending) && styles.sendBtnDisabled,
              pressed && styles.sendBtnPressed,
            ]}
          >
            {(inputText ?? "").trim() ? (
              <LinearGradient
                colors={[VIOLET_DEEP, VIOLET]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnGradient}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" style={{ transform: [{ rotate: "-45deg" }] }} />
              </LinearGradient>
            ) : (
              <View style={styles.sendBtnDisabledInner}>
                <Ionicons name="send" size={16} color={DIM} style={{ transform: [{ rotate: "-45deg" }] }} />
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  atmosphere: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 0,
  },
  atmosphereGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 0,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.40)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 2,
    position: "relative",
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    marginLeft: 12,
    position: "relative",
    flexShrink: 0,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.45)",
    shadowColor: "rgba(109,40,217,0.35)",
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  petDot: {
    position: "absolute",
    bottom: -2,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#08091A",
    overflow: "hidden",
  },
  nameColumn: { marginLeft: 10, flex: 1 },
  headerName: { fontSize: 14, fontWeight: "700", color: USER_TEXT },
  headerStage: { fontSize: 10, color: MUTED, marginTop: 1 },
  emptyText: { fontSize: 12, color: MUTED, textAlign: "center" },

  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: 16, paddingVertical: 16 },

  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 8,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: "rgba(42,48,80,0.30)" },
  dateLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2D3146",
  },

  twinBubbleWrap: { alignItems: "flex-start", flexDirection: "column", marginBottom: 0 },
  twinBubble: {
    maxWidth: 280,
    backgroundColor: TWIN_BUBBLE_BG,
    borderWidth: 1,
    borderColor: TWIN_BUBBLE_BORDER,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    position: "relative",
    overflow: "hidden",
    shadowColor: "rgba(109,40,217,0.10)",
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  proactiveLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.4,
    color: MUTED,
    marginBottom: 6,
  },
  twinBubbleAccentLine: {
    position: "absolute",
    left: 0,
    top: 4,
    bottom: 4,
    width: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  twinBubbleTopGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  twinBubbleText: {
    fontSize: 14,
    fontWeight: "400",
    color: TWIN_TEXT,
    fontStyle: "italic",
    lineHeight: 21.7,
    letterSpacing: 0.1,
  },
  timestampLeft: { fontSize: 10, color: "#374151", marginTop: 5, textAlign: "right" },

  toneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 5,
    marginLeft: 2,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
  },
  toneBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toneBtnPressed: { backgroundColor: "rgba(139,92,246,0.10)" },
  toneBtnDash: { fontSize: 12, color: "#4B5563" },
  toneSep: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(42,48,80,0.40)",
    marginHorizontal: 2,
  },

  userBubbleWrap: { alignItems: "flex-end", flexDirection: "column", marginBottom: 0 },
  userBubble: {
    maxWidth: 280,
    borderWidth: 1,
    borderColor: USER_BUBBLE_BORDER,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    shadowColor: "rgba(0,0,0,0.30)",
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  userBubbleText: {
    fontSize: 14,
    fontWeight: "400",
    color: USER_TEXT,
    lineHeight: 21.7,
  },
  timestampRight: { fontSize: 10, color: "#374151", marginTop: 5, textAlign: "right" },

  typingBubbleWrap: { alignItems: "flex-start", marginTop: 12, marginBottom: 8 },
  typingBubble: {
    maxWidth: 80,
    backgroundColor: TWIN_BUBBLE_BG,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.28)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typingDotsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: VIOLET,
  },

  keyboardDismissBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  inputBarOuter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.30)",
    backgroundColor: "rgba(8,9,26,0.92)",
    position: "relative",
  },
  inputBarInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 16,
    fontSize: 14,
    color: USER_TEXT,
  },
  charCount: {
    position: "absolute",
    right: 76,
    bottom: 18,
    fontSize: 10,
    color: DIM,
  },
  inputBorder: { borderColor: INPUT_BORDER },
  inputBorderFocused: { borderColor: "rgba(139,92,246,0.35)" },
  sendBtnWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: VIOLET, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16 }
      : { elevation: 10 }),
  },
  sendBtnGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.20)",
    borderRadius: 20,
  },
  sendBtnPressed: { opacity: 0.93, transform: [{ scale: 0.97 }] },
  sendBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnDisabledInner: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
});
