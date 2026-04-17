/**
 * Reanimated ↔ react-native-svg bridge.
 *
 * Official docs describe built-in `SVGAdapter` for `transform` and a custom color adapter using
 * `{ type: 0, payload: processColor(...) }` for `fill` / `stroke`:
 * https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedProps/
 *
 * react-native-reanimated@4.1.x does not re-export `SVGAdapter` from the public entry; we keep
 * animated `transform` as a 6-number column-major matrix for react-native-svg (Android-safe).
 */

import Animated, {
  createAnimatedPropAdapter,
  processColor,
} from "react-native-reanimated";
import { Circle, Ellipse, G, Line, Path } from "react-native-svg";

/**
 * Reanimated passes `transform` as a column-major 6-float matrix [a,b,c,d,tx,ty].
 * On Android, leaving that as `transform` can flow into RN's generic processTransform
 * path (expects transform array objects) and crash with:
 * Double cannot be cast to ReadableNativeMap.
 *
 * Forward as native SVG `matrix` instead; this bypasses processTransform and matches
 * react-native-svg's expected internal representation.
 */
export function SVGAdapter(props: Record<string, unknown>) {
  "worklet";
  if (props.transform != null && Array.isArray(props.transform)) {
    const t = props.transform as number[];
    if (t.length >= 6) {
      const [a, b, c, d, e, f] = t;
      props.matrix = [a, b, c, d, e, f];
      props.transform = undefined;
    }
  }
}

export const svgTransformAdapter = SVGAdapter;

/** Docs: useAnimatedProps color adapter for `fill` / `stroke` on SVG. */
export const svgColorAdapter = createAnimatedPropAdapter(
  (props: Record<string, unknown>) => {
    if (Object.keys(props).includes("fill") && props.fill !== undefined) {
      props.fill = { type: 0, payload: processColor(props.fill as string | number) };
    }
    if (Object.keys(props).includes("stroke") && props.stroke !== undefined) {
      props.stroke = { type: 0, payload: processColor(props.stroke as string | number) };
    }
  },
  ["fill", "stroke"]
);

/** Use for any SVG animated props that may include transform and/or animated fill/stroke. */
export const svgAdapters = [SVGAdapter, svgColorAdapter];

export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
export const AnimatedPath = Animated.createAnimatedComponent(Path);
export const AnimatedLine = Animated.createAnimatedComponent(Line);
