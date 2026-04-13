/**
 * ProfileSeasonScreen
 * Opened from Profile → Seasons nav row.
 * Shows lifetime season stats, current active season card, and season history.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCurrentSeason } from '@/hooks/useSeason';
import type { ProfileStackParamList } from '@/navigation/types';
import type { MainStackParamList } from '@/navigation/types';

// ── Tokens ────────────────────────────────────────────────────────────────
const BG: readonly [string, string] = ['#09091A', '#07080F'];
const SURF   = '#111623';
const BORDER = 'rgba(42,48,80,0.4)';
const TEXT   = '#E5E7EB';
const TEXT2  = '#9CA3AF';
const MUTED  = '#6B7280';
const EMBER  = '#F97316';
const VG     = '#A78BFA';
const GREEN  = '#22C55E';

type Nav = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, 'ProfileSeason'>,
  StackNavigationProp<MainStackParamList>
>;

// ── Tier helpers ────────────────────────────────────────────────────────────
function tierColor(tier: string | null | undefined): string {
  if (tier === 'perfect') return '#FFB800';
  if (tier === 'clear')   return '#94A3B8';
  if (tier === 'partial') return '#FB923C';
  return '#6B7280';
}
function tierLabel(tier: string | null | undefined): string {
  if (tier === 'perfect') return 'Gold';
  if (tier === 'clear')   return 'Silver';
  if (tier === 'partial') return 'Bronze';
  return '—';
}

// ── Season history row ──────────────────────────────────────────────────────
// NOTE: Backend will eventually return a list of past seasons.
// For now we derive what we can from the current season hook.
// When the history API is built, replace this with the real data.

// ── Main component ──────────────────────────────────────────────────────────

export function ProfileSeasonScreen() {
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { data: season } = useCurrentSeason();

  const isActive    = season?.status === 'active';
  const isCompleted = season?.status === 'completed';
  const isFailed    = season?.status === 'failed';

  // Projected / actual tier label + color
  const displayTier  = season?.completion_tier ?? season?.projected_tier ?? null;
  const tierC = tierColor(displayTier);
  const tierL = tierLabel(displayTier);

  // Navigate to full season detail (MainStack)
  const openDetail = () => {
    const parent = (navigation as any).getParent?.();
    const target  = parent ?? navigation;
    target.navigate('SeasonDetail');
  };

  // Navigate to completion screen
  const openCompletion = () => {
    const parent = (navigation as any).getParent?.();
    const target  = parent ?? navigation;
    target.navigate('SeasonCompletion');
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={BG} style={StyleSheet.absoluteFill} />

      {/* Fixed header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Text style={s.backArrow}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Seasons</Text>
          <Text style={s.headerSub}>Your arc history</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 72 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── Lifetime stats ── */}
        <Text style={s.blockLabel}>Lifetime</Text>
        <View style={s.lifetimeRow}>
          {[
            { num: isCompleted || isFailed ? '1' : '0', label: 'Completed', color: '#FFB800' },
            { num: isActive ? '1' : '0',                label: 'Active',    color: TEXT },
            { num: season ? String((season.xp_awarded ?? 0) + (isActive ? 0 : 0)) : '0', label: 'Season XP', color: VG },
            { num: tierL !== '—' ? tierL : '—',         label: 'Best Tier', color: tierC },
          ].map(({ num, label, color }) => (
            <View key={label} style={s.lifeCard}>
              <Text style={[s.lifeNum, { color }]}>{num}</Text>
              <Text style={s.lifeLbl}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Current / active season ── */}
        {isActive && season ? (
          <>
            <Text style={s.blockLabel}>Current Season</Text>
            <Pressable style={s.currentCard} onPress={openDetail}>
              {/* top glow line */}
              <View style={s.currentCardGlow} />
              <View style={s.currentTop}>
                <View>
                  <Text style={s.currentTag}>{`Season ${season.season_number} · ${season.season_name}`}</Text>
                  <Text style={s.currentName}>{season.season_name}</Text>
                  <Text style={s.currentTheme}>"{season.season_theme}"</Text>
                </View>
                <View style={s.dayBlock}>
                  <Text style={[s.dayNum, { color: season.season_color ?? EMBER }]}>{season.current_day}</Text>
                  <Text style={s.dayOf}>of {season.total_days}</Text>
                </View>
              </View>
              {/* mini stats */}
              <View style={s.miniStats}>
                {[
                  { n: season.days_completed, l: 'Done',    c: GREEN },
                  { n: season.days_perfect,   l: 'Perfect', c: TEXT },
                  { n: season.days_missed,    l: 'Missed',  c: season.days_missed > 0 ? EMBER : TEXT2 },
                  { n: tierL,                 l: 'Track',   c: tierC },
                ].map(({ n, l, c }) => (
                  <View key={l} style={s.miniStat}>
                    <Text style={[s.miniStatNum, { color: c }]}>{n}</Text>
                    <Text style={s.miniStatLbl}>{l}</Text>
                  </View>
                ))}
              </View>
              {/* progress bar */}
              <View style={s.barRow}>
                <View style={s.barBg}>
                  <LinearGradient
                    colors={[season.season_color ?? EMBER, `${season.season_color ?? EMBER}CC`]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[s.barFill, { width: `${Math.min(100, (season.current_day / season.total_days) * 100).toFixed(1)}%` as any }]}
                  />
                </View>
                <Text style={[s.barPhase, { color: `${season.season_color ?? EMBER}BB` }]}>
                  {season.phases?.find(p => p.status === 'active')?.name ?? ''}
                </Text>
              </View>
              {/* link row */}
              <View style={s.detailLink}>
                <Text style={[s.detailLinkText, { color: season.season_color ?? EMBER }]}>View Full Season Detail</Text>
                <Text style={[s.detailLinkArrow, { color: season.season_color ?? EMBER }]}>›</Text>
              </View>
            </Pressable>
          </>
        ) : isCompleted || isFailed ? (
          <>
            <Text style={s.blockLabel}>Last Season</Text>
            <Pressable style={s.currentCard} onPress={openCompletion}>
              <View style={s.currentTop}>
                <View>
                  <Text style={[s.currentTag, { color: tierC }]}>{`Season ${season!.season_number} · ${tierL}`}</Text>
                  <Text style={s.currentName}>{season!.season_name}</Text>
                  <Text style={s.currentTheme}>{isFailed ? 'Season ended early.' : 'Completed.'}</Text>
                </View>
                <View style={[s.tierPill, { borderColor: `${tierC}44`, backgroundColor: `${tierC}11` }]}>
                  <Text style={[s.tierPillText, { color: tierC }]}>{tierL}</Text>
                </View>
              </View>
              <View style={s.detailLink}>
                <Text style={[s.detailLinkText, { color: VG }]}>View Results</Text>
                <Text style={[s.detailLinkArrow, { color: VG }]}>›</Text>
              </View>
            </Pressable>
          </>
        ) : null}

        {/* ── History ── */}
        <Text style={s.blockLabel}>History</Text>

        {/* Completed seasons list — populated from API when available */}
        {isCompleted && season ? (
          <View style={s.historyCard}>
            {/* Badge icon */}
            <View style={[s.histBadge, { backgroundColor: `${tierC}11`, borderColor: `${tierC}33` }]}>
              <Svg width={28} height={32} viewBox="0 0 28 32" fill="none">
                <Path
                  d="M14 1L26 5V14C26 22 21 28 14 31C7 28 2 22 2 14V5L14 1Z"
                  fill="none" stroke={tierC} strokeWidth={1.5}
                />
                <Path
                  d="M14 9L15.5 14H20L16.5 16.5L17.8 22L14 19.5L10.2 22L11.5 16.5L8 14H12.5L14 9Z"
                  fill={tierC} opacity={0.85}
                />
              </Svg>
            </View>
            {/* Info */}
            <View style={s.histInfo}>
              <View style={s.histTop}>
                <Text style={s.histName}>{season.season_name}</Text>
                <View style={[s.tierPill, { borderColor: `${tierC}44`, backgroundColor: `${tierC}11` }]}>
                  <Text style={[s.tierPillText, { color: tierC }]}>{tierL}</Text>
                </View>
              </View>
              <Text style={s.histMeta}>{`Season ${season.season_number} · ${season.total_days} days`}</Text>
              <View style={s.histStats}>
                <Text style={s.histStat}>Done <Text style={{ color: TEXT2, fontWeight: '600' }}>{season.days_completed}/{season.total_days}</Text></Text>
                <Text style={s.histStat}>Perfect <Text style={{ color: TEXT2, fontWeight: '600' }}>{season.days_perfect}</Text></Text>
                {season.xp_awarded ? (
                  <Text style={s.histStat}>XP <Text style={{ color: VG, fontWeight: '600' }}>+{season.xp_awarded.toLocaleString()}</Text></Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Empty history state */}
        {!isCompleted && !isFailed ? (
          <View style={s.emptyHistory}>
            <Text style={s.emptyHistoryText}>
              {isActive
                ? `Complete Season ${season?.season_number ?? 1} to begin your history.`
                : 'Your season history will appear here.'}
            </Text>
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(7,8,15,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(42,48,80,0.85)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 22, color: TEXT2, lineHeight: 26 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  headerSub:   { fontSize: 10, color: MUTED, marginTop: 1 },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  blockLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 2, color: MUTED,
    textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },

  // Lifetime
  lifetimeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  lifeCard: {
    flex: 1, backgroundColor: SURF, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center',
  },
  lifeNum: { fontSize: 17, fontWeight: '800', lineHeight: 20, marginBottom: 3 },
  lifeLbl: { fontSize: 8, fontWeight: '600', letterSpacing: 0.5, color: MUTED, textTransform: 'uppercase' },

  // Current season card
  currentCard: {
    backgroundColor: 'rgba(249,115,22,0.05)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 16, padding: 14, marginBottom: 4, overflow: 'hidden',
  },
  currentCardGlow: {
    position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
    backgroundColor: 'rgba(249,115,22,0.35)',
  },
  currentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  currentTag:   { fontSize: 8.5, fontWeight: '700', letterSpacing: 1.5, color: EMBER, textTransform: 'uppercase', marginBottom: 3 },
  currentName:  { fontSize: 16, fontWeight: '700', color: TEXT, fontFamily: undefined },
  currentTheme: { fontSize: 10, color: TEXT2, fontStyle: 'italic', marginTop: 2 },
  dayBlock:     { alignItems: 'flex-end' },
  dayNum:       { fontSize: 26, fontWeight: '800', lineHeight: 28 },
  dayOf:        { fontSize: 10, color: TEXT2 },

  miniStats:   { flexDirection: 'row', gap: 6, marginBottom: 10 },
  miniStat:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 4, alignItems: 'center' },
  miniStatNum: { fontSize: 14, fontWeight: '800', lineHeight: 16, marginBottom: 2 },
  miniStatLbl: { fontSize: 7.5, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },

  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barBg:    { flex: 1, height: 4, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 100 },
  barPhase: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  detailLink:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, backgroundColor: 'rgba(249,115,22,0.07)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)', borderRadius: 9 },
  detailLinkText:  { fontSize: 11, fontWeight: '700' },
  detailLinkArrow: { fontSize: 16, fontWeight: '700', lineHeight: 18 },

  tierPill: { borderWidth: 1, borderRadius: 100, paddingVertical: 3, paddingHorizontal: 10 },
  tierPillText: { fontSize: 10, fontWeight: '700' },

  // History
  historyCard: { backgroundColor: SURF, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  histBadge: { width: 52, height: 60, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  histInfo: { flex: 1 },
  histTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  histName: { fontSize: 13, fontWeight: '700', color: TEXT },
  histMeta: { fontSize: 10, color: TEXT2, marginBottom: 5 },
  histStats: { flexDirection: 'row', gap: 12 },
  histStat:  { fontSize: 10, color: MUTED },

  emptyHistory: {
    paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, borderStyle: 'dashed',
  },
  emptyHistoryText: { fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18 },
});
