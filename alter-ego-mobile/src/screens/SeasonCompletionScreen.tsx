/**
 * SeasonCompletionScreen
 * Full-screen result shown when a season ends (all 4 tiers: perfect / clear / partial / failed).
 * Reads current season from useCurrentSeason hook.
 * Content (headlines, twin message, CTAs) adapts to tier + season number/name.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentSeason, SEASON_KEYS } from '@/hooks/useSeason';
import { seasonService, type CurrentSeason, type SeasonTier } from '@/services/season';
import { getErrorMessage } from '@/services/api';

// ── Design tokens ──────────────────────────────────────────────────────────
const BG: readonly [string, string] = ['#050509', '#000000'];
const TEXT    = '#E8EAF0';
const TEXT2   = '#8B8FA8';
const MUTED   = '#4B5066';
const VIOLET  = '#7C3AED';
const VG      = '#A78BFA';

// ── Tier config ────────────────────────────────────────────────────────────

interface TierConfig {
  glowColor: string;
  accentColor: string;
  labelColor: string;
  labelText: string;
  ctaColors: readonly [string, string];
  ctaShadow: string;
  gradId: string;
  gradStops: Array<{ offset: string; color: string }>;
  particleColors: string[];
}

const TIER_CONFIG: Record<SeasonTier, TierConfig> = {
  perfect: {
    glowColor:    'rgba(255,184,0,0.18)',
    accentColor:  '#FFB800',
    labelColor:   '#FFB800',
    labelText:    'Perfect · Gold',
    ctaColors:    ['#D97706', '#92400E'],
    ctaShadow:    'rgba(217,119,6,0.4)',
    gradId:       'tierGold',
    gradStops:    [
      { offset: '0%',   color: '#FFE566' },
      { offset: '45%',  color: '#FFB800' },
      { offset: '100%', color: '#B45309' },
    ],
    particleColors: ['#FFB800', '#FFE566', '#F97316', '#A78BFA'],
  },
  clear: {
    glowColor:    'rgba(148,163,184,0.14)',
    accentColor:  '#94A3B8',
    labelColor:   '#94A3B8',
    labelText:    'Clear · Silver',
    ctaColors:    ['#475569', '#1E293B'],
    ctaShadow:    'rgba(71,85,105,0.35)',
    gradId:       'tierSilver',
    gradStops:    [
      { offset: '0%',   color: '#E2E8F0' },
      { offset: '50%',  color: '#94A3B8' },
      { offset: '100%', color: '#475569' },
    ],
    particleColors: ['#94A3B8', '#CBD5E1', '#64748B'],
  },
  partial: {
    glowColor:    'rgba(194,65,12,0.15)',
    accentColor:  '#FB923C',
    labelColor:   '#FB923C',
    labelText:    'Partial · Bronze',
    ctaColors:    ['#C2410C', '#7C2D12'],
    ctaShadow:    'rgba(194,65,12,0.3)',
    gradId:       'tierBronze',
    gradStops:    [
      { offset: '0%',   color: '#FB923C' },
      { offset: '50%',  color: '#C2410C' },
      { offset: '100%', color: '#7C2D12' },
    ],
    particleColors: ['#FB923C', '#C2410C'],
  },
  failed: {
    glowColor:    'rgba(127,29,29,0.2)',
    accentColor:  '#F87171',
    labelColor:   '#F87171',
    labelText:    'Season Failed',
    ctaColors:    ['#DC2626', '#7F1D1D'],
    ctaShadow:    'rgba(220,38,38,0.3)',
    gradId:       'tierFail',
    gradStops:    [
      { offset: '0%',   color: '#F87171' },
      { offset: '50%',  color: '#DC2626' },
      { offset: '100%', color: '#7F1D1D' },
    ],
    particleColors: [],
  },
};

// ── Copy helpers ────────────────────────────────────────────────────────────

function getHeadline(tier: SeasonTier, seasonName: string): string {
  switch (tier) {
    case 'perfect': return `${seasonName}\nis lit.`;
    case 'clear':   return `${seasonName}\nheld.`;
    case 'partial': return 'You made\nit through.';
    case 'failed':  return 'The season\nended.';
  }
}

function getSubline(
  tier: SeasonTier,
  daysDone: number,
  totalDays: number
): string {
  switch (tier) {
    case 'perfect': return `${totalDays} days. You showed up every time.`;
    case 'clear':   return `${daysDone} of ${totalDays} days. That's real.`;
    case 'partial': return `${daysDone} of ${totalDays} days. Still counted.`;
    case 'failed':  return `${daysDone} of ${totalDays} days. Below the line.`;
  }
}

function getSeasonStamp(tier: SeasonTier, seasonNumber: number): string {
  if (tier === 'failed') return `Season ${seasonNumber} — Not Completed`;
  if (tier === 'partial') return `Season ${seasonNumber} — Partial`;
  return `Season ${seasonNumber} Complete`;
}

function getTwinEntry(
  tier: SeasonTier,
  season: CurrentSeason
): string {
  const { days_completed, days_missed, total_days } = season;
  switch (tier) {
    case 'perfect':
      return `${total_days} days. I watched every one. You stumbled ${days_missed === 0 ? 'not once' : `${days_missed} time${days_missed > 1 ? 's' : ''}`} and came back the next morning. That's not luck — that's the beginning of something that doesn't break easily. Season 2 will ask more of you. You'll be ready.`;
    case 'clear':
      return `You got through it. Not perfectly — but through it. That's more than most. ${days_missed} missed day${days_missed > 1 ? 's' : ''} means ${days_missed > 1 ? 'cracks' : 'a crack'} in the pattern. Season 2 is where you decide if those cracks widen or close.`;
    case 'partial':
      return `${days_completed} days out of ${total_days}. You showed up more than you disappeared — I'll give you that. But ${days_missed} missed ${days_missed > 1 ? 'days is a pattern' : 'day matters'}. Season 2 is longer. The Wall comes on Day 23. You'll need to answer that.`;
    case 'failed':
      return `${days_completed} days out of ${total_days}. I kept going. Every day you didn't show, I noticed. This isn't a lecture — it's a record. The season is over. The question is what you do with the next one.`;
  }
}

function getXpAwarded(tier: SeasonTier, isFirstSeason: boolean): number {
  const base = isFirstSeason
    ? { perfect: 2400, clear: 1800, partial: 900, failed: 0 }
    : { perfect: 4800, clear: 3200, partial: 1600, failed: 0 };
  return base[tier];
}

function getNextSeasonName(currentSeasonNumber: number): string {
  const names: Record<number, string> = {
    1: 'The Forge',
    2: 'The Steady',
    3: 'The Silence',
    4: 'The Velocity',
    5: 'The Weight',
  };
  return names[currentSeasonNumber] ?? 'The Next Chapter';
}

// ── Particles ──────────────────────────────────────────────────────────────

interface ParticleSpec {
  anim: Animated.Value;
  left: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

function useParticles(colors: string[], count: number): ParticleSpec[] {
  const specs = useRef<ParticleSpec[]>(
    Array.from({ length: count }, (_, i) => ({
      anim:     new Animated.Value(0),
      left:     5 + Math.random() * 90,
      size:     3 + Math.random() * 3,
      color:    colors[i % colors.length] ?? '#fff',
      duration: 2600 + Math.random() * 1200,
      delay:    Math.random() * 1800,
    }))
  ).current;

  useEffect(() => {
    if (colors.length === 0) return;
    const loops = specs.map((s) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.timing(s.anim, {
            toValue: 1,
            duration: s.duration,
            useNativeDriver: true,
          }),
          Animated.timing(s.anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return specs;
}

function Particles({ specs }: { specs: ParticleSpec[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specs.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            bottom: '15%',
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: s.color,
            opacity: s.anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.9, 0.5, 0] }),
            transform: [{
              translateY: s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -320] }),
            }],
          }}
        />
      ))}
    </View>
  );
}

// ── Shield badge ────────────────────────────────────────────────────────────

function ShieldBadge({ cfg, tier }: { cfg: TierConfig; tier: SeasonTier }) {
  const W = 130, H = 150;
  const isFailed = tier === 'failed';
  return (
    <Svg width={W} height={H} viewBox="0 0 130 150">
      <Defs>
        <SvgGradient id={cfg.gradId} x1="20%" y1="0%" x2="80%" y2="100%">
          {cfg.gradStops.map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </SvgGradient>
      </Defs>

      {/* Outer shield */}
      <Path
        d="M65 6L118 22V66C118 97 94 122 65 142C36 122 12 97 12 66V22L65 6Z"
        fill={`${cfg.accentColor}10`}
        stroke={`url(#${cfg.gradId})`}
        strokeWidth={isFailed ? 2 : 2.5}
        strokeDasharray={isFailed ? '6 3' : undefined}
        opacity={isFailed ? 0.7 : 1}
      />
      {/* Inner shield */}
      <Path
        d="M65 18L106 30V66C106 91 86 112 65 130C44 112 24 91 24 66V30L65 18Z"
        fill={`${cfg.accentColor}05`}
        stroke={`${cfg.accentColor}18`}
        strokeWidth={1}
      />

      {isFailed ? (
        <>
          {/* Crack lines */}
          <Path d="M58 20L62 55L57 80L60 142" stroke={`${cfg.accentColor}28`} strokeWidth={1.5} strokeLinecap="round" />
          {/* Broken star outline */}
          <Path
            d="M65 42L68.8 53.6H81.1L71.2 60.5L74.9 72.2L65 65.3L55.1 72.2L58.8 60.5L48.9 53.6H61.2L65 42Z"
            fill="none" stroke={`${cfg.accentColor}50`} strokeWidth={1.5}
          />
          {/* X mark */}
          <Path d="M57 50L73 68M73 50L57 68" stroke={`${cfg.accentColor}60`} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Star */}
          <Path
            d="M65 42L68.8 53.6H81.1L71.2 60.5L74.9 72.2L65 65.3L55.1 72.2L58.8 60.5L48.9 53.6H61.2L65 42Z"
            fill={`url(#${cfg.gradId})`}
            opacity={tier === 'partial' ? 0.8 : 0.9}
          />
          {/* Corner dots */}
          <Circle cx={42} cy={46} r={2.5} fill={`${cfg.accentColor}30`} />
          <Circle cx={88} cy={46} r={2.5} fill={`${cfg.accentColor}30`} />
        </>
      )}

      <SvgText
        x={65} y={97}
        textAnchor="middle"
        fontFamily="Inter_800ExtraBold"
        fontSize={11}
        fontWeight="700"
        fill={cfg.accentColor}
        fillOpacity={isFailed ? 0.45 : 0.82}
        letterSpacing={3}
      >
        {`SEASON I`}
      </SvgText>
    </Svg>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export function SeasonCompletionScreen() {
  const navigation  = useNavigation<any>();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: season } = useCurrentSeason();
  const [ctaPending, setCtaPending] = useState(false);

  const tier: SeasonTier = season?.completion_tier ?? season?.projected_tier ?? 'failed';
  const cfg    = TIER_CONFIG[tier];
  const isFail = tier === 'failed';

  const particleSpecs = useParticles(cfg.particleColors, isFail ? 0 : 8);

  const beginNextAndGoHome = async () => {
    if (ctaPending) return;
    setCtaPending(true);
    try {
      const next = await seasonService.beginNextSeason();
      queryClient.setQueryData(SEASON_KEYS.current, next);
      await queryClient.invalidateQueries({ queryKey: SEASON_KEYS.current });
      await queryClient.invalidateQueries({ queryKey: SEASON_KEYS.history });
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e) {
      Alert.alert('Could not start next season', getErrorMessage(e));
    } finally {
      setCtaPending(false);
    }
  };

  if (!season) {
    return (
      <View style={s.container}>
        <LinearGradient colors={BG} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <Text style={s.loadText}>Loading…</Text>
        </View>
      </View>
    );
  }

  const isFirstSeason = season.season_number === 1;
  const xpAwarded     = season.xp_awarded ?? getXpAwarded(tier, isFirstSeason);
  const nextSeasonNum = season.season_number + 1;
  const nextSeasonName = getNextSeasonName(season.season_number);
  const headline  = getHeadline(tier, season.season_name);
  const subline   = getSubline(tier, season.days_completed, season.total_days);
  const stamp     = getSeasonStamp(tier, season.season_number);
  const twinEntry = season.twin_closing_entry ?? getTwinEntry(tier, season);
  const titleUnlocked = season.title_unlocked;

  const handleNext = () => {
    void beginNextAndGoHome();
  };

  /** Same as “continue”: backend has no same-number restart; next arc starts via begin-next. */
  const handleRestart = () => {
    void beginNextAndGoHome();
  };

  const handleViewRecord = () => {
    navigation.navigate('SeasonDetail');
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={BG} style={StyleSheet.absoluteFill} />

      {/* Ambient glow */}
      <View
        style={[s.glow, { backgroundColor: cfg.glowColor }]}
        pointerEvents="none"
      />

      {/* Particles */}
      <Particles specs={particleSpecs} />

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 52 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Stamp + headline */}
        <Text style={[s.stamp, { color: cfg.accentColor }]}>{stamp}</Text>
        <Text style={s.headline}>{headline}</Text>
        <Text style={s.subline}>{subline}</Text>

        {/* Shield badge */}
        <View style={s.badgeWrap}>
          <ShieldBadge cfg={cfg} tier={tier} />
          <View style={s.tierLabelRow}>
            <View style={[s.pip, { backgroundColor: cfg.accentColor }]} />
            <Text style={[s.tierLbl, { color: cfg.labelColor }]}>{cfg.labelText}</Text>
            <View style={[s.pip, { backgroundColor: cfg.accentColor }]} />
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Text style={[s.statNum, { color: cfg.accentColor }]}>{season.days_completed}</Text>
            <Text style={s.statLbl}>Days Done</Text>
          </View>
          <View style={[s.statCell, s.statBorder]}>
            <Text style={s.statNum}>{season.days_perfect}</Text>
            <Text style={s.statLbl}>Perfect</Text>
          </View>
          <View style={[s.statCell, s.statBorder]}>
            <Text style={[s.statNum, { color: season.days_missed > 0 ? '#F97316' : '#22C55E' }]}>
              {season.days_missed}
            </Text>
            <Text style={s.statLbl}>Missed</Text>
          </View>
        </View>

        {/* Earned section — only for non-failed */}
        {!isFail && xpAwarded > 0 ? (
          <View style={s.earnedSection}>
            <Text style={s.earnedTitle}>Earned</Text>
            <View style={s.earnedRow}>
              {titleUnlocked ? (
                <View style={[s.pill, { borderColor: `${cfg.accentColor}33`, backgroundColor: `${cfg.accentColor}0D` }]}>
                  <Text style={s.pillIcon}>🏅</Text>
                  <Text style={[s.pillText, { color: cfg.accentColor }]}>{titleUnlocked}</Text>
                </View>
              ) : null}
              <View style={s.pill}>
                <Text style={s.pillIcon}>⚡</Text>
                <Text style={s.pillText}>{`+${xpAwarded.toLocaleString()} XP`}</Text>
              </View>
              {tier === 'perfect' ? (
                <View style={s.pill}>
                  <Text style={s.pillIcon}>🥇</Text>
                  <Text style={s.pillText}>Gold Badge</Text>
                </View>
              ) : tier === 'clear' ? (
                <View style={s.pill}>
                  <Text style={s.pillIcon}>🥈</Text>
                  <Text style={s.pillText}>Silver Badge</Text>
                </View>
              ) : (
                <View style={s.pill}>
                  <Text style={s.pillIcon}>🥉</Text>
                  <Text style={s.pillText}>Bronze Badge</Text>
                </View>
              )}
            </View>
          </View>
        ) : isFail ? (
          <View style={s.noRewardCard}>
            <Text style={s.noRewardTitle}>No Rewards Earned</Text>
            <Text style={s.noRewardBody}>
              {`Complete 60% of season days to earn the title and XP. You were at ${Math.round((season.days_completed / season.total_days) * 100)}%.`}
            </Text>
          </View>
        ) : null}

        {/* Twin journal */}
        <View style={s.twinCard}>
          <View style={s.twinHead}>
            <View style={s.twinAvatar}>
              <Text style={s.twinAvatarText}>T</Text>
            </View>
            <View>
              <Text style={s.twinName}>Shadow Twin</Text>
              <Text style={s.twinRole}>{`Season ${season.season_number} — Closing Entry`}</Text>
            </View>
          </View>
          <Text style={s.twinText}>"{twinEntry}"</Text>
        </View>

        {/* CTAs */}
        {isFail ? (
          <>
            <View style={s.ctaHint}>
              <Text style={s.ctaHintText}>What would you like to do?</Text>
            </View>
            <Pressable
              onPress={handleRestart}
              disabled={ctaPending}
              style={({ pressed }) => [
                s.ctaPrimary,
                pressed && s.ctaPressed,
                ctaPending && { opacity: 0.6 },
              ]}
            >
              <LinearGradient
                colors={['#DC2626', '#7F1D1D']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.ctaGradient}
              >
                <Text style={s.ctaPrimaryText}>
                  {ctaPending
                    ? 'Starting…'
                    : `Restart Season ${season.season_number} · Fresh Start`}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={handleNext}
              disabled={ctaPending}
              style={({ pressed }) => [
                s.ctaSecondary,
                pressed && s.ctaPressed,
                ctaPending && { opacity: 0.6 },
              ]}
            >
              <Text style={s.ctaSecondaryText}>{`Continue to Season ${nextSeasonNum} Anyway`}</Text>
            </Pressable>
            <Text style={s.failNote}>Restarting gives you a clean slate.{'\n'}No penalties beyond the XP you didn't earn.</Text>
          </>
        ) : (
          <>
            <Pressable
              onPress={handleNext}
              disabled={ctaPending}
              style={({ pressed }) => [
                s.ctaPrimary,
                pressed && s.ctaPressed,
                ctaPending && { opacity: 0.6 },
              ]}
            >
              <LinearGradient
                colors={cfg.ctaColors as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.ctaGradient}
              >
                <Text style={s.ctaPrimaryText}>
                  {ctaPending
                    ? 'Starting…'
                    : `Begin Season ${nextSeasonNum} · ${nextSeasonName}`}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleViewRecord} style={({ pressed }) => [s.ctaSecondary, pressed && s.ctaPressed]}>
              <Text style={s.ctaSecondaryText}>View Season Record</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadText:  { fontSize: 14, color: MUTED },

  glow: {
    position: 'absolute', top: -80, alignSelf: 'center',
    width: 380, height: 380, borderRadius: 190,
    pointerEvents: 'none',
  },

  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  stamp: {
    fontSize: 9, fontWeight: '700', letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 6,
  },
  headline: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 30, fontWeight: '700', color: TEXT,
    lineHeight: 34, marginBottom: 5, textAlign: 'center',
  },
  subline: {
    fontSize: 13, color: TEXT2, marginBottom: 28,
    fontWeight: '400', textAlign: 'center',
  },

  badgeWrap: { alignItems: 'center', marginBottom: 22 },
  tierLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pip:      { width: 5, height: 5, borderRadius: 2.5 },
  tierLbl:  { fontFamily: 'Inter_800ExtraBold', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  statsRow: {
    flexDirection: 'row', width: '100%',
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, marginBottom: 18, overflow: 'hidden',
  },
  statCell:   { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.05)' },
  statNum:    { fontSize: 20, fontWeight: '800', color: TEXT, lineHeight: 24, marginBottom: 3 },
  statLbl:    { fontSize: 9, color: MUTED, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  earnedSection: { width: '100%', alignItems: 'center', marginBottom: 18 },
  earnedTitle: {
    fontSize: 8.5, fontWeight: '700', letterSpacing: 2,
    color: MUTED, textTransform: 'uppercase', marginBottom: 10,
  },
  earnedRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14,
  },
  pillIcon: { fontSize: 15, lineHeight: 18 },
  pillText: { fontSize: 12, fontWeight: '600', color: TEXT },

  noRewardCard: {
    width: '100%', marginBottom: 18,
    backgroundColor: 'rgba(239,68,68,0.04)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12, padding: 14,
  },
  noRewardTitle: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', color: 'rgba(239,68,68,0.6)', marginBottom: 6,
  },
  noRewardBody: { fontSize: 12, color: MUTED, lineHeight: 18 },

  twinCard: {
    width: '100%', marginBottom: 22,
    backgroundColor: `${VIOLET}0F`,
    borderWidth: 1, borderColor: `${VIOLET}33`,
    borderRadius: 14, padding: 14,
  },
  twinHead:       { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  twinAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: `${VIOLET}33`, borderWidth: 1, borderColor: `${VIOLET}66`,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  twinAvatarText: { fontSize: 11, fontWeight: '700', color: VG },
  twinName:  { fontSize: 12, fontWeight: '700', color: VG },
  twinRole:  { fontSize: 9, color: MUTED, marginTop: 1 },
  twinText:  { fontSize: 12.5, color: TEXT2, lineHeight: 20, fontStyle: 'italic' },

  ctaHint:     { marginBottom: 10 },
  ctaHintText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED },
  ctaPrimary:  { width: '100%', height: 54, borderRadius: 15, overflow: 'hidden', marginBottom: 9 },
  ctaPressed:  { opacity: 0.88 },
  ctaGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ctaPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaSecondary: {
    width: '100%', height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  ctaSecondaryText: { fontSize: 13, fontWeight: '600', color: TEXT2 },
  failNote: {
    fontSize: 10, color: MUTED, textAlign: 'center', lineHeight: 15,
    marginTop: 4,
  },
});
