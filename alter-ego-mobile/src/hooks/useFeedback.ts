import { useState, useCallback, useEffect } from 'react';
import { feedbackService, type FeedbackPost, type FeedbackTag, type BoardStats } from '@/services/feedback';

export function useFeedback() {
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [activeTag, setActiveTag] = useState<FeedbackTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadData = useCallback(async (tag?: FeedbackTag | null) => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedStats, fetchedPosts] = await Promise.all([
        feedbackService.getStats(),
        feedbackService.getPosts({ tag: tag ?? undefined, limit: 50 }),
      ]);
      setStats(fetchedStats);
      setPosts(fetchedPosts);
    } catch {
      setError('Failed to load posts. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(activeTag);
  }, [activeTag, loadData]);

  const toggleUpvote = useCallback(async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              user_has_voted: !p.user_has_voted,
              upvote_count: p.user_has_voted ? p.upvote_count - 1 : p.upvote_count + 1,
            }
          : p
      )
    );
    try {
      const result = await feedbackService.toggleUpvote(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, upvote_count: result.upvote_count, user_has_voted: result.user_has_voted }
            : p
        )
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                user_has_voted: !p.user_has_voted,
                upvote_count: p.user_has_voted ? p.upvote_count + 1 : p.upvote_count - 1,
              }
            : p
        )
      );
    }
  }, []);

  const submitPost = useCallback(async (tag: FeedbackTag, content: string): Promise<boolean> => {
    try {
      setSubmitting(true);
      await feedbackService.createPost(tag, content);
      setSubmitSuccess(true);
      return true;
    } catch {
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const resetSuccess = useCallback(() => setSubmitSuccess(false), []);

  return {
    posts,
    stats,
    loading,
    submitting,
    error,
    activeTag,
    setActiveTag,
    toggleUpvote,
    submitPost,
    submitSuccess,
    resetSuccess,
    refresh: loadData,
  };
}
