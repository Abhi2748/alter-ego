import type { SharedValue } from "react-native-reanimated";
import { useAnimatedStyle } from "react-native-reanimated";

const CX = 170;
const CY = 170;

/** Rotate SVG group around canvas centre (no `origin` prop — RN SVG types). */
export function useRotateCenterStyle(rotationDeg: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: CX },
      { translateY: CY },
      { rotate: `${rotationDeg.value}deg` },
      { translateX: -CX },
      { translateY: -CY },
    ],
  }));
}
