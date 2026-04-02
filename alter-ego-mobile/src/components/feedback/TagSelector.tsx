import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { FeedbackTag } from '@/services/feedback';

const OPTIONS: Array<{
  tag: FeedbackTag;
  emoji: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    tag: 'bug',
    emoji: '🐛',
    name: 'Bug',
    desc: "Something's broken",
    color: '#F87171',
    bg: 'rgba(239,68,68,0.09)',
    border: 'rgba(239,68,68,0.4)',
  },
  {
    tag: 'suggestion',
    emoji: '💡',
    name: 'Suggestion',
    desc: 'Make it better',
    color: '#A78BFA',
    bg: 'rgba(139,92,246,0.09)',
    border: 'rgba(139,92,246,0.4)',
  },
  {
    tag: 'question',
    emoji: '❓',
    name: 'Question',
    desc: 'Need clarity',
    color: '#93C5FD',
    bg: 'rgba(59,130,246,0.09)',
    border: 'rgba(59,130,246,0.4)',
  },
  {
    tag: 'praise',
    emoji: '🙌',
    name: 'Praise',
    desc: 'Something you love',
    color: '#6EE7B7',
    bg: 'rgba(16,185,129,0.09)',
    border: 'rgba(16,185,129,0.4)',
  },
];

interface Props {
  selected: FeedbackTag;
  onSelect: (tag: FeedbackTag) => void;
}

export function TagSelector({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {OPTIONS.map((opt) => {
        const isSelected = selected === opt.tag;
        return (
          <TouchableOpacity
            key={opt.tag}
            onPress={() => onSelect(opt.tag)}
            activeOpacity={0.7}
            style={[
              styles.option,
              isSelected ? { backgroundColor: opt.bg, borderColor: opt.border } : null,
            ]}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isSelected ? opt.bg : 'rgba(255,255,255,0.04)' },
              ]}
            >
              <Text style={styles.emoji}>{opt.emoji}</Text>
            </View>
            <View>
              <Text style={[styles.name, { color: isSelected ? opt.color : '#E5E7EB' }]}>{opt.name}</Text>
              <Text style={styles.desc}>{opt.desc}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  option: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#252840',
    backgroundColor: '#13152A',
  },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 15 },
  name: { fontSize: 12, fontWeight: '700' },
  desc: { fontSize: 10, color: '#6B7280', marginTop: 1 },
});
