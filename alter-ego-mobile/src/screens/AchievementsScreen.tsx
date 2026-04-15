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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { useAchievements } from '@/hooks/useAchievements';
import { useUserStore } from '@/store/userStore';
import type { Achievement, AchievementCategory } from '@/services/achievements';
import {
  AchievementBadgeV5Icon,
  CATEGORY_ACCENT_RGB,
} from '@/components/achievements/AchievementBadgeV5';

// ── Try to import expo-sharing; fall back gracefully if missing ──────────────
let Sharing: { shareAsync: (uri: string, options?: { mimeType?: string; dialogTitle?: string }) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sharing = require('expo-sharing');
} catch {}

// ── Tokens ────────────────────────────────────────────────────────────────
const BG: readonly [string, string] = ['#09091A', '#07080F'];
const BORDER = '#1C2035';
const TEXT   = '#E5E7EB';
const TEXT2  = '#9CA3AF';
const MUTED  = '#6B7280';
const VIOLET = '#8B5CF6';
const VG     = '#A78BFA';

// ── Category config ────────────────────────────────────────────────────────
const CAT_LABELS: Record<AchievementCategory, string> = {
  season:     'Seasons',
  streak:     'Streak',
  discipline: 'Discipline',
  character:  'Character',
  companion:  'Companion',
  quit:       'Quit Journey',
  interest:   'Interest Missions',
  power:      'Power Score',
};

const TICK_PURPLE = '#7C3AED';
const BG_DEEP = '#08080E';

function badgeTileFrame(cat: AchievementCategory, earned: boolean) {
  const rgb = CATEGORY_ACCENT_RGB[cat];
  if (!earned) {
    return {
      width: 54,
      height: 54,
      borderRadius: 17,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: 'rgba(255,255,255,0.015)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.04)',
    };
  }
  return {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: `rgba(${rgb},0.08)`,
    borderWidth: 1.5,
    borderColor: `rgba(${rgb},0.45)`,
    shadowColor: `rgb(${rgb})`,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: 0.22,
    elevation: 5,
  };
}

function featuredFrame(cat: AchievementCategory) {
  const rgb = CATEGORY_ACCENT_RGB[cat];
  return {
    borderWidth: 1,
    borderColor: `rgba(${rgb},0.16)`,
    backgroundColor: `rgba(${rgb},0.05)`,
  };
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
  text: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 12,
    maxWidth: 74,
  },
  dim: { color: '#1F2937' },
});

