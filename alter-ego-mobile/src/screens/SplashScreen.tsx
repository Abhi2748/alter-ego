import { useEffect } from "react";
import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { COLORS } from "../constants/theme";

type Nav = StackNavigationProp<RootStackParamList, "Splash">;

export function SplashScreen() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    const t = setTimeout(() => navigation.replace("SignUp"), 2500);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: "700" }}>Splash</Text>
    </View>
  );
}
