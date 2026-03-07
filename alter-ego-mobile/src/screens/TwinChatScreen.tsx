/**
 * Twin Chat Screen — Screen 18. Full-screen chat with Twin. Custom header, inverted message list, input bar, tone rating.
 */

import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
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
import { COLORS, SPACING, RADIUS } from "../constants/theme";

const HEADER_HEIGHT = 64;
const HEADER_BG = "rgba(20,24,36,0.9)";
const HEADER_BORDER = "#1E2333";
const TWIN_THUMB_SIZE = 36;
const BUBBLE_MAX_WIDTH = 280;
const INPUT_HEIGHT = 44;
const INPUT_RADIUS = 22;
const SEND_SIZE = 44;
const TONE_BUTTON_SIZE = 32;
const TYPING_DOT_SIZE = 8;
const CANNED_RESPONSE_DELAY_MS = 1200;

export type ChatMessage = {
  id: string;
  role: "user" | "twin";
  content: string;
  timestamp: number;
  twinRated?: boolean;
};

const PLACEHOLDER_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "twin",
    content: "Seven days. That's the gap. I've been watching your hesitation.",
    timestamp: Date.now() - 60000,
  },
  {
    id: "2",
    role: "user",
    content: "I'm going to close it.",
    timestamp: Date.now() - 45000,
  },
  {
    id: "3",
    role: "twin",
    content: "Everyone says that. Show me.",
    timestamp: Date.now() - 30000,
  },
];

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TwinChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<ChatMessage[]>(PLACEHOLDER_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const headerHeight = insets.top + HEADER_HEIGHT;
  const inputBarPaddingBottom = SPACING.md + insets.bottom;

  const handleClose = () => navigation.goBack();

  const rateTone = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.role === "twin" ? { ...m, twinRated: true } : m))
    );
    // Phase 2: send rating to backend
  }, []);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    setInputText("");
    Keyboard.dismiss();

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [userMsg, ...prev]);
    setIsTyping(true);

    // Phase 1: canned response after delay. Phase 2: LLM with scope enforcement.
    setTimeout(() => {
      const canned =
        "That won't make you stronger."; // Scope: off-topic gets this. In-scope could vary.
      const twinMsg: ChatMessage = {
        id: `twin-${Date.now()}`,
        role: "twin",
        content: canned,
        timestamp: Date.now(),
      };
      setMessages((prev) => [twinMsg, ...prev]);
      setIsTyping(false);
    }, CANNED_RESPONSE_DELAY_MS);
  }, [inputText]);

  const renderItem: ListRenderItem<ChatMessage> = useCallback(
    ({ item }) =>
      item.role === "user" ? (
        <View style={styles.userBubbleWrap}>
          <View style={styles.userBubble}>
            <Text style={styles.bubbleText}>{item.content}</Text>
            <Text style={styles.timestampRight}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.twinBubbleWrap}>
          <View
            style={[
              styles.twinBubble,
              Platform.OS === "ios" ? styles.twinBubbleShadow : null,
            ]}
          >
            <Text style={styles.twinBubbleText}>{item.content}</Text>
            <Text style={styles.timestampLeft}>{formatTime(item.timestamp)}</Text>
          </View>
          {!item.twinRated ? (
            <View style={styles.toneRow}>
              <Pressable
                onPress={() => rateTone(item.id)}
                style={styles.toneBtn}
                hitSlop={4}
              >
                <Ionicons name="thumbs-up-outline" size={18} color={COLORS.muted} />
              </Pressable>
              <Pressable
                onPress={() => rateTone(item.id)}
                style={styles.toneBtn}
                hitSlop={4}
              >
                <Ionicons name="remove-outline" size={18} color={COLORS.muted} />
              </Pressable>
              <Pressable
                onPress={() => rateTone(item.id)}
                style={styles.toneBtn}
                hitSlop={4}
              >
                <Ionicons name="thumbs-down-outline" size={18} color={COLORS.muted} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ),
    [rateTone]
  );

  const listContentStyle = {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}>
        <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.twinThumb} />
          <View style={styles.headerLabels}>
            <Text style={styles.headerName}>Shadow Twin</Text>
            <Text style={styles.headerStage}>The Focused</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.listWrap} onPress={Keyboard.dismiss}>
        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={listContentStyle}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            isTyping ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={styles.typingWrap}
              >
                <TypingDots />
              </Animated.View>
            ) : null
          }
        />
      </Pressable>

      <View style={[styles.inputBar, { paddingBottom: inputBarPaddingBottom }]}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Say something..."
          placeholderTextColor={COLORS.muted}
          multiline={false}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <Pressable
          onPress={sendMessage}
          disabled={!inputText.trim()}
          style={[
            styles.sendBtn,
            !inputText.trim() && styles.sendBtnDisabled,
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() ? "#FFFFFF" : COLORS.muted}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function TypingDots() {
  const d1 = useSharedValue(0.6);
  const d2 = useSharedValue(0.6);
  const d3 = useSharedValue(0.6);

  React.useEffect(() => {
    const delay = 150;
    d1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    d2.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    d3.value = withDelay(
      delay * 2,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const a1 = useAnimatedStyle(() => ({ transform: [{ scale: d1.value }] }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ scale: d2.value }] }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ scale: d3.value }] }));

  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingDotsRow}>
        <Animated.View style={[styles.typingDot, a1]} />
        <Animated.View style={[styles.typingDot, a2]} />
        <Animated.View style={[styles.typingDot, a3]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm,
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: HEADER_BORDER,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-start",
    marginLeft: SPACING.sm,
  },
  twinThumb: {
    width: TWIN_THUMB_SIZE,
    height: TWIN_THUMB_SIZE,
    borderRadius: TWIN_THUMB_SIZE / 2,
    backgroundColor: COLORS.violetDeep,
  },
  headerLabels: {
    marginLeft: SPACING.sm,
  },
  headerName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  headerStage: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  userBubbleWrap: {
    alignSelf: "flex-end",
    maxWidth: BUBBLE_MAX_WIDTH,
    marginBottom: SPACING.sm,
  },
  userBubble: {
    backgroundColor: "#1A2040",
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: BUBBLE_MAX_WIDTH,
  },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.text,
  },
  timestampRight: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  twinBubbleWrap: {
    alignSelf: "flex-start",
    maxWidth: BUBBLE_MAX_WIDTH,
    marginBottom: SPACING.sm,
  },
  twinBubble: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.violet,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: RADIUS.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: BUBBLE_MAX_WIDTH,
  },
  twinBubbleShadow: {
    shadowColor: COLORS.violet,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
    elevation: 4,
  },
  twinBubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    fontStyle: "italic",
    color: COLORS.text,
  },
  timestampLeft: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
  toneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: SPACING.sm,
  },
  toneBtn: {
    width: TONE_BUTTON_SIZE,
    height: TONE_BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  typingWrap: {
    alignSelf: "flex-start",
    marginBottom: SPACING.sm,
  },
  typingBubble: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.violet,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: RADIUS.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  typingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typingDot: {
    width: TYPING_DOT_SIZE,
    height: TYPING_DOT_SIZE,
    borderRadius: TYPING_DOT_SIZE / 2,
    backgroundColor: COLORS.violet,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: "rgba(20,24,36,0.95)",
    borderTopWidth: 1,
    borderTopColor: HEADER_BORDER,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: INPUT_HEIGHT,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.text,
  },
  sendBtn: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    backgroundColor: COLORS.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.surface2,
  },
});
