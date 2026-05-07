import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/utils/supabase";
import { sendEmailOtp, verifyEmailOtp, linkGoogleAccount, getAuthToken } from "@/services/auth";

type Step = "idle" | "email" | "otp";

export function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [displayEmail, setDisplayEmail] = useState<string | null>(null);
  const [isAnon, setIsAnon] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [emailIdentityLinked, setEmailIdentityLinked] = useState(false);

  const [step, setStep] = useState<Step>("idle");
  const [emailInput, setEmailInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (!u) return;

      setIsAnon(u.is_anonymous ?? true);
      setDisplayEmail(u.email ?? null);

      const identities = u.identities ?? [];
      setGoogleConnected(identities.some((i) => i.provider === "google"));
      setEmailIdentityLinked(identities.some((i) => i.provider === "email"));
    });
  }, []);

  const handleSendOtp = useCallback(async () => {
    const email = emailInput.trim();
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendEmailOtp(email);
      if (!result.success) throw new Error(result.error);
      setStep("otp");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  }, [emailInput]);

  const notifyBackendEmailLinked = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/link-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Non-critical — don't block the UI if this fails
    }
  }, []);

  const handleVerifyOtp = useCallback(async () => {
    const email = emailInput.trim();
    const token = otpCode.trim();
    if (!email || token.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyEmailOtp(email, token);
      if (!result.success) throw new Error(result.error);
      await notifyBackendEmailLinked();
      setEmailIdentityLinked(true);
      setDisplayEmail(email);
      setIsAnon(false);
      setStep("idle");
      setEmailInput("");
      setOtpCode("");
      Alert.alert("Email connected", "Your account is now secured.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setVerifying(false);
    }
  }, [emailInput, otpCode, notifyBackendEmailLinked]);

  const handleLinkGoogle = useCallback(async () => {
    setLinkingGoogle(true);
    setError(null);
    try {
      const result = await linkGoogleAccount();
      if (!result.success) throw new Error(result.error);
      setGoogleConnected(true);
      setIsAnon(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Google linking failed");
    } finally {
      setLinkingGoogle(false);
    }
  }, []);

  const signedInLabel = isAnon
    ? "Anonymous"
    : googleConnected && emailIdentityLinked
      ? displayEmail ?? "Connected"
      : googleConnected
        ? `Google · ${displayEmail ?? ""}`
        : displayEmail ?? "Connected";

  const showConnectSection = !googleConnected || !emailIdentityLinked;

  return (
    <LinearGradient
      colors={["#09091A", "#07080F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.title}>Account</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>SIGNED IN AS</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.dot, { backgroundColor: isAnon ? "#6B7280" : "#8B5CF6" }]} />
            <View>
              <Text style={styles.cardTitle}>
                {signedInLabel}
              </Text>
              {isAnon ? (
                <Text style={styles.cardSub}>
                  Connect email or Google so you don't lose progress.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {showConnectSection ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
              {isAnon ? "CONNECT A METHOD" : "CONNECT ANOTHER METHOD"}
            </Text>

            {!googleConnected ? (
              <Pressable
                style={styles.card}
                onPress={handleLinkGoogle}
                disabled={linkingGoogle}
              >
                <View style={styles.cardRow}>
                  <Ionicons name="logo-google" size={20} color="#9CA3AF" />
                  <Text style={[styles.cardTitle, { flex: 1, marginLeft: 12 }]}>Google</Text>
                  {linkingGoogle ? (
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  ) : (
                    <Text style={[styles.statusText, { color: "#8B5CF6" }]}>Connect</Text>
                  )}
                </View>
              </Pressable>
            ) : null}

            {!emailIdentityLinked ? (
              <Pressable style={styles.card} onPress={() => setStep("email")}>
                <View style={styles.cardRow}>
                  <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                  <Text style={[styles.cardTitle, { flex: 1, marginLeft: 12 }]}>Email</Text>
                  <Text style={[styles.statusText, { color: "#8B5CF6" }]}>Connect</Text>
                </View>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {(googleConnected || emailIdentityLinked) ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>CONNECTED</Text>

            {googleConnected ? (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Ionicons name="logo-google" size={20} color="#4ADE80" />
                  <Text style={[styles.cardTitle, { flex: 1, marginLeft: 12 }]}>Google</Text>
                  <Text style={[styles.statusText, { color: "#4ADE80" }]}>Connected</Text>
                </View>
              </View>
            ) : null}

            {emailIdentityLinked ? (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Ionicons name="mail-outline" size={20} color="#4ADE80" />
                  <Text style={[styles.cardTitle, { flex: 1, marginLeft: 12 }]}>
                    {displayEmail ?? "Email"}
                  </Text>
                  <Text style={[styles.statusText, { color: "#4ADE80" }]}>Connected</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </View>

      <Modal
        visible={step === "email" || step === "otp"}
        transparent
        animationType="slide"
        onRequestClose={() => { setStep("idle"); setOtpCode(""); }}
      >
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => { setStep("idle"); setOtpCode(""); }} />
          <View style={styles.modalSheet}>
            {step === "email" ? (
              <>
                <Text style={styles.modalTitle}>Connect Email</Text>
                <Text style={styles.modalHint}>We'll send a 6-digit code to verify it's you</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#4B5563"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!sending}
                  autoFocus
                />
                <Pressable
                  style={[styles.btn, (!emailInput.trim() || sending) && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={sending || !emailInput.trim()}
                >
                  {sending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Send Code</Text>
                  }
                </Pressable>
                <Pressable onPress={() => setStep("idle")} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Enter the code</Text>
                <Text style={styles.modalHint}>Sent to {emailInput}</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#4B5563"
                  value={otpCode}
                  onChangeText={(t) => setOtpCode(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  autoFocus
                  editable={!verifying}
                />
                <Pressable
                  style={[styles.btn, (otpCode.length !== 6 || verifying) && styles.btnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={verifying || otpCode.length !== 6}
                >
                  {verifying
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Verify & Connect</Text>
                  }
                </Pressable>
                <Pressable onPress={handleSendOtp} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>
                    Didn't get it? <Text style={{ color: "#8B5CF6" }}>Resend</Text>
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1, borderBottomColor: "rgba(42,48,80,0.4)",
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#E5E7EB", letterSpacing: -0.3 },
  body: { padding: 20 },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: "#4B5563", letterSpacing: 1.5, marginBottom: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16, marginBottom: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#E5E7EB" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorText: { color: "#F87171", fontSize: 13, marginTop: 12, textAlign: "center" },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    backgroundColor: "#0F1020", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 40,
    borderTopWidth: 1, borderColor: "rgba(139,92,246,0.2)",
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#E5E7EB", marginBottom: 6 },
  modalHint: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 20 },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.3)",
    padding: 16, color: "#E5E7EB", fontSize: 16,
    fontFamily: "Inter_400Regular", marginBottom: 16,
  },
  otpInput: { letterSpacing: 10, textAlign: "center", fontSize: 24 },
  btn: {
    backgroundColor: "#7C3AED", borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginBottom: 12,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { color: "#6B7280", fontSize: 14, fontFamily: "Inter_400Regular" },
});
