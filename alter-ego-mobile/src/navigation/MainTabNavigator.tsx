import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "./types";
import { HomeScreen } from "../screens/HomeScreen";
import { TodaysStoryScreen } from "../screens/TodaysStoryScreen";
import { TwinComparisonScreen } from "../screens/TwinComparisonScreen";
import { FocusScreen } from "../screens/FocusScreen";
import { ProfileStack } from "./ProfileStack";
import { CustomTabBar } from "./CustomTabBar";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Today" component={TodaysStoryScreen} />
      <Tab.Screen name="Twin" component={TwinComparisonScreen} />
      <Tab.Screen name="Focus" component={FocusScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
