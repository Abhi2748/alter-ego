import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { RootStackParamList } from "./types";
import { SplashScreen } from "../screens/SplashScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { OnboardingStack } from "./OnboardingStack";
import { MainStack } from "./MainStack";
import { COLORS } from "../constants/theme";

const Stack = createStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg1 },
      }}
      initialRouteName="Splash"
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingStack} />
      <Stack.Screen name="Main" component={MainStack} />
    </Stack.Navigator>
  );
}
