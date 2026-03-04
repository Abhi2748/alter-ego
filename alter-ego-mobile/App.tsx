import "./global.css";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { RootStack } from "./src/navigation/RootStack";
import { COLORS } from "./src/constants/theme";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.violet} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: COLORS.violet,
          background: COLORS.bg1,
          card: COLORS.bg1,
          text: COLORS.text,
          border: COLORS.border,
          notification: COLORS.violet,
        },
      }}
    >
      <StatusBar style="light" />
      <RootStack />
    </NavigationContainer>
  );
}
