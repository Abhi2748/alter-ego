import React from "react";
import { View, Text, Platform } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";

const TAB_HEIGHT = 56;
const TWIN_BUTTON_SIZE = 56;
const TWIN_RAISE = 14;
const ICON_SIZE = 22;
const ICON_SIZE_TWIN = 26;

const tabConfig: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Home: { label: "Home", icon: "home-outline" },
  Leaderboard: { label: "Rank", icon: "podium-outline" },
  Twin: { label: "Twin", icon: "flash" },
  Report: { label: "Report", icon: "document-text-outline" },
  Profile: { label: "Profile", icon: "person-outline" },
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabNames = state.routeNames;

  return (
    <View
      style={{
        flexDirection: "row",
        height: TAB_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: "rgba(10,12,20,0.95)",
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        alignItems: "center",
        justifyContent: "space-around",
        ...(Platform.OS === "ios" && { shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }),
      }}
    >
      {tabNames.map((name) => {
        const isTwin = name === "Twin";
        const isFocused = state.routes[state.index].name === name;
        const config = tabConfig[name] ?? { label: name, icon: "ellipse-outline" as const };

        if (isTwin) {
          return (
            <View key={name} style={{ width: 80, alignItems: "center", justifyContent: "center" }}>
              <TouchableOpacity
                onPress={() => navigation.navigate(name)}
                activeOpacity={0.8}
                style={{
                  width: TWIN_BUTTON_SIZE,
                  height: TWIN_BUTTON_SIZE,
                  borderRadius: TWIN_BUTTON_SIZE / 2,
                  backgroundColor: isFocused ? COLORS.violet : COLORS.violetDeep,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -TWIN_RAISE,
                  shadowColor: COLORS.violet,
                  shadowOpacity: isFocused ? 0.55 : 0.35,
                  shadowRadius: isFocused ? 16 : 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 10,
                  borderWidth: 2,
                  borderColor: "rgba(167, 139, 250, 0.4)",
                }}
              >
                <Ionicons
                  name="flash"
                  size={ICON_SIZE_TWIN}
                  color="#E5E7EB"
                />
              </TouchableOpacity>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: isFocused ? COLORS.violet : COLORS.muted,
                  marginTop: 4,
                }}
              >
                {config.label}
              </Text>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={name}
            onPress={() => navigation.navigate(name)}
            activeOpacity={0.7}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 44, paddingVertical: 8 }}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <Ionicons
              name={config.icon}
              size={ICON_SIZE}
              color={isFocused ? COLORS.violet : COLORS.muted}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "500",
                color: isFocused ? COLORS.violet : COLORS.muted,
                marginTop: 2,
              }}
            >
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
