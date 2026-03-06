import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { OnboardingStackParamList } from "./types";
import { OnboardingAnswersProvider } from "../context/OnboardingAnswersContext";
import { OnboardingFramingScreen } from "../screens/OnboardingFramingScreen";
import { OnboardingQuestionScreen } from "../screens/OnboardingQuestionScreen";
import { ArchetypeRevealScreen } from "../screens/ArchetypeRevealScreen";
import { TwinIntroductionScreen } from "../screens/TwinIntroductionScreen";
import { COLORS } from "../constants/theme";

const Stack = createStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <OnboardingAnswersProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg1 },
        }}
      >
        <Stack.Screen name="OnboardingFraming" component={OnboardingFramingScreen} />
        <Stack.Screen name="OnboardingQuestion" component={OnboardingQuestionScreen} />
        <Stack.Screen name="ArchetypeReveal" component={ArchetypeRevealScreen} />
        <Stack.Screen
          name="TwinIntroduction"
          component={TwinIntroductionScreen}
          options={{ headerShown: false, title: "" }}
        />
      </Stack.Navigator>
    </OnboardingAnswersProvider>
  );
}
