-- Public avatar URL (Supabase Storage); set via PATCH /api/v1/profile/avatar after client upload.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