function EarnedCheckTick() {
  return (
    <View style={tickStyles.wrap}>
      <Svg width={7} height={5} viewBox="0 0 7 5">
        <Path
          d="M.5 2.5L2 4L6 .5"
          stroke="#fff"
          strokeWidth={1.2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const tickStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -2,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: TICK_PURPLE,
    borderWidth: 2,
    borderColor: BG_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
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
            <View
              style={[
                ss.cardGlow,
                {
                  backgroundColor: `rgba(${CATEGORY_ACCENT_RGB[achievement.category]},0.12)`,
                },
              ]}
            />
            <View style={ss.cardBrand}>
              <Text style={ss.cardBrandText}>ALTER EGO</Text>
              <Text style={ss.cardBrandTag}>Achievement</Text>
            </View>
            <View
              style={[
                ss.cardBadge,
                badgeTileFrame(achievement.category, true),
                {
                  width: 88,
                  height: 88,
                  borderRadius: 22,
                  marginTop: 28,
                  marginBottom: 14,
                },
              ]}
            >
              <AchievementBadgeV5Icon
                achievement={achievement}
                size={58}
                earned
              />
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
  cardBadge: { alignItems: 'center', justifyContent: 'center' },
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

const CATEGORIES: AchievementCategory[] = [
  'season',
  'streak',
  'discipline',
  'character',
  'companion',
  'quit',
  'interest',
  'power',
];

export function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const profile    = useUserStore(s => s.profile);
  const username   = profile?.username ?? '';
  const initial    = username ? username[0].toUpperCase() : '?';

  const { data } = useAchievements();
  const achievementsRaw = data?.achievements ?? [];
  const achievements = achievementsRaw.map((a) => ({
    ...a,
    badge_secondary_color: a.badge_secondary_color ?? a.badge_secondary ?? '',
  }));
  const total        = data?.total ?? achievements.length;
  const earnedCount  = data?.earned_count ?? 0;
  const featured     = data?.featured
    ? {
        ...data.featured,
        badge_secondary_color:
          data.featured.badge_secondary_color ?? data.featured.badge_secondary ?? '',
      }
    : null;

  const [activeFilter, setActiveFilter] = useState<'all' | AchievementCategory>('all');
  const [shareTarget, setShareTarget]   = useState<Achievement | null>(null);

  const grouped = CATEGORIES.reduce<Record<AchievementCategory, Achievement[]>>((acc, cat) => {
    acc[cat] = achievements
      .filter(a => a.category === cat)
      .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
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
          {profile?.profile_photo_url ? (
            <View style={a.avatarRing}>
              <View style={a.avatarClip}>
                <Image
                  source={{ uri: profile.profile_photo_url }}
                  style={a.avatarImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          ) : (
            <LinearGradient
              colors={['rgba(80,30,160,0.7)', 'rgba(30,20,60,0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={a.avatar}
            >
              <Text style={a.avatarText}>{initial}</Text>
            </LinearGradient>
          )}
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
          <Pressable
            style={[a.featured, featuredFrame(featured.category)]}
            onPress={() => handleBadgePress(featured)}
          >
            <View
              style={[
                a.featHairline,
                {
                  backgroundColor: `rgba(${CATEGORY_ACCENT_RGB[featured.category]},0.28)`,
                },
              ]}
            />
            <View style={[a.featGlow, { backgroundColor: `rgba(${CATEGORY_ACCENT_RGB[featured.category]},0.14)` }]} />
            <View style={[a.featBadge, badgeTileFrame(featured.category, true)]}>
              <AchievementBadgeV5Icon achievement={featured} size={30} earned />
            </View>
            <View style={a.featInfo}>
              <Text
                style={[
                  a.featTag,
                  { color: `rgba(${CATEGORY_ACCENT_RGB[featured.category]},0.68)` },
                ]}
              >{`Latest · ${CAT_LABELS[featured.category]}`}</Text>
              <Text style={a.featName}>{featured.name}</Text>
              <Text style={a.featDesc}>{featured.description}</Text>
              {featured.earned_at ? (
                <Text style={a.featDate}>{`Earned ${new Date(featured.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</Text>
              ) : null}
              <View
                style={[
                  a.featShare,
                  {
                    borderColor: `rgba(${CATEGORY_ACCENT_RGB[featured.category]},0.18)`,
                    backgroundColor: `rgba(${CATEGORY_ACCENT_RGB[featured.category]},0.09)`,
                  },
                ]}
              >
                <Text
                  style={[
                    a.featShareText,
                    { color: `rgba(${CATEGORY_ACCENT_RGB[featured.category]},0.8)` },
                  ]}
                >
                  Share
                </Text>
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
                      key={item.key}
                      style={a.bcell}
                      onPress={() => handleBadgePress(item)}
                    >
                      {item.earned ? <EarnedCheckTick /> : null}
                      <View style={badgeTileFrame(item.category, item.earned)}>
                        <AchievementBadgeV5Icon
                          achievement={item}
                          size={28}
                          earned={item.earned}
                        />
                      </View>
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
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.5)',
    overflow: 'hidden',
    backgroundColor: '#141824',
    flexShrink: 0,
  },
  avatarClip: { width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatar:    { width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(139,92,246,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  featHairline: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
  },
  featGlow: {
    position: 'absolute',
    right: -20,
    top: '50%',
    width: 120,
    height: 120,
    borderRadius: 60,
    marginTop: -60,
  },
  featBadge: { flexShrink: 0 },
  featInfo: { flex: 1 },
  featTag: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  featName: { fontSize: 13, fontWeight: '700', color: '#F3F4F6', marginBottom: 2 },
  featDesc: { fontSize: 9.5, color: '#6B7280', lineHeight: 14, marginBottom: 5 },
  featDate: { fontSize: 9, color: '#374151', marginBottom: 7 },
  featShare: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  featShareText: { fontSize: 9, fontWeight: '700' },

  catBlock: { marginBottom: 4 },
  catHdr:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  catLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: MUTED, textTransform: 'uppercase' },
  catCount: { fontSize: 9, color: '#374151' },

  strip: { gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  bcell: {
    width: 72,
    alignItems: 'center',
    gap: 5,
    position: 'relative',
    paddingTop: 2,
  },
});
