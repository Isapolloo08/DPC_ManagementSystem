-- ============================================================
-- Migration 006: High-Performance Composite & Query Indexes
-- Purpose: Optimize WHERE, JOIN, and ORDER BY queries for 100+ concurrent users
-- ============================================================

-- 1. Members Table Indexes
-- Accelerates member filtering by ministry and status (e.g. active members in Highschool)
CREATE INDEX IF NOT EXISTS idx_members_ministry_status ON members (ministry_id, status);
-- Accelerates household membership JOINs
CREATE INDEX IF NOT EXISTS idx_members_household_id ON members (household_id);
-- Optimizes alphabetical sorting and filtering in directory views
CREATE INDEX IF NOT EXISTS idx_members_status_names ON members (status, last_name, first_name);
-- Speeds up birthday queries, age calculations, and aging-out alerts
CREATE INDEX IF NOT EXISTS idx_members_birthdate ON members (birthdate);
-- Speeds up user account association lookups
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members (user_id);
-- Accelerates baptism candidate eligibility lookups
CREATE INDEX IF NOT EXISTS idx_members_baptism ON members (is_baptized, baptism_status);
-- Speeds up recent registrations sort
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members (created_at DESC);

-- 2. Attendance Table Indexes
-- Speeds up date-based check-in queries and today's roster loading
CREATE INDEX IF NOT EXISTS idx_attendance_checked_in_at ON attendance (checked_in_at DESC);
-- Optimizes member attendance history and attendance health scoring calculations
CREATE INDEX IF NOT EXISTS idx_attendance_member_checked_in ON attendance (member_id, checked_in_at DESC);
-- Speeds up ministry-level attendance metrics and reports
CREATE INDEX IF NOT EXISTS idx_attendance_ministry_date ON attendance (ministry_id, checked_in_at DESC);
-- Accelerates event check-in roster lookups
CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON attendance (event_id);

-- 3. Events Table Indexes
-- Speeds up calendar queries and upcoming events retrieval
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time ASC);
-- Optimizes ministry-scoped upcoming events filtering
CREATE INDEX IF NOT EXISTS idx_events_ministry_start ON events (ministry_id, start_time ASC);

-- 4. Event Registrations & RSVPs Indexes
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'registered',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_member ON event_registrations (event_id, member_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_member_id ON event_registrations (member_id);

-- 5. Donations & Finance Indexes
-- Speeds up member giving history and annual statements
CREATE INDEX IF NOT EXISTS idx_donations_member_donated ON donations (member_id, donated_at DESC);
-- Speeds up fund-specific breakdown reports
CREATE INDEX IF NOT EXISTS idx_donations_fund_donated ON donations (fund_id, donated_at DESC);
-- Speeds up date range financial filtering
CREATE INDEX IF NOT EXISTS idx_donations_donated_at ON donations (donated_at DESC);

-- 6. Bible Study Groups & Attendance Indexes
-- Speeds up ministry-scoped small group listings
CREATE INDEX IF NOT EXISTS idx_bs_groups_ministry ON bible_study_groups (ministry_id);
-- Optimizes small group roster membership JOINs
CREATE INDEX IF NOT EXISTS idx_bsm_group_member ON bible_study_members (group_id, member_id);
-- Speeds up session date roll calls for small groups
CREATE INDEX IF NOT EXISTS idx_bs_att_group_session ON bible_study_attendance (group_id, session_date);
-- Accelerates member Bible study participation summaries
CREATE INDEX IF NOT EXISTS idx_bs_att_member_session ON bible_study_attendance (member_id, session_date);

-- 7. Saturday Duty Roster Indexes
CREATE INDEX IF NOT EXISTS idx_duty_schedules_duty_date ON duty_schedules (duty_date);
CREATE INDEX IF NOT EXISTS idx_duty_team_members_composite ON duty_team_members (team_id, member_id);

-- 8. Dishwashing Roster Indexes
CREATE INDEX IF NOT EXISTS idx_dishwashing_roster_service_date ON dishwashing_roster (service_date);
CREATE INDEX IF NOT EXISTS idx_dishwashing_team_members_composite ON dishwashing_team_members (team_id, member_id);

-- 9. Audit Logs Indexes
-- Speeds up administrative audit trail pagination and search
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at DESC);

-- 10. User Daily Bible Reading Indexes
CREATE INDEX IF NOT EXISTS idx_bible_reading_user_read_date ON user_bible_reading_progress (user_id, read_date DESC);
CREATE INDEX IF NOT EXISTS idx_bible_reading_user_chapter ON user_bible_reading_progress (user_id, book_id, chapter);

-- 11. Service Calendar Indexes
CREATE INDEX IF NOT EXISTS idx_services_date_type ON services (service_date DESC, service_type);
