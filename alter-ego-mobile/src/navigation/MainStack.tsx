import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { MainStackParamList } from "./types";
import { MainTabNavigator } from "./MainTabNavigator";
import { SettingsScreen } from "../screens/SettingsScreen";
import { COLORS } from "../constants/theme";

const Stack = createStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg1 },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
