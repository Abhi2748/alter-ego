import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { MainStackParamList } from "./types";
import { MainTabNavigator } from "./MainTabNavigator";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TwinChatScreen } from "../screens/TwinChatScreen";
import { RankCardScreen } from "../screens/RankCardScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import { JournalListScreen } from "../screens/JournalListScreen";
import { JournalEditorScreen } from "../screens/JournalEditorScreen";
import { JournalCalendarScreen } from "../screens/JournalCalendarScreen";
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
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="TwinChat" component={TwinChatScreen} />
      <Stack.Screen name="RankCard" component={RankCardScreen} />
      <Stack.Screen name="JournalList" component={JournalListScreen} />
      <Stack.Screen name="JournalEditor" component={JournalEditorScreen} />
      <Stack.Screen name="JournalCalendar" component={JournalCalendarScreen} />
    </Stack.Navigator>
  );
}
