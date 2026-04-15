/**
 * SeasonDetailScreen — full-screen season detail.
 * Opened from SeasonBanner on HomeScreen.
 * Fixed sticky header with back button + season title.
 * Scrollable body: progress ring, phases, mission targets, twin comparison, day log.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useCurrentSeason } from '@/hooks/useSeason';
import type { SeasonDayLog, SeasonPhaseTarget } from '@/services/season';

// ── Design tokens ─────────────────────────────────────────────────────────
const BG_GRADIENT: readonly [string, string] = ['#09091A', '#07080F'];
const SURFACE = '#111320';
const BORDER = '#1A2030';
const TEXT_PRIMARY = '#E8EAF0';
const TEXT2 = '#8B8FA8';
const MUTED = '#4B5066';
const VIOLET = '#8B5CF6';
const DANGER = '#7F1D1D';

const SCREEN_W = Dimensions.get('window').width;
const RING_SIZE = 96;
const RING_STROKE = 8;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
// Each day cell width: 10 per row, 20px padding each side, 5px gap * 9 gaps
const CELL_W = (SCREEN_W - 40 - 45) / 10;

// ── Sub-components ────────────────────────────────────────────────────────

function ProgressRing({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(1, current / total) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - pct);
  return (
    <View style={ringStyles.wrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={`${color}AA`} />
          </SvgGradient>
        </Defs>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke="rgba(255,255,255,0.05)" strokeWidth={RING_STROKE} fill="none" />
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke="url(#ringGrad)" strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round" />
      </Svg>
      <View style={ringStyles.label}>
        <Text style={ringStyles.num}>{current}</Text>
        <Text style={ringStyles.sub}>of <Text style={[ringStyles.subBold, { color }]}>{total}</Text></Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: RING_SIZE, height: RING_SIZE, position: 'relative', flexShrink: 0 },
  label: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, lineHeight: 26 },
  sub: { fontSize: 9.5, color: TEXT2, marginTop: 2 },
  subBold: { fontWeight: '700' },
});

function TargetRow({ target }: { target: SeasonPhaseTarget }) {
  return (
    <View style={targetStyles.row}>
      <View style={[targetStyles.icon, { backgroundColor: target.icon_bg_color }]}>
        <Text style={targetStyles.iconText}>{target.icon}</Text>
      </View>
      <View style={targetStyles.body}>
        <Text style={targetStyles.name}>{target.mission}</Text>
        <Text style={targetStyles.now}>{target.target}</Text>
        {target.next_phase_target ? (
          <Text style={targetStyles.next}>→ Next phase: {target.next_phase_target}</Text>
        ) : null}
      </View>
    </View>
  );
}

const targetStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 10, marginBottom: 7,
  },
  icon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText: { fontSize: 14 },
  body: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  now: { fontSize: 11, color: TEXT2, marginTop: 1 },
  next: { fontSize: 9.5, color: 'rgba(249,115,22,0.55)', marginTop: 2 },
});

function DayCell({ entry, color }: { entry: SeasonDayLog; color: string }) {
  const bg =
    entry.status === 'perfect' ? color :
    entry.status === 'complete' ? 'rgba(109,40,217,0.38)' :
    entry.status === 'missed' ? 'rgba(127,29,29,0.62)' :
    entry.status === 'today' ? '#1E2333' :
    'rgba(17,24,39,0.65)';
  const textColor =
    entry.status === 'perfect' ? '#fff' :
    entry.status === 'complete' ? '#C4B5FD' :
    entry.status === 'missed' ? '#FCA5A5' :
    entry.status === 'today' ? color :
    MUTED;
  const borderColor =
    entry.status === 'today' ? `${color}AA` :
    entry.status === 'complete' ? 'rgba(139,92,246,0.45)' :
    entry.status === 'missed' ? 'rgba(127,29,29,0.95)' :
    'transparent';
  return (
    <View style={[dayCellStyles.cell, { backgroundColor: bg, borderColor, width: CELL_W }]}>
      <Text style={[dayCellStyles.num, { color: textColor }]}>{entry.day_number}</Text>
    </View>
  );
}

const dayCellStyles = StyleSheet.create({
  cell: { aspectRatio: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  num: { fontSize: 7.5, fontWeight: '600' },
});

// ── Main screen ───────────────────────────────────────────────────────────

export function SeasonDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { data: season, isLoading } = useCurrentSeason();

  const activePhase = useMemo(
    () => season?.phases.find(p => p.status === 'active') ?? null,
    [season]
  );

  const projectedTierColor =
    season?.projected_tier === 'perfect' ? '#FFD700' :
    season?.projected_tier === 'clear' ? '#94A3B8' :
    season?.projected_tier === 'partial' ? '#D97706' : DANGER;

  const projectedTierLabel =
    season?.projected_tier === 'perfect' ? 'Gold · Perfect' :
    season?.projected_tier === 'clear' ? 'Silver · Clear' :
    season?.projected_tier === 'partial' ? 'Bronze · Partial' : 'At Risk';

  const dayLog = season?.day_log ?? [];
  const headerHeight = insets.top + 56;

  if (isLoading || !season) {
    return (
      <View style={s.container}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
        <View style={s.loadingWrap}>
          <Text style={s.loadingText}>Loading season…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

      {/* ── Fixed header ── */}
      <View style={[s.header, { height: headerHeight }]}>
        <View style={s.headerBg} />
        <View style={[s.headerRow, { paddingTop: insets.top }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8} accessibilityRole="button">
            <Text style={s.backArrow}>‹</Text>
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>{season.season_name}</Text>
            <Text style={[s.headerSub, { color: season.season_color }]}>
              {`Season ${season.season_number} · Day ${season.current_day} of ${season.total_days}`}
            </Text>
          </View>
          <View style={s.headerSpacer} />
        </View>
        <View style={s.headerBorder} />
      </View>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={{ flex: 1, marginTop: headerHeight }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={[s.eyebrow, { color: season.season_color }]}>
            Season {season.season_number} of Your Journey
          </Text>
          <Text style={s.heroTitle}>{season.season_name}</Text>
          <Text style={s.heroTheme}>"{season.season_theme}"</Text>

          <View style={s.ringBlock}>
            <ProgressRing current={season.current_day} total={season.total_days} color={season.season_color} />
            <View style={s.statsCol}>
              {[
                { label: 'Days completed', value: `${season.days_completed} / ${season.current_day}`, color: VIOLET },
                { label: 'Perfect days', value: `${season.days_perfect}`, color: TEXT_PRIMARY },
                { label: 'Days missed', value: `${season.days_missed}`, color: season.days_missed > 0 ? DANGER : TEXT2 },
                { label: 'Days remaining', value: `${season.total_days - season.current_day}`, color: TEXT2 },
                { label: 'On track for', value: projectedTierLabel, color: projectedTierColor },
              ].map(({ label, value, color }) => (
                <View key={label} style={s.statRow}>
                  <Text style={s.statL}>{label}</Text>
                  <Text style={[s.statV, { color }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Phases */}
        <View style={s.section}>
          <Text style={s.blockLabel}>Phases</Text>
          <View style={s.phaseRow}>
            {season.phases.map((phase) => (
              <View key={phase.phase_number} style={[
                s.phasePill,
                phase.status === 'done' && s.phaseDone,
                phase.status === 'active' && s.phaseActive,
              ]}>
                <Text style={[
                  s.phaseNum,
                  phase.status === 'done' && { color: VIOLET },
                  phase.status === 'active' && { color: season.season_color },
                  phase.status === 'upcoming' && { color: MUTED },
                ]}>
                  {phase.status === 'done' ? `✓ Ph${phase.phase_number}` : `Phase ${phase.phase_number}`}
                </Text>
                <Text style={[
                  s.phaseName,
                  phase.status === 'done' && { color: 'rgba(167,139,250,0.9)' },
                  phase.status === 'active' && { color: `${season.season_color}CC` },
                  phase.status === 'upcoming' && { color: MUTED },
                ]}>{phase.name}</Text>
                <Text style={s.phaseDays}>Days {phase.days_start}–{phase.days_end}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.divider} />

        {/* Active phase targets */}
        {activePhase ? (
          <View style={s.section}>
            <View style={s.targetsHeader}>
              <Text style={s.blockLabel}>Phase {activePhase.phase_number} Targets</Text>
              <View style={s.phaseChip}>
                <Text style={[s.phaseChipText, { color: season.season_color }]}>
                  {activePhase.name} · Day {activePhase.days_in_phase}/{activePhase.days_total_phase}
                </Text>
              </View>
            </View>
            {activePhase.targets.map((t) => <TargetRow key={t.mission} target={t} />)}
          </View>
        ) : null}

        <View style={s.divider} />

        {/* Twin comparison */}
        <View style={s.section}>
          <Text style={s.blockLabel}>Season Progress vs. Twin</Text>
          <View style={s.twinCard}>
            <View style={s.twinRow}>
              <View style={s.twinSide}>
                <Text style={[s.twinWho, { color: '#A78BFA' }]}>You</Text>
                <Text style={[s.twinDay, { color: TEXT_PRIMARY }]}>{season.twin_comparison.user_days_complete}</Text>
                <Text style={s.twinDaySub}>days complete</Text>
              </View>
              <Text style={s.vs}>vs</Text>
              <View style={s.twinSide}>
                <Text style={[s.twinWho, { color: MUTED }]}>Shadow Twin</Text>
                <Text style={[s.twinDay, { color: TEXT2 }]}>{season.twin_comparison.twin_days_complete}</Text>
                <Text style={s.twinDaySub}>days complete</Text>
              </View>
            </View>
            <View style={s.twinMsg}>
              <Text style={s.twinMsgText}>"{season.twin_comparison.twin_message}"</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Day log */}
        <View style={s.section}>
          <Text style={s.blockLabel}>Season Log</Text>
          <View style={s.dayGrid}>
            {dayLog.map((entry) => <DayCell key={entry.day_number} entry={entry} color={season.season_color} />)}
          </View>
          <View style={s.legend}>
            {[
              { label: 'Perfect', bg: season.season_color },
              { label: 'Complete', bg: 'rgba(109,40,217,0.38)' },
              { label: 'Missed', bg: 'rgba(127,29,29,0.62)' },
              { label: 'Today', bg: '#1E2333' },
              { label: 'Upcoming', bg: 'rgba(17,24,39,0.65)' },
            ].map(({ label, bg }) => (
              <View key={label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: bg }]} />
                <Text style={s.legendLbl}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: MUTED },

  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,9,15,0.92)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  headerBorder: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerSpacer: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  backArrow: { fontSize: 22, color: TEXT2, lineHeight: 26 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 1 },

  scrollContent: { paddingBottom: 40 },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, lineHeight: 32, marginBottom: 3 },
  heroTheme: { fontSize: 12, color: TEXT2, fontStyle: 'italic', marginBottom: 18 },
  ringBlock: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  statsCol: { flex: 1, gap: 7 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statL: { fontSize: 11, color: TEXT2 },
  statV: { fontSize: 11, fontWeight: '700' },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 18, marginHorizontal: 20 },
  section: { paddingHorizontal: 20, marginBottom: 4 },
  blockLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: MUTED, textTransform: 'uppercase', marginBottom: 10 },

  phaseRow: { flexDirection: 'row', gap: 8 },
  phasePill: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, alignItems: 'center' },
  phaseDone: { backgroundColor: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.25)' },
  phaseActive: { backgroundColor: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.35)' },
  phaseNum: { fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  phaseName: { fontSize: 9.5, marginTop: 3 },
  phaseDays: { fontSize: 8, color: MUTED, marginTop: 2 },

  targetsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  phaseChip: { backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', borderRadius: 100, paddingVertical: 3, paddingHorizontal: 10 },
  phaseChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  twinCard: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14 },
  twinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  twinSide: { alignItems: 'center', flex: 1 },
  twinWho: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  twinDay: { fontSize: 28, fontWeight: '800', lineHeight: 30 },
  twinDaySub: { fontSize: 9, color: MUTED, marginTop: 3 },
  vs: { fontSize: 12, fontWeight: '800', color: BORDER },
  twinMsg: { backgroundColor: 'rgba(124,58,237,0.05)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10 },
  twinMsgText: { fontSize: 11.5, color: TEXT2, fontStyle: 'italic', lineHeight: 17 },

  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 4 },
  legendLbl: { fontSize: 9, color: MUTED },
});
