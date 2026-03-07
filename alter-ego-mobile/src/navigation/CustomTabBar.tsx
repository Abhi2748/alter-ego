import React from "react";
import { View, Text, Platform } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

const TAB_HEIGHT = 56;
const TWIN_BUTTON_SIZE = 52;
const TWIN_RAISE = 8;

const tabLabels: Record<string, string> = {
  Home: "Home",
  Leaderboard: "Leaderboard",
  Twin: "Twin",
  Report: "Report",
  Profile: "Profile",
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabNames = state.routeNames as (keyof typeof tabLabels)[];
  const activeIndex = state.index;

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
      {tabNames.map((name, index) => {
        const isTwin = name === "Twin";
        const isFocused = state.routes[state.index].name === name;

        if (isTwin) {
          return (
            <View key={name} style={{ width: 72, alignItems: "center", justifyContent: "center" }}>
              <TouchableOpacity
                onPress={() => navigation.navigate(name)}
                activeOpacity={0.7}
                style={{
                  width: TWIN_BUTTON_SIZE,
                  height: TWIN_BUTTON_SIZE,
                  borderRadius: TWIN_BUTTON_SIZE / 2,
                  backgroundColor: isFocused ? COLORS.violet : COLORS.surface2,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -TWIN_RAISE,
                  shadowColor: isFocused ? COLORS.violet : "#000",
                  shadowOpacity: isFocused ? 0.5 : 0.3,
                  shadowRadius: isFocused ? 12 : 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: isFocused ? COLORS.text : COLORS.muted,
                  }}
                >
                  Twin
                </Text>
              </TouchableOpacity>
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
            <Text
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: isFocused ? COLORS.violet : COLORS.muted,
              }}
            >
              {tabLabels[name] ?? name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
