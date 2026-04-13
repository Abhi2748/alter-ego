/**
 * AchievementsScreen
 * Opened by tapping the profile avatar on HomeScreen or ProfileScreen.
 * Shows all achievements with earned/locked states.
 * Tap an earned badge → bottom sheet with shareable card.
 *
 * Share flow: react-native-view-shot captures the card view → expo-sharing shares the image.
 * If expo-sharing is not available, fall back to a silent no-op.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Defs, LinearGradient as SvgGrad, Stop, RadialGradient, Text as SvgText } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { useAchievements } from '@/hooks/useAchievements';
import { useUserStore } from '@/store/userStore';
import type { Achievement, AchievementCategory } from '@/services/achievements';

// ── Try to import expo-sharing; fall back gracefully if missing ──────────────
let Sharing: { shareAsync: (uri: string, options?: { mimeType?: string; dialogTitle?: string }) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sharing = require('expo-sharing');
} catch {}

// ── Tokens ────────────────────────────────────────────────────────────────
const BG: readonly [string, string] = ['#09091A', '#07080F'];
const SURF   = '#101220';
const BORDER = '#1C2035';
const TEXT   = '#E5E7EB';
const TEXT2  = '#9CA3AF';
const MUTED  = '#6B7280';
const VIOLET = '#7C3AED';
const VG     = '#A78BFA';

// ── Category config ────────────────────────────────────────────────────────
const CAT_LABELS: Record<AchievementCategory, string> = {
  season:     'Seasons',
  streak:     'Streak',
  discipline: 'Discipline',
  quit:       'Quit Journey',
  interest:   'Interest Missions',
  power:      'Power Score',
};

// ── Badge renderer ─────────────────────────────────────────────────────────
// Renders the SVG badge based on shape + colors.
// Each shape has a distinct silhouette so categories are immediately recognisable.

function BadgeSvg({
  achievement,
  size = 60,
}: {
  achievement: Achievement;
  size?: number;
}) {
  const { badge_shape, badge_color, badge_secondary_color, earned } = achievement;
  const c1 = badge_color;
  const c2 = badge_secondary_color;
  const id = achievement.key.replace(/[^a-z0-9]/gi, '');

  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" opacity={earned ? 1 : 0.4}>
      <Defs>
        <SvgGrad id={`g${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={c2} />
          <Stop offset="100%" stopColor={c1} />
        </SvgGrad>
        <RadialGradient id={`r${id}`} cx="40%" cy="30%" r="55%">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <Stop offset="100%" stopColor="transparent" />
        </RadialGradient>
      </Defs>

      {badge_shape === 'shield' && (
        <>
          <Path d="M30 2L56 10V30C56 48 44 60 30 66C16 60 4 48 4 30V10L30 2Z"
            fill={`${c1}12`} stroke={`url(#g${id})`} strokeWidth={1.8} />
          <Path d="M30 2L56 10V30C56 48 44 60 30 66C16 60 4 48 4 30V10L30 2Z"
            fill={`url(#r${id})`} />
          <Path d="M30 8L52 14V30C52 45 41 56 30 62C19 56 8 45 8 30V14L30 8Z"
            fill="none" stroke={`${c1}22`} strokeWidth={1} />
          <Circle cx={18} cy={18} r={2} fill={`${c1}45`} />
          <Circle cx={42} cy={18} r={2} fill={`${c1}45`} />
          <Path d="M30 18L32.5 26H40.5L34.5 30.5L36.8 38.5L30 34L23.2 38.5L25.5 30.5L19.5 26H27.5L30 18Z"
            fill={`url(#g${id})`} />
          <SvgText x="30" y="54" textAnchor="middle"
            fontFamily="Inter_700Bold" fontSize={6} fontWeight="700"
            fill={c1} fillOpacity={0.85} letterSpacing={1.5}>
            {`S${achievement.key.match(/\d+/)?.[0] ?? '1'}`}
          </SvgText>
        </>
      )}

      {badge_shape === 'hexagon' && (
        <>
          <Path d="M30 3L53 16.5V43.5L30 57L7 43.5V16.5L30 3Z"
            fill={`${c1}10`} stroke={`url(#g${id})`} strokeWidth={1.8} />
          <Path d="M30 3L53 16.5V43.5L30 57L7 43.5V16.5L30 3Z"
            fill={`url(#r${id})`} />
          <Path d="M30 9L48 19.5V40.5L30 51L12 40.5V19.5L30 9Z"
            fill="none" stroke={`${c1}20`} strokeWidth={1} strokeDasharray="3 3" />
          <Line x1={30} y1={3} x2={30} y2={7} stroke={`${c1}35`} strokeWidth={1} />
          <Line x1={53} y1={16.5} x2={49.5} y2={18.5} stroke={`${c1}35`} strokeWidth={1} />
          <Line x1={53} y1={43.5} x2={49.5} y2={41.5} stroke={`${c1}35`} strokeWidth={1} />
          {achievement.key.includes('streak') && (
            <Path d="M30 16C28 13 26 11 26 8.5C26 6.5 28 5 30 7C32 5 34 6.5 34 8.5C34 11 32 13 30 16Z"
              fill={`url(#g${id})`} opacity={0.9} />
          )}
        </>
      )}

      {badge_shape === 'octagon' && (
        <>
          <Path d="M19 4H41L56 19V41L41 56H19L4 41V19L19 4Z"
            fill={`${c1}10`} stroke={`url(#g${id})`} strokeWidth={1.8} />
          <Path d="M19 4H41L56 19V41L41 56H19L4 41V19L19 4Z"
            fill={`url(#r${id})`} />
          <Path d="M21 9H39L51 21V39L39 51H21L9 39V21L21 9Z"
            fill="none" stroke={`${c1}15`} strokeWidth={1} />
        </>
      )}

      {badge_shape === 'circle' && (
        <>
          <Circle cx={30} cy={30} r={27} fill={`${c1}10`} stroke={`url(#g${id})`} strokeWidth={1.8} />
          <Circle cx={30} cy={30} r={27} fill={`url(#r${id})`} />
          <Circle cx={30} cy={30} r={20} fill="none" stroke={`${c1}18`} strokeWidth={1} strokeDasharray="2 4" />
        </>
      )}

      {badge_shape === 'diamond' && (
        <>
          <Path d="M30 4L56 30L30 56L4 30L30 4Z"
            fill={`${c1}10`} stroke={`url(#g${id})`} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M30 4L56 30L30 56L4 30L30 4Z"
            fill={`url(#r${id})`} />
          <Path d="M30 12L48 30L30 48L12 30L30 12Z"
            fill="none" stroke={`${c1}14`} strokeWidth={1} />
          <Line x1={30} y1={4} x2={12} y2={30} stroke={`${c1}08`} strokeWidth={1} />
          <Line x1={30} y1={4} x2={48} y2={30} stroke={`${c1}08`} strokeWidth={1} />
        </>
      )}
    </Svg>
  );
}

function BadgeLabel({ name, earned }: { name: string; earned: boolean }) {
  return (
    <Text
      style={[badgeLblStyle.text, !earned && badgeLblStyle.dim]}
      numberOfLines={2}
    >
      {name}
    </Text>
  );
}
const badgeLblStyle = StyleSheet.create({
  text: { fontSize: 10, fontWeight: '700', color: '#E5E7EB', textAlign: 'center', lineHeight: 13 },
  dim:  { color: '#6B7280' },
});

function ShareSheet({
  achievement,
  username,
  onClose,
}: {
  achievement: Achievement;
  username: string;
  onClose: () => void;
}) {
  const insets    = useSafeAreaInsets();
  const cardRef   = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const earnedDate = achievement.earned_at
    ? new Date(achievement.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await cardRef.current?.capture?.();
      if (uri && Sharing) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Achievement' });
      } else if (uri) {
        await Share.share({ url: uri, title: achievement.name });
      }
    } catch {
      // silent fail
    } finally {
      setSharing(false);
    }
  }, [achievement.name, sharing]);

  return (
    <View style={ss.overlay}>
      <Pressable style={ss.backdrop} onPress={onClose} />
      <View style={[ss.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={ss.handle} />

        <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.95 }}>
          <LinearGradient
            colors={['#0D0800', '#08090F']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={ss.card}
          >
            <View style={[ss.cardGlow, { backgroundColor: `${achievement.badge_color}20` }]} />
            <View style={ss.cardBrand}>
              <Text style={ss.cardBrandText}>ALTER EGO</Text>
              <Text style={ss.cardBrandTag}>Achievement</Text>
            </View>
            <View style={[ss.cardBadge, { shadowColor: achievement.badge_color }]}>
              <BadgeSvg achievement={achievement} size={100} />
            </View>
            <Text style={ss.cardTitle}>{achievement.name}</Text>
            <Text style={ss.cardDesc}>{achievement.description}</Text>
            <Text style={ss.cardUser}>{username}{earnedDate ? ` · ${earnedDate}` : ''}</Text>
            <View style={ss.cardFooter}>
              <Text style={ss.cardFooterBrand}>alterego.app</Text>
              <Text style={ss.cardFooterTag}>{CAT_LABELS[achievement.category]}</Text>
            </View>
          </LinearGradient>
        </ViewShot>

        <View style={ss.actions}>
          <Pressable
            style={({ pressed }) => [ss.btnShare, pressed && { opacity: 0.85 }]}
            onPress={handleShare}
            disabled={sharing}
          >
            <LinearGradient
              colors={[VIOLET, '#4C1D95']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={ss.btnShareGrad}
            >
              <Text style={ss.btnShareText}>{sharing ? 'Preparing…' : 'Share Achievement'}</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onClose} style={ss.btnClose}>
            <Text style={ss.btnCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet:    { backgroundColor: '#101220', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, paddingTop: 8 },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: 16 },
  card:     { borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 12, position: 'relative', overflow: 'hidden', minHeight: 280 },
  cardGlow: { position: 'absolute', top: '20%', left: '50%', width: 160, height: 160, borderRadius: 80, marginLeft: -80, marginTop: -80 },
  cardBrand: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrandText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2 },
  cardBrandTag:  { fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, textTransform: 'uppercase' },
  cardBadge: { marginTop: 28, marginBottom: 14, shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, shadowOpacity: 0.6, elevation: 12 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 5 },
  cardDesc:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 10, lineHeight: 16, paddingHorizontal: 8 },
  cardUser:  { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  cardFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: 'rgba(0,0,0,0.35)' },
  cardFooterBrand: { fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 },
  cardFooterTag:   { fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 },
  actions: { gap: 8 },
  btnShare:    { height: 50, borderRadius: 14, overflow: 'hidden' },
  btnShareGrad:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnShareText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
  btnClose:    { height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  btnCloseText:{ fontSize: 13, fontWeight: '600', color: TEXT2 },
});

const CATEGORIES: AchievementCategory[] = ['season','streak','discipline','quit','interest','power'];

export function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const profile    = useUserStore(s => s.profile);
  const username   = profile?.username ?? '';

  const { data } = useAchievements();
  const total        = data?.total ?? 38;
  const earnedCount  = data?.earned_count ?? 0;
  const featured     = data?.featured ?? null;
  const achievements = data?.achievements ?? [];

  const [activeFilter, setActiveFilter] = useState<'all' | AchievementCategory>('all');
  const [shareTarget, setShareTarget]   = useState<Achievement | null>(null);

  const grouped = CATEGORIES.reduce<Record<AchievementCategory, Achievement[]>>((acc, cat) => {
    acc[cat] = achievements.filter(a => a.category === cat);
    return acc;
  }, {} as Record<AchievementCategory, Achievement[]>);

  const handleBadgePress = useCallback((a: Achievement) => {
    if (!a.earned) return;
    setShareTarget(a);
  }, []);

  const pct = total > 0 ? (earnedCount / total) * 100 : 0;

  return (
    <View style={a.container}>
      <LinearGradient colors={BG} style={StyleSheet.absoluteFill} />

      <View style={[a.hdr, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={a.backBtn} hitSlop={8}>
          <Text style={a.backArrow}>‹</Text>
        </Pressable>

        <View style={a.identity}>
          <View style={a.avatar}>
            <Text style={a.avatarText}>{username ? username[0].toUpperCase() : '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={a.username}>{username}</Text>
            <Text style={a.progText}>{`${earnedCount} of ${total} earned · ${Math.round(pct)}% complete`}</Text>
            <View style={a.progBar}><View style={[a.progFill, { width: `${pct}%` as any }]} /></View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={a.filterScroll} contentContainerStyle={a.filterContent}>
          {(['all', ...CATEGORIES] as const).map(f => (
            <Pressable
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[a.chip, activeFilter === f && a.chipOn]}
            >
              <Text style={[a.chipText, activeFilter === f && a.chipTextOn]}>
                {f === 'all' ? 'All' : CAT_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={a.shareHint}>
          <Text style={a.shareHintText}>Tap any earned badge to share it</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[a.scroll, { paddingTop: insets.top + 200 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {featured && (activeFilter === 'all') ? (
          <Pressable style={a.featured} onPress={() => handleBadgePress(featured)}>
            <View style={[a.featGlow, { backgroundColor: `${featured.badge_color}18` }]} />
            <View style={[a.featBadge, { shadowColor: featured.badge_color }]}>
              <BadgeSvg achievement={featured} size={72} />
            </View>
            <View style={a.featInfo}>
              <Text style={a.featTag}>{`Latest · ${CAT_LABELS[featured.category]}`}</Text>
              <Text style={a.featName}>{featured.name}</Text>
              <Text style={a.featDesc}>{featured.description}</Text>
              {featured.earned_at ? (
                <Text style={a.featDate}>{`Earned ${new Date(featured.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</Text>
              ) : null}
              <View style={[a.featShare, { borderColor: `${featured.badge_color}33`, backgroundColor: `${featured.badge_color}10` }]}>
                <Text style={[a.featShareText, { color: featured.badge_color }]}>Share</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {CATEGORIES
          .filter(cat => activeFilter === 'all' || activeFilter === cat)
          .map(cat => {
            const items = grouped[cat] ?? [];
            if (items.length === 0) return null;
            const catEarned = items.filter(i => i.earned).length;
            return (
              <View key={cat} style={a.catBlock}>
                <View style={a.catHdr}>
                  <Text style={a.catLabel}>{CAT_LABELS[cat]}</Text>
                  <Text style={a.catCount}>{`${catEarned} of ${items.length}`}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={a.strip}>
                  {items.map(item => (
                    <Pressable
                      key={item.id}
                      style={[a.bcell, !item.earned && a.bcellLocked]}
                      onPress={() => handleBadgePress(item)}
                    >
                      <View style={a.bcellInner} />
                      {item.earned ? (
                        <View style={a.earnedTick}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>✓</Text>
                        </View>
                      ) : (
                        <View style={a.lockedTick}>
                          <Text style={{ color: MUTED, fontSize: 8 }}>🔒</Text>
                        </View>
                      )}
                      <BadgeSvg achievement={item} size={56} />
                      <BadgeLabel name={item.name} earned={item.earned} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            );
          })}

        <View style={{ height: insets.bottom + 48 }} />
      </ScrollView>

      {shareTarget ? (
        <Modal transparent visible animationType="slide" onRequestClose={() => setShareTarget(null)}>
          <ShareSheet
            achievement={shareTarget}
            username={username}
            onClose={() => setShareTarget(null)}
          />
        </Modal>
      ) : null}
    </View>
  );
}

const a = StyleSheet.create({
  container: { flex: 1 },

  hdr: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(7,8,15,0.96)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20, paddingBottom: 0,
  },
  backBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  backArrow: { fontSize: 20, color: TEXT2, lineHeight: 24 },

  identity:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  avatar:    { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(80,30,160,0.8)', borderWidth: 2, borderColor: 'rgba(139,92,246,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:{ fontSize: 17, fontWeight: '700', color: 'rgba(167,139,250,0.9)' },
  username:  { fontSize: 15, fontWeight: '700', color: VG },
  progText:  { fontSize: 11, color: MUTED, marginTop: 2 },
  progBar:   { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 100, overflow: 'hidden', marginTop: 6 },
  progFill:  { height: '100%', backgroundColor: VIOLET, borderRadius: 100 },

  filterScroll:  { marginBottom: 10 },
  filterContent: { gap: 6, paddingBottom: 2 },
  chip:       { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, borderColor: BORDER, backgroundColor: 'transparent' },
  chipOn:     { backgroundColor: VIOLET, borderColor: VIOLET },
  chipText:   { fontSize: 10, fontWeight: '700', color: MUTED },
  chipTextOn: { color: '#fff' },

  shareHint: { paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareHintText: { fontSize: 10, color: 'rgba(167,139,250,0.5)', fontWeight: '500' },

  scroll: { paddingHorizontal: 0 },

  featured: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: 'rgba(255,184,0,0.05)', borderWidth: 1, borderColor: 'rgba(255,184,0,0.18)',
    borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, overflow: 'hidden',
  },
  featGlow:  { position: 'absolute', right: -20, top: '50%', width: 120, height: 120, borderRadius: 60, marginTop: -60 },
  featBadge: { flexShrink: 0, shadowOffset: { width: 0, height: 0 }, shadowRadius: 14, shadowOpacity: 0.5, elevation: 10 },
  featInfo:  { flex: 1 },
  featTag:   { fontSize: 8.5, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,184,0,0.7)', textTransform: 'uppercase', marginBottom: 3 },
  featName:  { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 2 },
  featDesc:  { fontSize: 11, color: TEXT2, lineHeight: 15, marginBottom: 6 },
  featDate:  { fontSize: 10, color: MUTED, marginBottom: 8 },
  featShare: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  featShareText: { fontSize: 10, fontWeight: '700' },

  catBlock: { marginBottom: 4 },
  catHdr:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  catLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: MUTED, textTransform: 'uppercase' },
  catCount: { fontSize: 9, color: '#374151' },

  strip:    { gap: 10, paddingHorizontal: 20, paddingBottom: 4 },
  bcell:    { width: 96, backgroundColor: SURF, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, paddingBottom: 10, alignItems: 'center', gap: 7, position: 'relative', overflow: 'hidden' },
  bcellLocked: { opacity: 0.35 },
  bcellInner:  { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.015)' },
  earnedTick:  { position: 'absolute', top: 7, right: 7, width: 14, height: 14, borderRadius: 7, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center' },
  lockedTick:  { position: 'absolute', top: 6, right: 6, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
});
