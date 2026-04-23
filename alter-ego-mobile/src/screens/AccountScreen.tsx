/**
 * Settings → Account. Signed-in method; connect Google or email (Apple: coming soon).
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "@/utils/supabase";
import { linkGoogleAccount } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";
import { evaluatePasswordStrength, isValidEmailFormat } from "@/utils/accountValidation";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE = "#111623";
const BORDER = "#1A1F30";
const GROUP_BORDER = "rgba(42,48,80,0.40)";
const VIOLET = "#8B5CF6";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

function AppleIcon() {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20">
      <Path
        d="M13.7 10.6c0-2.8 2.3-4.1 2.4-4.2-1.3-1.9-3.3-2.2-4-2.2-1.7-.2-3.3 1-4.2 1-.9 0-2.2-1-3.6-.9-1.9 0-3.6 1.1-4.5 2.7-1.9 3.3-.5 8.2 1.4 10.8.9 1.3 2 2.8 3.5 2.7 1.4-.1 1.9-.9 3.6-.9s2.1.9 3.6.8c1.5 0 2.5-1.3 3.4-2.6.7-1 1.2-2 1.5-3.1-3-.1-3.7-2.1-3.1-4.1Z"
        fill="#000000"
      />
      <Path
        d="M11.6 2.7c.8-1 1.3-2.3 1.1-3.7-1.1.1-2.4.7-3.2 1.7-.7.8-1.3 2.1-1.1 3.3 1.2.1 2.4-.5 3.2-1.3Z"
        fill="#000000"
      />
    </Svg>
  );
}

type LinkedProvider = "apple" | "google" | "email";

export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const refreshSession = useAuthStore((s) => s.refreshSession);

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [provider, setProvider] = useState<LinkedProvider | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [emailSheetVisible, setEmailSheetVisible] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const passwordEval = useMemo(() => evaluatePasswordStrength(passwordValue.trim()), [passwordValue]);
  const emailOk = useMemo(() => isValidEmailFormat(emailValue), [emailValue]);
  const canSubmitEmail = emailOk && passwordEval.isStrong;

  const loadSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setIsAnonymous(false);
      setProvider(null);
      setEmail(null);
      return;
    }

    if (user.is_anonymous === true) {
      setIsAnonymous(true);
      setProvider(null);
      setEmail(null);
      return;
    }

    setIsAnonymous(false);
    setEmail(user.email ?? null);
    const providers = (user.identities ?? []).map((i) => i.provider);
    if (providers.includes("google")) setProvider("google");
    else if (providers.includes("apple")) setProvider("apple");
    else setProvider("email");
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const providerLabel =
    isAnonymous
      ? "Anonymous"
      : provider === "apple"
        ? "Apple"
        : provider === "google"
          ? "Google"
          : "Email";

  const statusSubtitle = isAnonymous
    ? "Connect Google or email so you don’t lose progress on this device."
    : email
      ? email
      : `Signed in with ${providerLabel}`;

  const handleConnectApple = useCallback(() => {
    Alert.alert("Coming soon", "Sign in with Apple will be available in a future update.");
  }, []);

  const handleConnectGoogle = useCallback(async () => {
    if (provider === "google") return;
    setBusy("google");
    try {
      const result = await linkGoogleAccount();
      if (!result.success) {
        Alert.alert("Couldn’t connect Google", result.error ?? "Try again.");
        return;
      }
      await refreshSession();
      await loadSession();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Google");
    } finally {
      setBusy(null);
    }
  }, [provider, refreshSession, loadSession]);

  const closeEmailSheet = useCallback(() => {
    Keyboard.dismiss();
    setEmailSheetVisible(false);
    setEmailValue("");
    setPasswordValue("");
  }, []);

  const handleConnectEmail = useCallback(() => {
    if (!isAnonymous && provider === "email") return;
    if (!isAnonymous && provider != null) {
      Alert.alert(
        "Already signed in",
        `You're already connected with ${provider === "google" ? "Google" : "Apple"}. To add email as a sign-in method, go to Account Settings.`
      );
      return;
    }
    setEmailValue("");
    setPasswordValue("");
    setEmailSheetVisible(true);
  }, [isAnonymous, provider]);

  const handleEmailSubmit = useCallback(async () => {
    const emailTrim = emailValue.trim();
    const pass = passwordValue.trim();
    if (!canSubmitEmail) {
      Alert.alert("Check your details", "Use a valid email and a password that meets every requirement below.");
      return;
    }
    setBusy("email");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.is_anonymous) {
        Alert.alert("Unavailable", "Email setup is only available for guest sessions.");
        return;
      }
      const emailRedirectTo = makeRedirectUri({ scheme: "alter-ego" });
      const { error } = await supabase.auth.updateUser({
        email: emailTrim,
        password: pass,
        options: {
          emailRedirectTo,
        },
      });
      if (error) throw error;
      closeEmailSheet();
      await refreshSession();
      await loadSession();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not connect email");
    } finally {
      setBusy(null);
    }
  }, [canSubmitEmail, emailValue, passwordValue, refreshSession, loadSession, closeEmailSheet]);

  const emailInvalidHint =
    emailValue.trim().length > 0 && !emailOk ? "Enter a valid email address." : null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <Text style={styles.headerTitle}>Account</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>SIGNED IN AS</Text>
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, (provider != null || isAnonymous) && styles.statusDotConnected]} />
          <View style={styles.statusInfo}>
            <Text style={styles.statusProvider}>{providerLabel}</Text>
            <Text style={styles.statusEmail}>{statusSubtitle}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>CONNECT ANOTHER METHOD</Text>
        <View style={styles.groupCard}>
          <Pressable
            onPress={handleConnectApple}
            style={({ pressed }) => [styles.methodRow, pressed && styles.methodRowPressed]}
          >
            <View style={styles.iconBoxApple}>
              <AppleIcon />
            </View>
            <Text style={styles.methodLabel}>Apple</Text>
            <Text style={[styles.methodBadge, provider === "apple" && styles.methodBadgeConnected]}>
              {provider === "apple" ? "Connected" : "Coming soon"}
            </Text>
          </Pressable>
          <View style={styles.methodDivider} />
          <Pressable
            onPress={handleConnectGoogle}
            disabled={busy != null || provider === "google"}
            style={({ pressed }) => [styles.methodRow, pressed && styles.methodRowPressed]}
          >
            <View style={styles.iconBoxGoogle}>
              {busy === "google" ? (
                <ActivityIndicator color={TEXT} />
              ) : (
                <Ionicons name="logo-google" size={20} color={TEXT} />
              )}
            </View>
            <Text style={styles.methodLabel}>Google</Text>
            <Text style={[styles.methodBadge, provider === "google" && styles.methodBadgeConnected]}>
              {provider === "google" ? "Connected" : "Not connected"}
            </Text>
          </Pressable>
          <View style={styles.methodDivider} />
          <Pressable
            onPress={handleConnectEmail}
            disabled={busy != null || (!isAnonymous && provider === "email")}
            style={({ pressed }) => [styles.methodRow, styles.methodRowLast, pressed && styles.methodRowPressed]}
          >
            <View style={styles.iconBoxEmail}>
              {busy === "email" ? (
                <ActivityIndicator color={VIOLET} />
              ) : (
                <Ionicons name="mail-outline" size={18} color={VIOLET} />
              )}
            </View>
            <Text style={styles.methodLabel}>Email</Text>
            <Text
              style={[
                styles.methodBadge,
                !isAnonymous && provider === "email" && styles.methodBadgeConnected,
                isAnonymous && styles.methodBadgeConnected,
              ]}
            >
              {!isAnonymous && provider === "email"
                ? "Connected"
                : isAnonymous
                  ? "Recommended"
                  : "Not connected"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Connecting Google or email lets you sign in on a new device without losing progress. Apple sign-in is coming
          soon.
        </Text>
      </ScrollView>

      <Modal
        visible={emailSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEmailSheet}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
        >
          <View style={styles.sheetBackdrop}>
            <Pressable style={styles.sheetDimTap} onPress={Keyboard.dismiss} accessibilityLabel="Dismiss keyboard" />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
              <View style={styles.sheetHeaderRow}>
                <Text style={styles.sheetTitle}>{isAnonymous ? "Add email & password" : "Connect Email"}</Text>
                <Pressable onPress={closeEmailSheet} style={styles.sheetCloseBtn} hitSlop={14} accessibilityLabel="Close">
                  <Ionicons name="close" size={24} color={MUTED} />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.sheetScrollContent}
              >
                <Text style={styles.sheetHint}>
                  {isAnonymous
                    ? "This upgrades your guest session to a full account. Choose a strong password (type your own — we won’t suggest one)."
                    : "Link an email identity to your account."}
                </Text>
                <TextInput
                  style={[styles.sheetInput, emailInvalidHint ? styles.sheetInputErr : null]}
                  value={emailValue}
                  onChangeText={setEmailValue}
                  placeholder="Email"
                  placeholderTextColor={VERY_DIM}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="emailAddress"
                  importantForAutofill="no"
                />
                {emailInvalidHint ? <Text style={styles.fieldErr}>{emailInvalidHint}</Text> : null}
                <TextInput
                  style={styles.sheetInput}
                  value={passwordValue}
                  onChangeText={setPasswordValue}
                  placeholder="Password"
                  placeholderTextColor={VERY_DIM}
                  secureTextEntry
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                />
                <Text style={styles.criteriaTitle}>Password must have:</Text>
                {passwordEval.criteria.map((c) => (
                  <View key={c.id} style={styles.criterionRow}>
                    <Ionicons
                      name={c.met ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={c.met ? VIOLET : DIM}
                    />
                    <Text style={[styles.criterionText, c.met && styles.criterionMet]}>{c.label}</Text>
                  </View>
                ))}
                <Pressable
                  onPress={() => void handleEmailSubmit()}
                  disabled={!canSubmitEmail || busy != null}
                  style={({ pressed }) => [
                    styles.sheetSubmit,
                    (!canSubmitEmail || busy != null) && styles.sheetSubmitDisabled,
                    pressed && canSubmitEmail && !busy && styles.sheetSubmitPressed,
                  ]}
                >
                  <LinearGradient
                    colors={!canSubmitEmail || busy != null ? ["#3B2A55", "#4C3D66"] : ["#5B21B6", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sheetSubmitGradient}
                  >
                    <Text style={styles.sheetSubmitText}>{busy === "email" ? "…" : "Connect"}</Text>
                  </LinearGradient>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: TEXT },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DIM,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  statusCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VERY_DIM,
  },
  statusDotConnected: {
    backgroundColor: VIOLET,
    shadowColor: "rgba(139,92,246,0.50)",
    shadowRadius: 6,
    elevation: 4,
  },
  statusInfo: { flex: 1 },
  statusProvider: { fontSize: 13, fontWeight: "600", color: TEXT },
  statusEmail: { fontSize: 11, color: "#4B5563", marginTop: 1 },
  groupCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: GROUP_BORDER,
  },
  methodRowLast: { borderBottomWidth: 0 },
  methodRowPressed: { backgroundColor: "rgba(255,255,255,0.02)" },
  iconBoxApple: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxGoogle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxEmail: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: TEXT },
  methodBadge: { fontSize: 11, color: DIM },
  methodBadgeConnected: { fontWeight: "500", color: VIOLET },
  methodDivider: {
    height: 1,
    backgroundColor: GROUP_BORDER,
    marginLeft: 16 + 36 + 12,
  },
  note: {
    fontSize: 11,
    color: VERY_DIM,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    lineHeight: 16,
  },
  modalRoot: { flex: 1 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetDimTap: {
    flex: 1,
    minHeight: 48,
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: "92%",
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetCloseBtn: { padding: 4 },
  sheetScrollContent: { paddingBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: TEXT, flex: 1, paddingRight: 8 },
  sheetHint: { fontSize: 12, color: MUTED, marginBottom: 16, lineHeight: 18 },
  sheetInput: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT,
    marginBottom: 8,
  },
  sheetInputErr: {
    borderColor: "#7F1D1D",
  },
  fieldErr: {
    fontSize: 11,
    color: "rgba(220,160,160,0.75)",
    marginBottom: 8,
    marginTop: -4,
  },
  criteriaTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: DIM,
    marginTop: 8,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  criterionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  criterionText: { fontSize: 12, color: MUTED, flex: 1 },
  criterionMet: { color: "rgba(167,139,250,0.95)" },
  sheetSubmit: { height: 52, borderRadius: 16, overflow: "hidden", marginTop: 16 },
  sheetSubmitDisabled: { opacity: 0.85 },
  sheetSubmitPressed: { opacity: 0.92 },
  sheetSubmitGradient: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSubmitText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
});
