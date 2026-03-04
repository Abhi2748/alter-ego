import { View, Text } from "react-native";
import { COLORS } from "../constants/theme";

export function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Home</Text>
    </View>
  );
}
