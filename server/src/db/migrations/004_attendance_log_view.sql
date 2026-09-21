-- ==============================================================================
-- PostgreSQL Migration: 004_attendance_log_view.sql
-- Unified Attendance Log View & Performance Indexes
-- Combines Sunday Service Check-Ins and Bible Study / Small Group Attendance
-- ==============================================================================

-- 1. Performance Indexes for Unified Attendance Log
CREATE INDEX IF NOT EXISTS idx_bs_att_member_date ON bible_study_attendance(member_id, session_date);
CREATE INDEX IF NOT EXISTS idx_bs_att_group_date ON bible_study_attendance(group_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member_checked_in ON attendance(member_id, checked_in_at);

-- 2. Read-Only Unified Attendance Log View
DROP VIEW IF EXISTS attendance_log CASCADE;

CREATE VIEW attendance_log AS
SELECT
  'sunday_service'::VARCHAR(50) AS log_type,
  a.member_id,
  (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
  'present'::VARCHAR(20) AS status,
  NULL::INT AS group_id,
  NULL::INT AS event_id,
  a.checked_in_at AS recorded_at
FROM attendance a
WHERE a.event_id IS NULL

UNION ALL

SELECT
  'event'::VARCHAR(50) AS log_type,
  a.member_id,
  (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
  'present'::VARCHAR(20) AS status,
  NULL::INT AS group_id,
  a.event_id AS event_id,
  a.checked_in_at AS recorded_at
FROM attendance a
WHERE a.event_id IS NOT NULL

UNION ALL

SELECT
  'event'::VARCHAR(50) AS log_type,
  er.member_id,
  (COALESCE(e.start_time, er.created_at) AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
  'present'::VARCHAR(20) AS status,
  NULL::INT AS group_id,
  er.event_id AS event_id,
  er.created_at AS recorded_at
FROM event_registrations er
JOIN events e ON er.event_id = e.id
WHERE er.status = 'attended'
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.event_id = er.event_id AND a.member_id = er.member_id
  )

UNION ALL

SELECT
  'bible_study'::VARCHAR(50) AS log_type,
  bsa.member_id,
  bsa.session_date AS log_date,
  bsa.status::VARCHAR(20) AS status,
  bsa.group_id,
  NULL::INT AS event_id,
  bsa.created_at AS recorded_at
FROM bible_study_attendance bsa;

-- ==============================================================================
-- OPTIONAL: Duplicate Check & Unique Index on Sunday Service Attendance
-- Note: Do NOT apply unique index automatically to prevent migration failures
-- on legacy datasets with multiple service check-in scans.
-- ==============================================================================
--
-- Query to inspect duplicate check-ins for the same member on the same date:
--
-- SELECT member_id, (checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS checkin_date, COUNT(*) AS total_scans
-- FROM attendance
-- GROUP BY member_id, (checked_in_at AT TIME ZONE 'Asia/Manila')::DATE
-- HAVING COUNT(*) > 1;
--
-- Optional Unique Index (enable only after deduplicating historical attendance rows):
--
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_member_date_unique
-- ON attendance (member_id, ((checked_in_at AT TIME ZONE 'Asia/Manila')::DATE));
