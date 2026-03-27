/**
 * Full-screen streak seal — timings & visuals from ALTER_EGO_StreakAnimation.html
 * Triggered when backend returns streak_animation.show after mission complete.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop as SvgStop,
  Text as SvgText,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import {
  getStreakVisualTier,
  getOrdinalDayLabel,
  STREAK_MILESTONE_SUB,
} from "@/constants/streakAnimationTiers";
import { StreakOrnament } from "@/components/streak/StreakOrnament";
import { BloomRadialGlow } from "@/components/streak/BloomRadialGlow";
import { parseRgba, rgbaToRgb } from "@/components/streak/parseRgba";

const STAGE_W = 360;
const STAGE_H = 460;
const AUTO_DISMISS_MS = 5000;
const OUT_MS = 350;

const EASE_MAIN = Easing.bezier(0.2, 0.8, 0.3, 1);
const EASE_STAMP = Easing.bezier(0.3, 0.9, 0.4, 1);

type Props = {
  visible: boolean;
  streakCount: number;
  onDismiss: () => void;
};

function SealRing({
  size,
  tier,
  innerGradId,
}: {
  size: number;
  tier: ReturnType<typeof getStreakVisualTier>;
  innerGradId: string;
}) {
  const c = tier.ringColor;
  const ic = parseRgba(tier.ringInnerColor);
  const icRgb = rgbaToRgb(ic);
  const r1 = size / 2 - 4;
  const r2 = size / 2 - 16;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <SvgRadialGradient id={innerGradId} cx="50%" cy="44%" r="68%">
          <SvgStop offset="0%" stopColor={icRgb} stopOpacity={Math.min(1, ic.a * 1.8)} />
          <SvgStop offset="42%" stopColor={icRgb} stopOpacity={ic.a * 0.45} />
          <SvgStop offset="78%" stopColor={icRgb} stopOpacity={ic.a * 0.08} />
          <SvgStop offset="100%" stopColor={icRgb} stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r1} fill="none" stroke={c} strokeWidth={1.5} opacity={0.8} />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r2}
        fill={`url(#${innerGradId})`}
        stroke={c}
        strokeWidth={0.6}
        opacity={0.92}
      />
      {[0, 90, 180, 270].map((deg) => {
        const a = (deg * Math.PI) / 180 - Math.PI / 2;
        const mx = size / 2 + (r1 - 1) * Math.cos(a);
        const my = size / 2 + (r1 - 1) * Math.sin(a);
        return <Circle key={deg} cx={mx} cy={my} r={2.5} fill={c} opacity={0.8} />;
      })}
      {[45, 135, 225, 315].map((deg) => {
        const a = (deg * Math.PI) / 180 - Math.PI / 2;
        const mx = size / 2 + (r1 - 1) * Math.cos(a);
        const my = size / 2 + (r1 - 1) * Math.sin(a);
        return <Circle key={deg} cx={mx} cy={my} r={1.2} fill={c} opacity={0.5} />;
      })}
    </Svg>
  );
}

export function StreakAchievementOverlay({ visible, streakCount, onDismiss }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const tier = useMemo(() => getStreakVisualTier(streakCount), [streakCount]);
  const { streakStr, numW, numH } = useMemo(() => {
    const str = String(streakCount);
    const ns = tier.numSize;
    const len = str.length;
    return {
      streakStr: str,
      numW: Math.max(ns * 0.72 * len + ns * 0.28, ns * 1.1),
      numH: ns * 1.1,
    };
  }, [streakCount, tier.numSize]);
  const innerSealGradId = useMemo(() => `seal_inner_${streakCount}`, [streakCount]);
  const numLinearGradId = useMemo(() => `streak_num_grad_${streakCount}`, [streakCount]);
  const glowRgb = useMemo(() => parseRgba(tier.glowColor), [tier.glowColor]);
  const layoutScale = Math.min((winW * 0.92) / STAGE_W, (winH * 0.72) / STAGE_H, 1.12);
  const bloomGradId = useMemo(() => `bloom_${streakCount}_${tier.bloomSize}`, [streakCount, tier.bloomSize]);

  const overlayOpacity = useSharedValue(0);
  const bloomScale = useSharedValue(0.3);
  const bloomOpacity = useSharedValue(0);
  const shockScale = useSharedValue(0.6);
  const shockOpacity = useSharedValue(0);
  const ringStamp = useSharedValue(0);
  const heroStamp = useSharedValue(0);
  const flameOp = useSharedValue(0);
  const flameScale = useSharedValue(0.5);
  const badgeOp = useSharedValue(0);
  const labelOp = useSharedValue(0);
  const dismissOp = useSharedValue(0);
  const numGlowPulse = useSharedValue(0);
  const spin = useSharedValue(0);
  const spinRev = useSharedValue(0);

  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnimatedRef = useRef(closeAnimated);
  closeAnimatedRef.current = closeAnimated;

  const startSpin = useCallback(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: tier.spinSpeed * 1000, easing: Easing.linear }),
      -1,
      false
    );
    spinRev.value = withRepeat(
      withTiming(-360, { duration: tier.spinSpeed * 1400, easing: Easing.linear }),
      -1,
      false
    );
  }, [spin, spinRev, tier.spinSpeed]);

  const resetAndPlay = useCallback(() => {
    cancelAnimation(overlayOpacity);
    cancelAnimation(bloomScale);
    cancelAnimation(bloomOpacity);
    cancelAnimation(shockScale);
    cancelAnimation(shockOpacity);
    cancelAnimation(ringStamp);
    cancelAnimation(heroStamp);
    cancelAnimation(flameOp);
    cancelAnimation(flameScale);
    cancelAnimation(badgeOp);
    cancelAnimation(labelOp);
    cancelAnimation(dismissOp);
    cancelAnimation(numGlowPulse);
    cancelAnimation(spin);
    cancelAnimation(spinRev);

    overlayOpacity.value = 0;
    bloomScale.value = 0.3;
    bloomOpacity.value = 0;
    shockScale.value = 0.6;
    shockOpacity.value = 0;
    ringStamp.value = 0;
    heroStamp.value = 0;
    flameOp.value = 0;
    flameScale.value = 0.5;
    badgeOp.value = 0;
    labelOp.value = 0;
    dismissOp.value = 0;
    numGlowPulse.value = 0;
    spin.value = 0;
    spinRev.value = 0;

    overlayOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
    bloomOpacity.value = withTiming(1, { duration: 800, easing: EASE_MAIN });
    bloomScale.value = withTiming(1, { duration: 800, easing: EASE_MAIN });

    shockOpacity.value = withDelay(
      720,
      withSequence(
        withTiming(0.7, { duration: 0 }),
        withTiming(0, { duration: 550, easing: Easing.bezier(0.2, 0.6, 0.3, 1) })
      )
    );
    shockScale.value = withDelay(
      720,
      withTiming(3.5, { duration: 550, easing: Easing.bezier(0.2, 0.6, 0.3, 1) })
    );

    ringStamp.value = withDelay(380, withTiming(1, { duration: 450, easing: EASE_MAIN }));
    heroStamp.value = withDelay(550, withTiming(1, { duration: 500, easing: EASE_STAMP }));
    flameOp.value = withDelay(480, withTiming(1, { duration: 450, easing: Easing.out(Easing.ease) }));
    flameScale.value = withDelay(
      480,
      withSequence(
        withTiming(1.2, { duration: 270, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 180, easing: Easing.inOut(Easing.ease) })
      )
    );
    badgeOp.value = withDelay(900, withTiming(1, { duration: 350, easing: EASE_STAMP }));
    labelOp.value = withDelay(1000, withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) }));
    dismissOp.value = withDelay(1500, withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) }));

    numGlowPulse.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1250, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );

    startSpin();
  }, [
    overlayOpacity,
    bloomScale,
    bloomOpacity,
    shockScale,
    shockOpacity,
    ringStamp,
    heroStamp,
    flameOp,
    flameScale,
    badgeOp,
    labelOp,
    dismissOp,
    numGlowPulse,
    spin,
    spinRev,
    startSpin,
  ]);

  const closeAnimated = useCallback(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    overlayOpacity.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  }, [overlayOpacity, onDismiss]);

  closeAnimatedRef.current = closeAnimated;

  useEffect(() => {
    if (!visible) {
      if (autoTimer.current) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
      }
      return;
    }
    resetAndPlay();
    autoTimer.current = setTimeout(() => {
      closeAnimatedRef.current();
    }, AUTO_DISMISS_MS);
    return () => {
      if (autoTimer.current) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
      }
    };
    // closeAnimated omitted on purpose — stable ref; resetAndPlay is stable for a given streakCount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, streakCount, resetAndPlay]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: bloomScale.value }],
  }));
  const shockStyle = useAnimatedStyle(() => ({
    opacity: shockOpacity.value,
    transform: [{ scale: shockScale.value }],
  }));
  const ringWrapStyle = useAnimatedStyle(() => ({
    opacity: ringStamp.value,
    transform: [
      { scale: 0.82 + ringStamp.value * 0.18 },
      { rotate: `${(1 - ringStamp.value) * -4}deg` },
    ],
  }));
  const heroStyle = useAnimatedStyle(() => {
    const t = heroStamp.value;
    const y = (1 - t) * -22 + (t < 0.55 ? 3 * (t / 0.55) : 0);
    // Subtle scale only — large scale + shadows on SVG caused iOS glyph ghosting.
    const s = t < 0.55 ? 1.03 - 0.03 * (t / 0.55) : 1;
    return {
      opacity: t,
      transform: [{ translateY: y }, { scale: s }],
    };
  });
  const flameStyle = useAnimatedStyle(() => ({
    opacity: flameOp.value,
    transform: [{ scale: flameScale.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeOp.value }));
  const labelsStyle = useAnimatedStyle(() => ({ opacity: labelOp.value }));
  const dismissStyle = useAnimatedStyle(() => ({ opacity: dismissOp.value }));
  /** Soft halo behind the digit — opacity only (no shadowRadius on SVG parent). */
  const numHaloStyle = useAnimatedStyle(() => {
    const t = numGlowPulse.value;
    return {
      opacity: 0.14 + t * 0.22,
      transform: [{ scale: 1 + t * 0.06 }],
    };
  });
  const spinOuterStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const spinInnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRev.value}deg` }],
  }));

  const milestoneSub =
    streakCount >= 30 ? STREAK_MILESTONE_SUB[streakCount as keyof typeof STREAK_MILESTONE_SUB] : "";

  if (!visible) return null;

  const sSize = 220;
  const s2Size = 180;
  const ringSize = 160;
  const halfBloom = tier.bloomSize / 2;
  const haloSize = Math.min(numW, numH) * 0.92;
  const haloLeft = (numW - haloSize) / 2;
  const haloTop = (numH - haloSize) / 2;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Pressable style={styles.fill} onPress={closeAnimated}>
        <Animated.View style={[styles.fill, overlayStyle]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(3,3,11,0.93)" }]} />
          )}
          <View style={styles.overlayCenter} pointerEvents="box-none">
            <View
              style={[
                styles.stage,
                {
                  transform: [{ scale: layoutScale }],
                  width: STAGE_W,
                  height: STAGE_H,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.bloomWrap,
                  {
                    width: tier.bloomSize,
                    height: tier.bloomSize,
                    marginLeft: -halfBloom,
                    marginTop: -halfBloom,
                  },
                  bloomStyle,
                ]}
                pointerEvents="none"
              >
                <BloomRadialGlow
                  size={tier.bloomSize}
                  bloomColor={tier.bloomColor}
                  gradientId={bloomGradId}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.shock,
                  {
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: 1.5,
                    borderColor: tier.shockColor,
                    top: "50%",
                    left: "50%",
                    marginLeft: -70,
                    marginTop: -70,
                  },
                  shockStyle,
                ]}
                pointerEvents="none"
              />

              <CornerMarks color={tier.ringColor} />

              <View
                style={[styles.spinWrap, { width: sSize, height: sSize, marginLeft: -sSize / 2, marginTop: -sSize / 2 }]}
                pointerEvents="none"
              >
                <Animated.View style={spinOuterStyle}>
                  <Svg width={sSize} height={sSize} viewBox={`0 0 ${sSize} ${sSize}`}>
                    <Circle
                      cx={sSize / 2}
                      cy={sSize / 2}
                      r={sSize / 2 - 2}
                      fill="none"
                      stroke={tier.outerColor}
                      strokeWidth={0.8}
                      strokeDasharray={tier.outerDash}
                    />
                  </Svg>
                </Animated.View>
              </View>

              <View
                style={[styles.spinWrap, { width: s2Size, height: s2Size, marginLeft: -s2Size / 2, marginTop: -s2Size / 2 }]}
                pointerEvents="none"
              >
                <Animated.View style={spinInnerStyle}>
                  <Svg width={s2Size} height={s2Size} viewBox={`0 0 ${s2Size} ${s2Size}`}>
                    <Circle
                      cx={s2Size / 2}
                      cy={s2Size / 2}
                      r={s2Size / 2 - 2}
                      fill="none"
                      stroke={tier.outerColor}
                      strokeWidth={0.5}
                      strokeDasharray="1 14"
                      opacity={0.5}
                    />
                  </Svg>
                </Animated.View>
              </View>

              {tier.ornament ? (
                <View style={styles.ornamentWrap} pointerEvents="none">
                  <StreakOrnament type={tier.ornament} tier={tier} />
                </View>
              ) : null}

              <Animated.View
                style={[
                  styles.ringCenter,
                  { width: ringSize, height: ringSize, marginLeft: -ringSize / 2, marginTop: -ringSize / 2 },
                  ringWrapStyle,
                ]}
                pointerEvents="none"
              >
                <SealRing size={ringSize} tier={tier} innerGradId={innerSealGradId} />
              </Animated.View>

              <View style={styles.centerStack} pointerEvents="none">
                <View style={styles.centerStackInner}>
                  <Animated.View style={[styles.heroCol, heroStyle]}>
                    {tier.badge ? (
                      <Animated.View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: tier.badge.bg,
                            borderColor: tier.badge.border,
                          },
                          badgeStyle,
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: tier.badge.color }]}>{tier.badge.text}</Text>
                      </Animated.View>
                    ) : null}
                    <Animated.Text style={[styles.flame, { fontSize: tier.flameSize }, flameStyle]}>
                      🔥
                    </Animated.Text>
                    <View
                      style={[styles.numHeroOuter, { width: numW, height: numH }]}
                      collapsable={false}
                    >
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.numHalo,
                          {
                            width: haloSize,
                            height: haloSize,
                            left: haloLeft,
                            top: haloTop,
                            borderRadius: haloSize / 2,
                            backgroundColor: `rgba(${glowRgb.r},${glowRgb.g},${glowRgb.b},0.35)`,
                          },
                          numHaloStyle,
                        ]}
                      />
                      <Svg
                        width={numW}
                        height={numH}
                        viewBox={`0 0 ${numW} ${numH}`}
                        style={styles.numSvg}
                      >
                        <Defs>
                          <SvgLinearGradient id={numLinearGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                            {tier.numGradient.map((col, i, arr) => (
                              <SvgStop
                                key={i}
                                offset={`${(i / Math.max(1, arr.length - 1)) * 100}%`}
                                stopColor={col}
                              />
                            ))}
                          </SvgLinearGradient>
                        </Defs>
                        <SvgText
                          x={numW / 2}
                          y={numH * 0.5}
                          textAnchor="middle"
                          alignmentBaseline="central"
                          dominantBaseline="central"
                          fontSize={tier.numSize}
                          fontWeight="800"
                          letterSpacing={streakStr.length <= 2 ? 0 : streakStr.length <= 3 ? -1 : -2}
                          fill={`url(#${numLinearGradId})`}
                          fontFamily={Platform.select({
                            ios: "Inter_800ExtraBold",
                            android: "Inter_800ExtraBold",
                            default: "System",
                          })}
                        >
                          {streakStr}
                        </SvgText>
                      </Svg>
                    </View>
                  </Animated.View>

                  <Animated.View style={[styles.labelBlock, labelsStyle]}>
                    <Text
                      style={[
                        styles.labelStreak,
                        {
                          color: tier.streakLabelColor,
                          textShadowColor: "rgba(139,92,246,0.22)",
                          textShadowOffset: { width: 0, height: 0 },
                          textShadowRadius: 10,
                        },
                      ]}
                    >
                      DAY STREAK
                    </Text>
                    <Text style={styles.labelDay}>{getOrdinalDayLabel(streakCount)}</Text>
                    {milestoneSub ? (
                      <Text style={[styles.labelSub, { color: tier.streakLabelColor }]}>{milestoneSub}</Text>
                    ) : null}
                  </Animated.View>
                </View>
              </View>

              <Animated.Text style={[styles.dismiss, dismissStyle]}>tap to continue</Animated.Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function CornerMarks({ color }: { color: string }) {
  const mk = (right: boolean, bottom: boolean, style: object) => (
    <View style={style} pointerEvents="none">
      <View
        style={{
          position: "absolute",
          [right ? "right" : "left"]: 0,
          [bottom ? "bottom" : "top"]: 0,
          width: 1,
          height: 12,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
      <View
        style={{
          position: "absolute",
          [right ? "right" : "left"]: 0,
          [bottom ? "bottom" : "top"]: 0,
          width: 12,
          height: 1,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
    </View>
  );
  return (
    <>
      {mk(false, false, { position: "absolute", top: 60, left: 60, width: 12, height: 12 })}
      {mk(true, false, { position: "absolute", top: 60, right: 60, width: 12, height: 12 })}
      {mk(false, true, { position: "absolute", bottom: 90, left: 60, width: 12, height: 12 })}
      {mk(true, true, { position: "absolute", bottom: 90, right: 60, width: 12, height: 12 })}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlayCenter: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  stage: {
    position: "relative",
    overflow: "visible",
  },
  bloomWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    overflow: "visible",
    zIndex: 0,
  },
  centerStack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 12,
  },
  centerStackInner: {
    alignItems: "center",
    maxWidth: 320,
    paddingHorizontal: 8,
  },
  shock: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 1,
  },
  spinWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    zIndex: 3,
  },
  ornamentWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 320,
    height: 320,
    marginLeft: -160,
    marginTop: -160,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  ringCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    zIndex: 8,
  },
  heroCol: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  numHeroOuter: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    backgroundColor: "transparent",
    position: "relative",
  },
  numHalo: {
    position: "absolute",
    zIndex: 0,
  },
  numSvg: {
    position: "relative",
    zIndex: 1,
  },
  flame: {
    marginBottom: 2,
    textShadowColor: "rgba(249,115,22,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
  },
  labelBlock: {
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 16,
    width: "100%",
  },
  labelStreak: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  labelDay: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#9CA3AF",
    marginTop: 4,
    opacity: 0.92,
  },
  labelSub: {
    fontSize: 10,
    letterSpacing: 0.5,
    fontStyle: "italic",
    opacity: 0.65,
    textAlign: "center",
    maxWidth: 240,
    marginTop: 3,
    textTransform: "none",
  },
  dismiss: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#6B7280",
    zIndex: 20,
    opacity: 0.9,
  },
});
