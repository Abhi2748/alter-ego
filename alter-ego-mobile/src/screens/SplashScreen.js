import React, { useEffect, useRef } from "react";
import { Animated, View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function SplashScreen({ onFinish }) {
  const crackOpacity = useRef(new Animated.Value(0)).current;
  const leftOpacity = useRef(new Animated.Value(0)).current;
  const leftTranslate = useRef(new Animated.Value(-40)).current;
  const rightOpacity = useRef(new Animated.Value(0)).current;
  const rightTranslate = useRef(new Animated.Value(40)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in crack (0–300ms)
    const crackAnim = Animated.timing(crackOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    });

    // Silhouettes (300–800ms)
    const silhouettesAnim = Animated.parallel([
      Animated.timing(leftOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(leftTranslate, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(rightOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(rightTranslate, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    // Tagline (starts at 1s, lasts to 1.5s)
    const taglineAnim = Animated.sequence([
      Animated.delay(1000),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel([crackAnim, silhouettesAnim, taglineAnim]).start();

    const timeout = setTimeout(() => {
      if (onFinish) {
        onFinish();
      }
    }, 2500);

    return () => clearTimeout(timeout);
  }, [crackOpacity, leftOpacity, leftTranslate, rightOpacity, rightTranslate, taglineOpacity, onFinish]);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#0D0F1A", "#07080F"]}
        style={{ flex: 1 }}
      >
        {/* Full-height crack line */}
        <Animated.View
          style={{
            opacity: crackOpacity,
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: "#C084FC",
              shadowColor: "#C084FC",
              shadowOpacity: 0.9,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        </Animated.View>

        {/* Silhouettes in middle-lower area */}
        <View
          className="absolute left-0 right-0"
          style={{
            top: "18%",
            bottom: "18%",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "flex-end",
          }}
        >
          {/* Left silhouette */}
          <Animated.View
            style={{
              opacity: leftOpacity,
              transform: [{ translateX: leftTranslate }],
              width: "35%",
              height: "55%",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              paddingRight: 2,
            }}
          >
            <View className="bg-ae-surface rounded-t-full" style={{ width: "100%", height: "100%" }} />
          </Animated.View>

          {/* Right silhouette */}
          <Animated.View
            style={{
              opacity: rightOpacity,
              transform: [{ translateX: rightTranslate }],
              width: "35%",
              height: "55%",
              alignItems: "flex-start",
              justifyContent: "flex-end",
              paddingLeft: 2,
            }}
          >
            <View className="bg-ae-surface rounded-t-full" style={{ width: "100%", height: "100%" }} />
          </Animated.View>
        </View>

        {/* Tagline in lower third */}
        <View className="absolute bottom-16 left-0 right-0 items-center px-8">
          <Animated.Text
            className="text-ae-text text-base"
            style={{
              opacity: taglineOpacity,
              fontWeight: "400",
              letterSpacing: 0.5,
              textAlign: "center",
            }}
          >
            The you that showed up every day. Meet them.
          </Animated.Text>
        </View>
      </LinearGradient>
    </View>
  );
}

