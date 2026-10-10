-- Keep existing books compatible; newly configured books can omit optional activities.
ALTER TABLE bible_study_topics
  ADD COLUMN IF NOT EXISTS has_discussion BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_review BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_exam BOOLEAN NOT NULL DEFAULT TRUE;
