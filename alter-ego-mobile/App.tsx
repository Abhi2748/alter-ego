import "./global.css";
import {
  useFonts,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { RootStack } from "./src/navigation/RootStack";
import { COLORS } from "./src/constants/theme";

// Suppress React 19 ref warning from dependencies (e.g. React Navigation) until they support ref-as-prop
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : String(args[0]);
  if (msg.includes("Accessing element.ref was removed in React 19")) return;
  originalError.apply(console, args);
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#0D0F1A",
    card: "#0D0F1A",
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_400Regular_Italic,
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <RootStack />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
