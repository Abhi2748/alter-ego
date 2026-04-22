/**
 * SignUpScreen — Screen 02. Auth wired to Supabase.
 * Apple / Google (OAuth) + Email (magic link). New user → INSERT users + character_state etc. → Onboarding.
 * Existing user → Main. Error toast: #7F1D1D bg, white text.
 */

import { useMemo, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { COLORS, RADIUS, SPACING, ANIMATIONS, GRADIENTS } from "../constants/theme";
import { supabase, setGuestMode } from "@/utils/supabase";
import { apiClient, isAuthError } from "@/services/api";
import { onboardingService } from "@/services/onboarding";
import { IS_CLOSED_BETA } from "@/constants/closedBeta";
import { sendEmailOtp, verifyEmailOtp } from "@/services/auth";

WebBrowser.maybeCompleteAuthSession();

// -----------------------------------------------------------------------------
// Constants & particle helpers
// -----------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 42;
const PARTICLE_COUNT = 28;
const TOAST_DURATION_MS = 4000;
const ERROR_TOAST_BG = "#7F1D1D";
const ERROR_TOAST_TEXT = "#FFFFFF";

function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

type ParticleConfig = {
  x: number;
  y: number;
  color: string;
  opacity: number;
  size: number;
  delayPhase: number;
  angle: number;
  amplitude: number;
  duration: number;
};

function getParticleConfigs(): ParticleConfig[] {
  const random = createSeededRandom(PARTICLE_SEED);
  const configs: ParticleConfig[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    configs.push({
      x: random() * (SCREEN_WIDTH - 16),
      y: random() * (SCREEN_HEIGHT - 16),
      color: PARTICLE_COLORS[Math.floor(random() * 3)],
      opacity: 0.3 + random() * 0.3,
      size: 3 + random(),
      delayPhase: random() * 0.25,
      angle: random() * 2 * Math.PI,
      amplitude: 8 + random() * 8,
      duration: 4000 + random() * 4000,
    });
  }
  return configs;
}

function ParticleDot({ config }: { config: ParticleConfig }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [config.duration]);
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const p = (phase.value + config.delayPhase) * 2 * Math.PI;
    const t = Math.sin(p);
    const tx = config.amplitude * t * Math.cos(config.angle);
    const ty = config.amplitude * t * Math.sin(config.angle);
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particleDot,
        {
          left: config.x,
          top: config.y,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          opacity: config.opacity,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}

// -----------------------------------------------------------------------------
// Auth button
// -----------------------------------------------------------------------------

function AuthButton({
  onPress,
  icon,
  label,
  variant,
  loading,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant: "apple" | "google" | "email";
  loading?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isApple = variant === "apple";
  const buttonStyle = isApple ? styles.buttonApple : styles.buttonDark;
  const labelStyle = isApple ? styles.labelApple : styles.labelDark;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      onPressIn={() => {
        if (!loading) scale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: ANIMATIONS.pressOut });
      }}
      style={styles.buttonWrapper}
    >
      <Animated.View style={[styles.buttonInner, buttonStyle, animatedStyle]}>
        {loading ? (
          <ActivityIndicator size="small" color={isApple ? "#000000" : COLORS.text} />
        ) : (
          <>
            <View style={styles.buttonIcon}>{icon}</View>
            <Text style={[styles.buttonLabel, labelStyle]}>{label}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// SignUpScreen
// -----------------------------------------------------------------------------

type Nav = StackNavigationProp<RootStackParamList, "SignUp">;

function createSessionFromUrl(url: string) {
  // Supabase implicit flow returns tokens in the URL fragment (#access_token=...)
  // PKCE flow returns a code= query param — handle both.
  if (url.includes("access_token")) {
    const fragment = url.split("#")[1] ?? "";
    const params = new URLSearchParams(fragment);
    const access_token = params.get("access_token") ?? "";
    const refresh_token = params.get("refresh_token") ?? "";
    if (!access_token) {
      return Promise.resolve({ data: { session: null }, error: new Error("No access token") });
    }
    return supabase.auth.setSession({ access_token, refresh_token });
  }
  // Fallback: PKCE code exchange
  return supabase.auth.exchangeCodeForSession(url);
}

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<"apple" | "google" | "email" | "later" | null>(null);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [otpStep, setOtpStep] = useState<"email" | "otp">("email");
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);

  /** Stale JWT (e.g. pre-backend): session exists but backend returns 401 — clear so user can sign in fresh. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const t = sessionData?.session?.access_token;
      if (!t || t === "guest") return;
      try {
        await apiClient.get("/api/v1/auth/me");
      } catch (e) {
        if (cancelled || !isAuthError(e)) return;
        await supabase.auth.signOut();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), TOAST_DURATION_MS);
  }, []);

  const ensureUserAndNavigate = useCallback(
    async (userId: string, email: string | undefined) => {
      try {
        if (email != null) {
          const { data: row } = await supabase
            .from("users")
            .select("id, email")
            .eq("id", userId)
            .maybeSingle();
          if (row && row.email !== email) {
            await supabase.from("users").update({ email }).eq("id", userId);
          }
        }
      } catch (_) {
        /* non-blocking */
      }
      try {
        const createProfilePromise = onboardingService.createProfile();
        const mePromise = apiClient.get<{
          exists: boolean;
          onboarding_complete?: boolean;
        }>("/api/v1/auth/me");

        // Parallelize so the navigation decision returns quicker.
        const [, meResult] = await Promise.allSettled([
          createProfilePromise,
          mePromise,
        ]);

        if (
          meResult.status === "fulfilled" &&
          meResult.value?.exists &&
          meResult.value?.onboarding_complete
        ) {
          navigation.replace("Main");
        } else {
          navigation.replace("Onboarding");
        }
      } catch {
        navigation.replace("Onboarding");
      }
    },
    [navigation]
  );

  const signInLater = useCallback(async () => {
    setLoadingProvider("later");
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (data?.user) {
        await ensureUserAndNavigate(data.user.id, undefined);
      } else {
        showError("Could not continue");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      const lower = typeof msg === "string" ? msg.toLowerCase() : "";
      const isAnonymousDisabled =
        lower.includes("anonymous") || lower.includes("sign-in is disabled");
      const isNetworkError =
        lower.includes("network request failed") ||
        lower.includes("failed to fetch") ||
        lower.includes("network error") ||
        lower.includes("could not connect");
      if (isAnonymousDisabled || isNetworkError) {
        await setGuestMode();
        navigation.replace("Onboarding");
      } else {
        showError(msg);
      }
    } finally {
      setLoadingProvider(null);
    }
  }, [ensureUserAndNavigate, showError, navigation]);

  const performOAuth = useCallback(
    async (provider: "apple" | "google") => {
      setLoadingProvider(provider);
      setErrorMessage(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const isAnonymous = sessionData?.session?.user?.is_anonymous === true;

        if (isAnonymous) {
          const { data, error } = await supabase.auth.linkIdentity({
            provider,
            options: { redirectTo: "alter-ego://", skipBrowserRedirect: true },
          });
          if (error) throw error;
          if (!data?.url) {
            showError("Could not link account");
            return;
          }
          const res = await WebBrowser.openAuthSessionAsync(data.url, "alter-ego://");
          if (res.type === "success" && res.url) {
            const { error: sessionError } = await createSessionFromUrl(res.url);
            if (sessionError) throw sessionError;
            const { data: after } = await supabase.auth.getSession();
            if (after?.session?.user) {
              await ensureUserAndNavigate(
                after.session.user.id,
                after.session.user.email ?? undefined
              );
            }
          } else if (res.type !== "cancel") {
            showError("Sign in was cancelled or failed");
          }
          return;
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: "alter-ego://", skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data?.url) {
          showError("Could not start sign in");
          return;
        }
        const res = await WebBrowser.openAuthSessionAsync(data.url, "alter-ego://");
        if (res.type === "success" && res.url) {
          const { error: sessionError } = await createSessionFromUrl(res.url);
          if (sessionError) throw sessionError;
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            await ensureUserAndNavigate(
              sessionData.session.user.id,
              sessionData.session.user.email ?? undefined
            );
          }
        } else if (res.type === "cancel") {
          // user closed browser, no error
        } else {
          showError("Sign in was cancelled or failed");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Sign in failed";
        showError(msg);
      } finally {
        setLoadingProvider(null);
      }
    },
    [ensureUserAndNavigate, showError]
  );

  const sendOtp = useCallback(async () => {
    const email = emailInput.trim();
    if (!email) return;
    setEmailSending(true);
    setErrorMessage(null);
    try {
      const result = await sendEmailOtp(email);
      if (!result.success) throw new Error(result.error);
      setOtpStep("otp");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send code";
      showError(msg);
    } finally {
      setEmailSending(false);
    }
  }, [emailInput, showError]);

  const verifyOtp = useCallback(async () => {
    const email = emailInput.trim();
    const token = otpCode.trim();
    if (!email || token.length !== 6) return;
    setOtpVerifying(true);
    setErrorMessage(null);
    try {
      const result = await verifyEmailOtp(email, token);
      if (!result.success) throw new Error(result.error);
      setEmailModalVisible(false);
      setEmailInput("");
      setOtpCode("");
      setOtpStep("email");
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await ensureUserAndNavigate(
          data.session.user.id,
          data.session.user.email ?? undefined
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      showError(msg);
    } finally {
      setOtpVerifying(false);
    }
  }, [emailInput, otpCode, ensureUserAndNavigate, showError]);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.root}>
        <LinearGradient
          colors={GRADIENTS.backgroundPremium.colors}
          style={StyleSheet.absoluteFill}
          start={GRADIENTS.backgroundPremium.start}
          end={GRADIENTS.backgroundPremium.end}
        />
        <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
          {particleConfigs.map((config, i) => (
            <ParticleDot key={i} config={config} />
          ))}
        </View>

        {errorMessage ? (
          <Pressable
            style={[styles.toast, { paddingTop: 12 + insets.top, paddingBottom: 12 }]}
            onPress={() => setErrorMessage(null)}
            accessibilityRole="button"
          >
            <Text style={styles.toastText}>{errorMessage}</Text>
          </Pressable>
        ) : null}

        <SafeAreaView style={styles.safeContent} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.logoSection}>
            <Text style={styles.logo}>ALTER EGO</Text>
            <Text style={styles.subtitle}>The Adaptive Discipline Engine</Text>
          </View>

          <View style={styles.buttonsSection}>
            <View style={styles.buttonsInner}>
              {!IS_CLOSED_BETA ? (
                <AuthButton
                  onPress={() => performOAuth("apple")}
                  icon={<Ionicons name="logo-apple" size={20} color="#000000" />}
                  label="Continue with Apple"
                  variant="apple"
                  loading={loadingProvider === "apple"}
                />
              ) : null}
              <AuthButton
                onPress={() => performOAuth("google")}
                icon={<Ionicons name="logo-google" size={20} color={COLORS.text} />}
                label="Continue with Google"
                variant="google"
                loading={loadingProvider === "google"}
              />
              {!IS_CLOSED_BETA ? (
                <AuthButton
                  onPress={() => setEmailModalVisible(true)}
                  icon={<Ionicons name="mail-outline" size={20} color={COLORS.text2} />}
                  label="Continue with Email"
                  variant="email"
                  loading={loadingProvider === "email"}
                />
              ) : null}

              <Pressable
                onPress={signInLater}
                disabled={loadingProvider !== null}
                style={styles.signInLaterWrap}
              >
                {loadingProvider === "later" ? (
                  <ActivityIndicator size="small" color={COLORS.text2} />
                ) : (
                  <Text style={styles.signInLaterText}>Sign in later</Text>
                )}
              </Pressable>

              <Text style={styles.legal}>
                By continuing you agree to our{" "}
                <Text style={styles.legalLink} onPress={() => {}} suppressHighlighting>Terms</Text> and{" "}
                <Text style={styles.legalLink} onPress={() => {}} suppressHighlighting>Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <Modal
        visible={!IS_CLOSED_BETA && emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEmailModalVisible(false);
          setOtpStep("email");
          setOtpCode("");
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setEmailModalVisible(false);
            setOtpStep("email");
            setOtpCode("");
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {otpStep === "email" ? (
              <>
                <Text style={styles.modalTitle}>Continue with Email</Text>
                <Text style={styles.modalHint}>
                  We'll send a 6-digit code to your inbox
                </Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.muted}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!emailSending}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnCancel]}
                    onPress={() => setEmailModalVisible(false)}
                  >
                    <Text style={styles.modalBtnCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalBtn,
                      styles.modalBtnSend,
                      (!emailInput.trim() || emailSending) && { opacity: 0.5 },
                    ]}
                    onPress={sendOtp}
                    disabled={emailSending || !emailInput.trim()}
                  >
                    {emailSending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalBtnSendText}>Send Code</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Enter your code</Text>
                <Text style={styles.modalHint}>
                  Sent to {emailInput}
                </Text>
                <TextInput
                  style={[styles.emailInput, { letterSpacing: 8, textAlign: "center", fontSize: 22 }]}
                  placeholder="000000"
                  placeholderTextColor={COLORS.muted}
                  value={otpCode}
                  onChangeText={(t) => setOtpCode(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  autoFocus
                  editable={!otpVerifying}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnCancel]}
                    onPress={() => {
                      setOtpStep("email");
                      setOtpCode("");
                    }}
                  >
                    <Text style={styles.modalBtnCancelText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalBtn,
                      styles.modalBtnSend,
                      (otpCode.length !== 6 || otpVerifying) && { opacity: 0.5 },
                    ]}
                    onPress={verifyOtp}
                    disabled={otpVerifying || otpCode.length !== 6}
                  >
                    {otpVerifying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalBtnSendText}>Verify</Text>
                    )}
                  </Pressable>
                </View>
                <Pressable onPress={sendOtp} style={{ marginTop: 12, alignSelf: "center" }}>
                  <Text style={{ fontSize: 13, color: COLORS.muted }}>
                    Didn't get it? <Text style={{ color: COLORS.violet }}>Resend</Text>
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  particleContainer: { overflow: "hidden" },
  particleDot: { position: "absolute" },
  toast: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: ERROR_TOAST_BG,
    paddingHorizontal: SPACING.screenPadding,
    zIndex: 10,
  },
  toastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: ERROR_TOAST_TEXT,
    textAlign: "center",
  },
  safeContent: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
    paddingHorizontal: SPACING.screenPadding,
  },
  logoSection: {
    flex: 0,
    alignItems: "center",
    marginTop: 180,
  },
  logo: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: SPACING.sm,
  },
  buttonsSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 48,
    alignItems: "center",
  },
  buttonsInner: { maxWidth: 358, width: "100%" },
  buttonWrapper: { marginBottom: SPACING.cardGap },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: RADIUS.card,
    position: "relative",
  },
  buttonApple: { backgroundColor: "#FFFFFF" },
  buttonDark: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
  },
  buttonIcon: { position: "absolute", left: 20 },
  buttonLabel: { fontFamily: "Inter_600SemiBold", fontSize: 16, fontWeight: "600" },
  labelApple: { color: "#000000" },
  labelDark: { color: COLORS.text },
  signInLaterWrap: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  signInLaterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.text2,
    textDecorationLine: "underline",
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.md,
  },
  legalLink: { color: COLORS.violet },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.screenPadding,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.modal,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 4,
  },
  modalHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    marginBottom: SPACING.md,
  },
  emailInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.bg1,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalButtons: { flexDirection: "row", gap: SPACING.sm, justifyContent: "flex-end" },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.card,
    minWidth: 80,
    alignItems: "center",
  },
  modalBtnCancel: { backgroundColor: COLORS.surface2 },
  modalBtnCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: COLORS.text2 },
  modalBtnSend: { backgroundColor: COLORS.violet },
  modalBtnSendText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: COLORS.text },
});
