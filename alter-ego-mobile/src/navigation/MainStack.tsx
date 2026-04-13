import React, { useEffect } from "react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { createStackNavigator } from "@react-navigation/stack";
import { useUserStore } from "@/store/userStore";
import type { MainStackParamList } from "./types";
import { MainTabNavigator } from "./MainTabNavigator";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ProfileEditScreen } from "../screens/ProfileEditScreen";
import { AccountScreen } from "../screens/AccountScreen";
import { ContactUsScreen } from "../screens/ContactUsScreen";
import { CommunityBoardScreen } from "../screens/CommunityBoardScreen";
import { NewPostScreen } from "../screens/NewPostScreen";
import { SettingsFaqScreen } from "../screens/SettingsFaqScreen";
import { MailInboxScreen } from "../screens/MailInboxScreen";
import { ToneHistoryScreen } from "../screens/ToneHistoryScreen";
import { TwinChatScreen } from "../screens/TwinChatScreen";
import { RankCardScreen } from "../screens/RankCardScreen";
import { ShareableCardsPreviewScreen } from "../screens/ShareableCardsPreviewScreen";
import { PastReportDetailScreen } from "../screens/PastReportDetailScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import { JournalListScreen } from "../screens/JournalListScreen";
import { JournalEditorScreen } from "../screens/JournalEditorScreen";
import { JournalCalendarScreen } from "../screens/JournalCalendarScreen";
import { DayDetailScreen } from "../screens/DayDetailScreen";
import { MissionDetailScreen } from "../screens/MissionDetailScreen";
import { SigilScreen } from "../screens/SigilScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { StreakDetailScreen } from "../screens/StreakDetailScreen";
import { SeasonDetailScreen } from "../screens/SeasonDetailScreen";
import { SeasonCompletionScreen } from "../screens/SeasonCompletionScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { COLORS } from "../constants/theme";

const Stack = createStackNavigator<MainStackParamList>();

export function MainStack() {
  useEffect(() => {
    const { profile, fetchProfile } = useUserStore.getState();
    if (profile === null) {
      void fetchProfile();
    }
  }, []);

  return (
    <BottomSheetModalProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg1 },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="SigilScreen" component={SigilScreen} />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="SettingsProfile" component={ProfileEditScreen} />
        <Stack.Screen name="AccountSettings" component={AccountScreen} />
        <Stack.Screen name="ContactUs" component={ContactUsScreen} />
        <Stack.Screen name="CommunityBoard" component={CommunityBoardScreen} />
        <Stack.Screen name="NewPost" component={NewPostScreen} />
        <Stack.Screen name="SettingsFaq" component={SettingsFaqScreen} />
        <Stack.Screen name="MailInbox" component={MailInboxScreen} />
        <Stack.Screen name="ToneHistory" component={ToneHistoryScreen} />
        <Stack.Screen name="TwinChat" component={TwinChatScreen} />
        <Stack.Screen name="RankCard" component={RankCardScreen} />
        <Stack.Screen name="ShareableCardsPreview" component={ShareableCardsPreviewScreen} />
        <Stack.Screen name="PastReportDetail" component={PastReportDetailScreen} />
        <Stack.Screen name="JournalList" component={JournalListScreen} />
        <Stack.Screen name="JournalEditor" component={JournalEditorScreen} />
        <Stack.Screen name="JournalCalendar" component={JournalCalendarScreen} />
        <Stack.Screen name="DayDetail" component={DayDetailScreen} />
        <Stack.Screen name="MissionDetail" component={MissionDetailScreen} />
        <Stack.Screen
          name="StreakDetail"
          component={StreakDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SeasonDetail"
          component={SeasonDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SeasonCompletion"
          component={SeasonCompletionScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Achievements"
          component={AchievementsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </BottomSheetModalProvider>
  );
}
