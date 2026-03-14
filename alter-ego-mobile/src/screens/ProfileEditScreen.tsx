/**
 * Settings → Edit Profile. Avatar upload, username, display name, save.
 * Shared header pattern + gradient bg. Spec: Profile Edit.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { supabase } from "../utils/supabase";
import { getUserMe, patchUserMe, checkUsername } from "../utils/api";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE = "#111623";
const BORDER = "#1A1F30";
const GROUP_BORDER = "rgba(42,48,80,0.40)";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [initialUsername, setInitialUsername] = useState("");
  const [initialDisplayName, setInitialDisplayName] = useState("");
  const [initialPhotoUri, setInitialPhotoUri] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasChanges =
    username !== initialUsername ||
    displayName !== initialDisplayName ||
    photoUri !== initialPhotoUri;
  const canSave =
    hasChanges &&
    username.length >= 3 &&
    USERNAME_REGEX.test(username) &&
    !usernameError;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const me = await getUserMe(session.access_token);
      const u = (me.username ?? "").replace(/^@/, "");
      const d = me.display_name ?? "";
      setUsername(u);
      setDisplayName(d);
      setInitialUsername(u);
      setInitialDisplayName(d);
      const photo = me.profile_photo_url ?? null;
      setPhotoUri(photo);
      setInitialPhotoUri(photo);
    } catch (_) {
      setUsername("");
      setDisplayName("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleAvatarPress = useCallback(async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to change your photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const ext = uri.split(".").pop() ?? "jpg";
        const path = `avatars/${session.user.id}/${Date.now()}.${ext}`;
        const body = await (await fetch(uri)).blob();
        const { error } = await supabase.storage.from("profiles").upload(path, body, {
          contentType: `image/${ext}`,
          upsert: true,
        });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("profiles").getPublicUrl(path);
        setPhotoUri(urlData.publicUrl);
      }
    } catch (e) {
      if (String(e).includes("expo-image-picker")) {
        Alert.alert("Coming soon", "Install expo-image-picker to change your photo.");
      } else {
        Alert.alert("Error", "Could not update photo.");
      }
    }
  }, []);

  const validateUsername = useCallback(async (value: string) => {
    const v = value.trim();
    if (v.length < 3) {
      setUsernameError(null);
      return;
    }
    if (!USERNAME_REGEX.test(v) || /\s/.test(v)) {
      setUsernameError("Use 3–20 characters, letters, numbers, and underscores only.");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await checkUsername(v, session.access_token);
      setUsernameError(null);
    } catch {
      setUsernameError("Username taken — try another");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    setUsernameError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      await validateUsername(username);
      if (usernameError) {
        setSaving(false);
        return;
      }
      await patchUserMe(session.access_token, {
        username: username.trim(),
        display_name: displayName.trim() || undefined,
        profile_photo_url: photoUri || undefined,
      });
      setInitialUsername(username.trim());
      setInitialDisplayName(displayName.trim());
      setInitialPhotoUri(photoUri);
      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, username, displayName, photoUri, usernameError, validateUsername, navigation]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarZone}>
          <View style={styles.avatarAndBadgeWrap}>
            <Pressable onPress={handleAvatarPress} style={styles.avatarOuter}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={["rgba(80,30,160,0.70)", "rgba(30,20,60,0.90)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {!photoUri && (
                <Text style={styles.avatarInitial}>
                  {(displayName || username || "U").charAt(0).toUpperCase()}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={handleAvatarPress} style={styles.cameraBadge}>
              <LinearGradient
                colors={[VIOLET_DEEP, VIOLET]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cameraBadgeGradient}
              >
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        <Text style={styles.sectionLabel}>USERNAME</Text>
        <View style={[styles.field, usernameError && styles.fieldError]}>
          <Text style={styles.prefix}>@</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              setUsernameError(null);
            }}
            onBlur={() => validateUsername(username)}
            placeholder="username"
            placeholderTextColor={VERY_DIM}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          {username.length > 0 && (
            <Pressable onPress={() => setUsername("")} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={VERY_DIM} />
            </Pressable>
          )}
        </View>
        <Text style={styles.fieldHint}>Visible on the leaderboard. Max 20 characters.</Text>
        {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}

        <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
        <View style={styles.field}>
          <Ionicons name="person-outline" size={16} color="#4B5563" style={styles.fieldIcon} />
          <TextInput
            style={styles.inputFlex}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Add a display name (optional)"
            placeholderTextColor={VERY_DIM}
            maxLength={40}
            editable={!loading}
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        >
          {canSave ? (
            <LinearGradient
              colors={[VIOLET_DEEP, VIOLET]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtnGradient}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </LinearGradient>
          ) : (
            <View style={styles.saveBtnDisabledInner}>
              <Text style={styles.saveBtnTextDisabled}>Save Changes</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
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
  avatarZone: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  avatarAndBadgeWrap: {
    position: "relative",
    width: 88,
    height: 88,
  },
  avatarOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.40)",
    overflow: "hidden",
    position: "absolute",
    top: 0,
    left: 0,
    shadowColor: "rgba(109,40,217,0.25)",
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    lineHeight: 88,
    fontSize: 28,
    fontWeight: "700",
    color: "rgba(167,139,250,0.80)",
    backgroundColor: "transparent",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#09091A",
    overflow: "hidden",
    shadowColor: "rgba(109,40,217,0.35)",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  cameraBadgeGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: 12, color: "#4B5563", marginTop: 0 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DIM,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  field: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  fieldError: { borderColor: "rgba(139,92,246,0.45)" },
  prefix: { fontSize: 14, color: "#4B5563", flexShrink: 0 },
  input: { flex: 1, fontSize: 14, color: TEXT, padding: 0 },
  inputFlex: { flex: 1, fontSize: 14, color: TEXT, padding: 0 },
  fieldIcon: { flexShrink: 0 },
  clearBtn: { padding: 4 },
  fieldHint: { fontSize: 11, color: DIM, paddingHorizontal: 4, marginBottom: 4 },
  errorText: { fontSize: 11, color: VIOLET, paddingHorizontal: 4, marginBottom: 8 },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    marginTop: 8,
    overflow: "hidden",
  },
  saveBtnGradient: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(139,92,246,0.35)",
    shadowRadius: 20,
    elevation: 8,
  },
  saveBtnDisabled: {},
  saveBtnDisabledInner: {
    height: "100%",
    backgroundColor: "rgba(42,48,80,0.40)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  saveBtnTextDisabled: { fontSize: 15, fontWeight: "600", color: DIM },
});
