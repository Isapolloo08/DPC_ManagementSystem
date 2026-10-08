-- Additive compatibility migration for databases created before reading preferences
-- and account-backed Bible study leaders were introduced.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bible_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS reading_start DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS leader_user_id INT REFERENCES users(id) ON DELETE SET NULL;
