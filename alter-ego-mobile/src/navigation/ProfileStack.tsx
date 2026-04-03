/**
 * Profile stack: main profile → Abilities | Streak | Interests | Journey | Quits.
 */

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { ProfileStackParamList } from "./types";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ProfileAbilitiesScreen } from "../screens/ProfileAbilitiesScreen";
import { ProfileStreakScreen } from "../screens/ProfileStreakScreen";
import { ProfileInterestsScreen } from "../screens/ProfileInterestsScreen";
import { ProfileIdentityScreen } from "../screens/ProfileIdentityScreen";
import { ProfileCompanionScreen } from "../screens/ProfileCompanionScreen";
import { ProfileQuitsScreen } from "../screens/ProfileQuitsScreen";
import { InterestDetailScreen } from "../screens/InterestDetailScreen";
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
      <Stack.Screen name="ProfileAbilities" component={ProfileAbilitiesScreen} />
      <Stack.Screen name="ProfileStreak" component={ProfileStreakScreen} />
      <Stack.Screen name="ProfileInterests" component={ProfileInterestsScreen} />
      <Stack.Screen name="ProfileIdentity" component={ProfileIdentityScreen} />
      <Stack.Screen name="ProfileCompanion" component={ProfileCompanionScreen} />
      <Stack.Screen name="ProfileQuits" component={ProfileQuitsScreen} />
      <Stack.Screen name="ProfileInterestDetail" component={InterestDetailScreen} />
    </Stack.Navigator>
  );
}
