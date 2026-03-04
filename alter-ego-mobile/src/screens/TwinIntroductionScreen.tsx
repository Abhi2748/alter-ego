import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import { COLORS, RADIUS } from "../constants/theme";

export function TwinIntroductionScreen() {
  const navigation = useNavigation();
  const goToMain = () => {
    const root = navigation.getParent();
    if (root) {
      root.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" }],
        })
      );
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700", marginBottom: 16 }}>Twin Introduction</Text>
      <Pressable
        onPress={goToMain}
        style={{ backgroundColor: COLORS.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.card, minWidth: 160, alignItems: "center" }}
      >
        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "600" }}>Enter</Text>
      </Pressable>
    </View>
  );
}
