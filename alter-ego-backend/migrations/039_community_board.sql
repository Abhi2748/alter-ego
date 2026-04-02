-- ── feedback_posts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_posts (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag           TEXT        NOT NULL CHECK (tag IN ('bug', 'suggestion', 'question', 'praise')),
    content       TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 280),
    upvote_count  INTEGER     NOT NULL DEFAULT 0,
    status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'acknowledged', 'answered', 'resolved')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_posts_status_upvotes
    ON feedback_posts(status, upvote_count DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_posts_tag
    ON feedback_posts(tag);

-- ── feedback_upvotes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_upvotes (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id    UUID        NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_post
    ON feedback_upvotes(post_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE feedback_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_upvotes ENABLE ROW LEVEL SECURITY;

-- Users can read only approved posts
CREATE POLICY "read_approved_posts" ON feedback_posts
    FOR SELECT USING (status != 'pending');

-- Users can insert their own posts (status defaults to 'pending')
CREATE POLICY "insert_own_post" ON feedback_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own upvotes
CREATE POLICY "read_own_upvotes" ON feedback_upvotes
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own upvotes
CREATE POLICY "insert_own_upvote" ON feedback_upvotes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own upvotes (for toggle-off)
CREATE POLICY "delete_own_upvote" ON feedback_upvotes
    FOR DELETE USING (auth.uid() = user_id);
