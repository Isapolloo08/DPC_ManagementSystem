-- ==============================================================================
-- PostgreSQL Migration: 013_group_lifecycle_and_archive.sql
-- Enhanced Bible Study Groups Lifecycle: Active, Completed, Archived, and Internal Merged
-- ==============================================================================

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_book_id INT,
  ADD COLUMN IF NOT EXISTS completed_book_title_snapshot VARCHAR(255),
  ADD COLUMN IF NOT EXISTS completed_chapter VARCHAR(100),
  ADD COLUMN IF NOT EXISTS completed_total_chapters INT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archived_by INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_bs_groups_archived_at ON bible_study_groups(archived_at);
CREATE INDEX IF NOT EXISTS idx_bs_groups_completed_at ON bible_study_groups(completed_at);
CREATE INDEX IF NOT EXISTS idx_bs_groups_archived_by ON bible_study_groups(archived_by);
