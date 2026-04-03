/**
 * Community Board — feedback API.
 */

import { apiClient } from '@/services/api';

export type FeedbackTag = 'bug' | 'suggestion' | 'question' | 'praise';
export type PostStatus =
  | 'pending'
  | 'approved'
  | 'acknowledged'
  | 'answered'
  | 'resolved'
  | 'rejected';

export interface FeedbackPost {
  id: string;
  tag: FeedbackTag;
  content: string;
  upvote_count: number;
  status: PostStatus;
  created_at: string;
  user_has_voted: boolean;
  admin_answer?: string | null;
}

export interface BoardStats {
  total_posts: number;
  total_upvotes: number;
  resolved_count: number;
}

export interface UpvoteResponse {
  post_id: string;
  upvote_count: number;
  user_has_voted: boolean;
}

export const feedbackService = {
  async getStats(): Promise<BoardStats> {
    return apiClient.get('/api/v1/feedback/stats');
  },

  async getPosts(params?: { tag?: FeedbackTag; limit?: number; offset?: number }): Promise<FeedbackPost[]> {
    const query = new URLSearchParams();
    if (params?.tag) query.set('tag', params.tag);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return apiClient.get(`/api/v1/feedback/posts${qs ? `?${qs}` : ''}`);
  },

  async createPost(tag: FeedbackTag, content: string): Promise<FeedbackPost> {
    return apiClient.post('/api/v1/feedback/posts', { tag, content });
  },

  async toggleUpvote(postId: string): Promise<UpvoteResponse> {
    return apiClient.post(`/api/v1/feedback/posts/${postId}/upvote`, {});
  },
};
