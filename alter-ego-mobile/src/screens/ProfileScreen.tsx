import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { COLORS, RADIUS } from "../constants/theme";

export function ProfileScreen() {
  const navigation = useNavigation();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700", marginBottom: 16 }}>Profile</Text>
      <Pressable
        onPress={() => navigation.getParent()?.navigate("Settings" as never)}
        style={{ backgroundColor: COLORS.surface, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.card, minWidth: 160, alignItems: "center" }}
      >
        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "600" }}>Settings</Text>
      </Pressable>
    </View>
  );
}
