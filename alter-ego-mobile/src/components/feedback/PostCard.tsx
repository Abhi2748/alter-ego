import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FeedbackPost } from '@/services/feedback';
import { TagPill } from './TagPill';
import { UpvoteButton } from './UpvoteButton';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  approved: {
    label: 'Live',
    color: '#A78BFA',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.18)',
  },
  acknowledged: {
    label: 'Acknowledged',
    color: '#6EE7B7',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.18)',
  },
  answered: {
    label: 'Answered',
    color: '#93C5FD',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.18)',
  },
  resolved: {
    label: 'Resolved',
    color: '#6EE7B7',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.18)',
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
}

interface Props {
  post: FeedbackPost;
  onUpvote: (id: string) => void;
}

export function PostCard({ post, onUpvote }: Props) {
  const isHot = post.upvote_count >= 30;
  const statusCfg = STATUS_CONFIG[post.status];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <TagPill tag={post.tag} />
        {isHot ? (
          <View style={styles.hotBadge}>
            <Text style={styles.hotText}>🔥 Hot</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.content}>{post.content}</Text>

      <View style={styles.bottomRow}>
        <UpvoteButton
          count={post.upvote_count}
          voted={post.user_has_voted}
          onPress={() => onUpvote(post.id)}
        />
        {statusCfg ? (
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        ) : null}
        <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#13152A',
    borderWidth: 1,
    borderColor: '#252840',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9, width: '100%' },
  hotBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(249,115,22,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hotText: { fontSize: 9, fontWeight: '800', color: '#F97316', letterSpacing: 1 },
  content: { fontSize: 13, color: '#E5E7EB', lineHeight: 20, marginBottom: 11 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  time: { marginLeft: 'auto', fontSize: 11, color: '#6B7280' },
});
