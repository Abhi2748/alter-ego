/**
 * Profile stack: main profile (4 buttons) → Stats | Streak | Titles | Interests screens.
 */

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { ProfileStackParamList } from "./types";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ProfileStatsScreen } from "../screens/ProfileStatsScreen";
import { ProfileStreakScreen } from "../screens/ProfileStreakScreen";
import { ProfileIdentityScreen } from "../screens/ProfileIdentityScreen";
import { ProfileCompanionScreen } from "../screens/ProfileCompanionScreen";
import { ProfileInterestsScreen } from "../screens/ProfileInterestsScreen";
import { ProfileQuitsScreen } from "../screens/ProfileQuitsScreen";
import { COLORS } from "../constants/theme";

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg1 },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="ProfileStats" component={ProfileStatsScreen} />
      <Stack.Screen name="ProfileStreak" component={ProfileStreakScreen} />
      <Stack.Screen name="ProfileIdentity" component={ProfileIdentityScreen} />
      <Stack.Screen name="ProfileCompanion" component={ProfileCompanionScreen} />
      <Stack.Screen name="ProfileInterests" component={ProfileInterestsScreen} />
      <Stack.Screen name="ProfileQuits" component={ProfileQuitsScreen} />
    </Stack.Navigator>
  );
}
