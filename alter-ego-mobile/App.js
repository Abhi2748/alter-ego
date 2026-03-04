import "./global.css";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-ae-bg1">
      <Text className="text-ae-text font-bold text-2xl">ALTER EGO</Text>
      <StatusBar style="light" />
    </View>
  );
}
