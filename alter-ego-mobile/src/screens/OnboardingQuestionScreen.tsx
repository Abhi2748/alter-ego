import { View, Text, Pressable } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { OnboardingStackParamList } from "../navigation/types";
import { COLORS, RADIUS } from "../constants/theme";

type Nav = StackNavigationProp<OnboardingStackParamList, "OnboardingQuestion">;
type Route = RouteProp<OnboardingStackParamList, "OnboardingQuestion">;

export function OnboardingQuestionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const questionNumber = route.params?.questionNumber ?? 1;
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700", marginBottom: 16 }}>Question {questionNumber}</Text>
      <Pressable
        onPress={() => navigation.navigate("ArchetypeReveal")}
        style={{ backgroundColor: COLORS.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.card, minWidth: 160, alignItems: "center" }}
      >
        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "600" }}>Next</Text>
      </Pressable>
    </View>
  );
}
