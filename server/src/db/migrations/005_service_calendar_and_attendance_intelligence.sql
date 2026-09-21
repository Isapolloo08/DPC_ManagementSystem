-- ==============================================================================
-- PostgreSQL Migration: 005_service_calendar_and_attendance_intelligence.sql
-- Service Calendar, Follow-ups, and Visitor Tracking System
-- ==============================================================================

-- 1. Services Table (Service Calendar & Recorded Session Authority)
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  service_date DATE NOT NULL,
  service_type VARCHAR(50) NOT NULL DEFAULT 'sunday_service', -- 'sunday_service' | 'special_service'
  title VARCHAR(255) NOT NULL DEFAULT 'Sunday Worship Service',
  status VARCHAR(50) NOT NULL DEFAULT 'held', -- 'held' | 'cancelled'
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service_date, service_type)
);

CREATE INDEX IF NOT EXISTS idx_services_date ON services(service_date);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);

-- Auto-seed historical and upcoming Sundays from attendance records into services
INSERT INTO services (service_date, service_type, title, status, notes)
SELECT DISTINCT
  (checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS service_date,
  'sunday_service' AS service_type,
  'Sunday Worship Service' AS title,
  'held' AS status,
  'Auto-populated from attendance check-in records' AS notes
FROM attendance
ON CONFLICT (service_date, service_type) DO NOTHING;
