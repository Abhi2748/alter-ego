import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { triggerUpvoteHaptic } from "@/utils/haptics";

interface Props {
  count: number;
  voted: boolean;
  onPress: () => void;
}

export function UpvoteButton({ count, voted, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    void triggerUpvoteHaptic();

    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 30 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.btn, voted && styles.btnVoted]}
    >
      <Animated.Text style={[styles.arrow, { transform: [{ scale }] }, voted && styles.arrowVoted]}>
        ↑
      </Animated.Text>
      <Text style={[styles.count, voted && styles.countVoted]}>{count}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3050',
    backgroundColor: '#1E2333',
  },
  btnVoted: {
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderColor: 'rgba(139,92,246,0.4)',
  },
  arrow: { fontSize: 14, color: '#6B7280', lineHeight: 18 },
  arrowVoted: { color: '#A78BFA' },
  count: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  countVoted: { color: '#A78BFA' },
});
