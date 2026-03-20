import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { OnboardingStackParamList } from "./types";
import { OnboardingAnswersProvider } from "../context/OnboardingAnswersContext";
import { OnboardingFramingScreen } from "../screens/OnboardingFramingScreen";
import { OnboardingQuestionScreen } from "../screens/OnboardingQuestionScreen";
import { ArchetypeRevealScreen } from "../screens/ArchetypeRevealScreen";
import { Onboarding7DayScreen } from "../screens/Onboarding7DayScreen";
import { TwinIntroductionScreen } from "../screens/TwinIntroductionScreen";
import { NotificationPermissionScreen } from "../screens/NotificationPermissionScreen";
import { COLORS } from "../constants/theme";

const Stack = createStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <OnboardingAnswersProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#05060C" },
        }}
      >
        <Stack.Screen name="OnboardingFraming" component={OnboardingFramingScreen} />
        <Stack.Screen name="OnboardingQuestion" component={OnboardingQuestionScreen} />
        <Stack.Screen name="ArchetypeReveal" component={ArchetypeRevealScreen} />
        <Stack.Screen name="Onboarding7Day" component={Onboarding7DayScreen} />
        <Stack.Screen
          name="TwinIntroduction"
          component={TwinIntroductionScreen}
          options={{ headerShown: false, title: "" }}
        />
        <Stack.Screen
          name="NotificationPermission"
          component={NotificationPermissionScreen}
          options={{ headerShown: false, title: "" }}
        />
      </Stack.Navigator>
    </OnboardingAnswersProvider>
  );
}
