/**
 * SeasonBanner — compact strip shown on Home between XP/PF bars and CORE section.
 * Tapping navigates to SeasonDetailScreen.
 * Renders nothing if no season data is available.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CurrentSeason } from '@/services/season';

interface SeasonBannerProps {
  season: CurrentSeason;
  onPress: () => void;
}

const TEXT_PRIMARY = '#E5E7EB';
const TEXT_MUTED = '#6B7280';

export function SeasonBanner({ season, onPress }: SeasonBannerProps) {
  const progressPct = Math.min(1, season.current_day / season.total_days);
  const currentPhase = season.phases.find(p => p.status === 'active');
  const phaseName = currentPhase?.name ?? '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Season ${season.season_number}: ${season.season_name}. Day ${season.current_day} of ${season.total_days}. Phase: ${phaseName}.`}
    >
      {/* Top glow line */}
      <View style={styles.glowLine} pointerEvents="none" />

      {/* Top row: icon + meta + day counter */}
      <View style={styles.topRow}>
        <View style={[styles.iconDot, { borderColor: `${season.season_color}55` }]}>
          <Text style={[styles.iconEmoji, { color: season.season_color }]}>✦</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={[styles.eyebrow, { color: season.season_color }]} numberOfLines={1}>
            {`Season ${season.season_number} · ${season.season_name}`}
          </Text>
          <Text style={styles.theme} numberOfLines={1}>
            {season.season_theme}
          </Text>
        </View>

        <View style={styles.dayBlock}>
          <Text style={[styles.dayNum, { color: season.season_color }]}>
            {season.current_day}
          </Text>
          <Text style={styles.dayOf}>/ {season.total_days}</Text>
        </View>
      </View>

      {/* Bottom row: progress bar + phase tag */}
      <View style={styles.bottomRow}>
        <View style={styles.barTrack}>
          <LinearGradient
            colors={[season.season_color, `${season.season_color}CC`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${(progressPct * 100).toFixed(1)}%` as any }]}
          />
        </View>
        {phaseName ? (
          <Text style={[styles.phaseTag, { color: `${season.season_color}CC` }]} numberOfLines={1}>
            {`Ph${season.current_phase} · ${phaseName}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: 'rgba(249,115,22,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.82 },
  glowLine: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 1,
    backgroundColor: 'rgba(249,115,22,0.35)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 9,
  },
  iconDot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 12 },
  metaBlock: { flex: 1 },
  eyebrow: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  theme: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    marginTop: 1,
  },
  dayBlock: { alignItems: 'flex-end', flexShrink: 0 },
  dayNum: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  dayOf: { fontSize: 10, fontWeight: '500', color: TEXT_MUTED },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: {
    flex: 1,
    height: 3.5,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 100 },
  phaseTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
});
