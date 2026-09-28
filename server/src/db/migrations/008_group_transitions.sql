-- ==============================================================================
-- PostgreSQL Migration: 008_group_transitions.sql
-- Bible Study Group Transitions Architecture (Merge, Split, Move, Leadership)
-- ==============================================================================

-- 1. Extend bible_study_groups table with status and transition tracking fields
ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS merged_into_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS assistant_leader_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assistant_leader_contact VARCHAR(100),
  ADD COLUMN IF NOT EXISTS assistant_leader_id INT REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bs_groups_status ON bible_study_groups(status);
CREATE INDEX IF NOT EXISTS idx_bs_groups_merged_into ON bible_study_groups(merged_into_group_id);

-- 2. Master Transitions Table (Supports MERGE, SPLIT, MOVE_MEMBERS, LEADER_CHANGE, MINISTRY_TRANSITION)
CREATE TABLE IF NOT EXISTS bible_study_group_transitions (
  id SERIAL PRIMARY KEY,
  transition_type VARCHAR(50) NOT NULL,
  new_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  metadata JSONB,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bs_transitions_type ON bible_study_group_transitions(transition_type);
CREATE INDEX IF NOT EXISTS idx_bs_transitions_new_group ON bible_study_group_transitions(new_group_id);
CREATE INDEX IF NOT EXISTS idx_bs_transitions_date ON bible_study_group_transitions(effective_date);

-- 3. Transition Sources Table (N:M mapping for one or more source groups)
CREATE TABLE IF NOT EXISTS bible_study_group_transition_sources (
  id SERIAL PRIMARY KEY,
  transition_id INT NOT NULL REFERENCES bible_study_group_transitions(id) ON DELETE CASCADE,
  source_group_id INT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
  UNIQUE(transition_id, source_group_id)
);

CREATE INDEX IF NOT EXISTS idx_bs_trans_sources_trans ON bible_study_group_transition_sources(transition_id);
CREATE INDEX IF NOT EXISTS idx_bs_trans_sources_src ON bible_study_group_transition_sources(source_group_id);

-- 4. Multi-Leader & Historical Leadership Assignment Table
CREATE TABLE IF NOT EXISTS bible_study_group_leaders (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  leader_name VARCHAR(255) NOT NULL,
  leader_contact VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'primary', -- 'primary', 'assistant', 'former'
  started_at DATE DEFAULT CURRENT_DATE,
  ended_at DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bs_leaders_group ON bible_study_group_leaders(group_id);
CREATE INDEX IF NOT EXISTS idx_bs_leaders_user ON bible_study_group_leaders(user_id);
CREATE INDEX IF NOT EXISTS idx_bs_leaders_member ON bible_study_group_leaders(member_id);

-- 5. Extend bible_study_members for membership transition and history tracking
ALTER TABLE bible_study_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'transferred', 'inactive'
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS transition_id INT REFERENCES bible_study_group_transitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bs_members_status ON bible_study_members(status);
