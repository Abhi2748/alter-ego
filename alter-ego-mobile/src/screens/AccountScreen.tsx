/**
 * Settings → Account. Signed-in method, connect Apple/Google/Email.
 * Shared header pattern + gradient bg. Spec: Account.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/utils/supabase";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE = "#111623";
const BORDER = "#1A1F30";
const GROUP_BORDER = "rgba(42,48,80,0.40)";
const VIOLET = "#8B5CF6";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

const ACCOUNT_MANAGE_URL = "https://alterego.app/account";

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

type Provider = "apple" | "google" | "email";

export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [emailSheetVisible, setEmailSheetVisible] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  const loadSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.app_metadata?.provider) {
      const p = session.user.app_metadata.provider as string;
      if (p === "apple") setProvider("apple");
      else if (p === "google") setProvider("google");
      else setProvider("email");
    } else {
      setProvider("email");
    }
    setEmail(session?.user?.email ?? null);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const providerLabel = provider === "apple" ? "Apple" : provider === "google" ? "Google" : "Email";
  const providerEmail = email ?? "Signed in with " + providerLabel;

  const handleManage = useCallback(() => {
    Linking.openURL(ACCOUNT_MANAGE_URL);
  }, []);

  const handleConnectApple = useCallback(async () => {
    if (provider === "apple") return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "apple" });
      if (error) throw error;
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Apple");
    }
  }, [provider]);

  const handleConnectGoogle = useCallback(async () => {
    if (provider === "google") return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not connect Google");
    }
  }, [provider]);

  const handleConnectEmail = useCallback(() => {
    if (provider === "email") return;
    setEmailValue("");
    setPasswordValue("");
    setEmailSheetVisible(true);
  }, [provider]);

  const handleEmailSubmit = useCallback(async () => {
    const emailTrim = emailValue.trim();
    const pass = passwordValue.trim();
    if (!emailTrim || !pass) {
      Alert.alert("Required", "Enter email and password.");
      return;
    }
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "email",
        email: emailTrim,
        password: pass,
      });
      if (error) throw error;
      setEmailSheetVisible(false);
      loadSession();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not link email");
    }
  }, [emailValue, passwordValue, loadSession]);

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
      >
        <Text style={styles.sectionLabel}>SIGNED IN AS</Text>
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, provider && styles.statusDotConnected]} />
          <View style={styles.statusInfo}>
            <Text style={styles.statusProvider}>{providerLabel}</Text>
            <Text style={styles.statusEmail}>{providerEmail}</Text>
          </View>
          <Pressable onPress={handleManage}>
            <Text style={styles.manageLink}>Manage</Text>
          </Pressable>
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
              {provider === "apple" ? "Connected" : "Not connected"}
            </Text>
          </Pressable>
          <View style={styles.methodDivider} />
          <Pressable
            onPress={handleConnectGoogle}
            style={({ pressed }) => [styles.methodRow, pressed && styles.methodRowPressed]}
          >
            <View style={styles.iconBoxGoogle}>
              <Ionicons name="logo-google" size={20} color={TEXT} />
            </View>
            <Text style={styles.methodLabel}>Google</Text>
            <Text style={[styles.methodBadge, provider === "google" && styles.methodBadgeConnected]}>
              {provider === "google" ? "Connected" : "Not connected"}
            </Text>
          </Pressable>
          <View style={styles.methodDivider} />
          <Pressable
            onPress={handleConnectEmail}
            style={({ pressed }) => [styles.methodRow, styles.methodRowLast, pressed && styles.methodRowPressed]}
          >
            <View style={styles.iconBoxEmail}>
              <Ionicons name="mail-outline" size={18} color={VIOLET} />
            </View>
            <Text style={styles.methodLabel}>Email</Text>
            <Text style={[styles.methodBadge, provider === "email" && styles.methodBadgeConnected]}>
              {provider === "email" ? "Connected" : "Not connected"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Connecting multiple methods lets you sign in different ways without losing your progress.
        </Text>
      </ScrollView>

      <Modal visible={emailSheetVisible} transparent animationType="slide">
        <Pressable style={styles.sheetBackdrop} onPress={() => setEmailSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Connect Email</Text>
            <TextInput
              style={styles.sheetInput}
              value={emailValue}
              onChangeText={setEmailValue}
              placeholder="Email"
              placeholderTextColor={VERY_DIM}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.sheetInput}
              value={passwordValue}
              onChangeText={setPasswordValue}
              placeholder="Password"
              placeholderTextColor={VERY_DIM}
              secureTextEntry
            />
            <Pressable onPress={handleEmailSubmit} style={styles.sheetSubmit}>
              <LinearGradient
                colors={["#5B21B6", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetSubmitGradient}
              >
                <Text style={styles.sheetSubmitText}>Connect</Text>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
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
  manageLink: { fontSize: 12, color: VIOLET },
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 16 },
  sheetInput: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT,
    marginBottom: 12,
  },
  sheetSubmit: { height: 52, borderRadius: 16, overflow: "hidden", marginTop: 8 },
  sheetSubmitGradient: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSubmitText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
});
