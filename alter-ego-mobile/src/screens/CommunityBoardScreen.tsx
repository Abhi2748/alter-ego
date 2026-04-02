import React, { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFeedback } from '@/hooks/useFeedback';
import { PostCard } from '@/components/feedback/PostCard';
import type { FeedbackTag } from '@/services/feedback';
import type { MainStackParamList } from '@/navigation/types';

const TAGS: Array<{ key: FeedbackTag | null; label: string; dot?: string }> = [
  { key: null, label: 'All' },
  { key: 'bug', label: 'Bug', dot: '#EF4444' },
  { key: 'suggestion', label: 'Suggestion', dot: '#8B5CF6' },
  { key: 'question', label: 'Question', dot: '#3B82F6' },
  { key: 'praise', label: 'Praise', dot: '#10B981' },
];

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

type CommunityBoardNavigation = StackNavigationProp<MainStackParamList, 'CommunityBoard'>;

export function CommunityBoardScreen() {
  const navigation = useNavigation<CommunityBoardNavigation>();
  const { posts, stats, loading, error, activeTag, setActiveTag, toggleUpvote, refresh } = useFeedback();
  const skipNextFocusRefresh = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefresh.current) {
        skipNextFocusRefresh.current = false;
        return;
      }
      void refresh(activeTag);
    }, [activeTag, refresh])
  );

  const onRefresh = useCallback(() => {
    void refresh(activeTag);
  }, [activeTag, refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChev}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Community Board</Text>
        <TouchableOpacity
          style={styles.postBtn}
          onPress={() => navigation.navigate('NewPost')}
          activeOpacity={0.8}
        >
          <Text style={styles.postBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {stats ? (
        <View style={styles.statsStrip}>
          <View style={[styles.statItem, styles.statItemBorder]}>
            <Text style={[styles.statNum, styles.statNumPosts]}>{formatCount(stats.total_posts)}</Text>
            <Text style={styles.statLbl}>Posts</Text>
          </View>
          <View style={[styles.statItem, styles.statItemBorder]}>
            <Text style={[styles.statNum, styles.statNumUpvotes]}>{formatCount(stats.total_upvotes)}</Text>
            <Text style={styles.statLbl}>Upvotes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, styles.statNumResolved]}>{stats.resolved_count}</Text>
            <Text style={styles.statLbl}>Resolved</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {TAGS.map((t) => {
          const isActive = activeTag === t.key;
          return (
            <TouchableOpacity
              key={t.key === null ? 'all' : t.key}
              onPress={() => setActiveTag(t.key)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              activeOpacity={0.7}
            >
              {t.dot ? <View style={[styles.tabDot, { backgroundColor: t.dot }]} /> : null}
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.divider} />

      {loading && !posts.length ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : error ? (
        <View style={styles.loader}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <PostCard post={item} onUpvote={toggleUpvote} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#8B5CF6" />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {activeTag ? `No ${activeTag} posts yet.` : 'No posts yet.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0E1A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backChev: { fontSize: 22, color: '#9CA3AF', lineHeight: 26 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#E5E7EB' },
  postBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },
  statsStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#13152A',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  statItem: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  statItemBorder: { borderRightWidth: 1, borderColor: '#252840' },
  statNum: { fontSize: 17, fontWeight: '800', color: '#E5E7EB' },
  statNumPosts: { color: '#A78BFA' },
  statNumUpvotes: { color: '#F97316' },
  statNumResolved: { color: '#10B981' },
  statLbl: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  filterRow: { flexGrow: 0, marginBottom: 14 },
  filterRowContent: { paddingHorizontal: 16, gap: 8 },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252840',
    backgroundColor: '#13152A',
  },
  filterTabActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: 'rgba(139,92,246,0.4)',
  },
  filterTabText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  filterTabTextActive: { color: '#A78BFA' },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  divider: {
    height: 1,
    backgroundColor: '#252840',
    marginHorizontal: 16,
    marginBottom: 14,
    opacity: 0.6,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyBox: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 13, color: '#6B7280' },
});
