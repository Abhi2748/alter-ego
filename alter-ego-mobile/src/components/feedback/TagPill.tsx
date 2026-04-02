import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FeedbackTag } from '@/services/feedback';

const TAG_CONFIG: Record<
  FeedbackTag,
  { label: string; color: string; bg: string; border: string }
> = {
  bug: { label: 'Bug', color: '#F87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)' },
  suggestion: {
    label: 'Suggestion',
    color: '#A78BFA',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.28)',
  },
  question: {
    label: 'Question',
    color: '#93C5FD',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.28)',
  },
  praise: {
    label: 'Praise',
    color: '#6EE7B7',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.28)',
  },
};

export function TagPill({ tag }: { tag: FeedbackTag }) {
  const cfg = TAG_CONFIG[tag];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
});
