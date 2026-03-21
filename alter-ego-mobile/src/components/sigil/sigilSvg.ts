import type React from "react";
import Animated from "react-native-reanimated";
import { G, Circle, Ellipse } from "react-native-svg";

/** Reanimated + RN SVG typings omit `style` on G; runtime supports it. */
export const AnimatedG = Animated.createAnimatedComponent(G) as React.ComponentType<
  React.ComponentProps<typeof G> & { style?: object }
>;
export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
