-- ==============================================================================
-- PostgreSQL Migration: 001_init_postgres.sql
-- Church Management System (ChMS) Master Schema
-- ==============================================================================

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Ministries (7 Core Age-Bracket Ministries)
CREATE TABLE IF NOT EXISTS ministries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  min_age INT,
  max_age INT,
  description TEXT,
  color VARCHAR(20) DEFAULT '#2C3968'
);

-- 3. Users (System Accounts)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Ministries (M:N Staff & Volunteer scoping)
CREATE TABLE IF NOT EXISTS user_ministries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ministry_id INT NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  UNIQUE(user_id, ministry_id)
);

-- 5. Households (Family Units)
CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  primary_contact_phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Members (Directory Records)
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birthdate DATE NOT NULL,
  gender VARCHAR(20),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  household_id INT REFERENCES households(id) ON DELETE SET NULL,
  ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  photo_url VARCHAR(500),
  medical_notes TEXT,
  grade_level VARCHAR(50),
  address TEXT,
  guardian_names TEXT,
  guardian_phone VARCHAR(50),
  invited_by VARCHAR(255),
  school_name VARCHAR(255),
  program_major VARCHAR(255),
  class_schedule TEXT,
  occupation VARCHAR(255),
  hobbies TEXT,
  previous_church VARCHAR(255),
  facebook_account VARCHAR(100),
  family_details TEXT,
  application_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Events
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  ministry_id INT REFERENCES ministries(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Event Registrations (RSVP)
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'registered',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, member_id)
);

-- 9. Attendance (Sunday Check-In / Check-Out with Security Tag)
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ministry_id INT NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  event_id INT REFERENCES events(id) ON DELETE SET NULL,
  security_code VARCHAR(20),
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checked_out_at TIMESTAMP WITH TIME ZONE,
  checked_in_by INT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

-- 10. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  ministry_id INT REFERENCES ministries(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Prayer Requests
CREATE TABLE IF NOT EXISTS prayer_requests (
  id SERIAL PRIMARY KEY,
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  ministry_id INT REFERENCES ministries(id) ON DELETE CASCADE,
  request_text TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Funds (Stewardship Goals)
CREATE TABLE IF NOT EXISTS funds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  target_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Donations (Giving Records)
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  fund_id INT NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  notes TEXT,
  donated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Audit Logs (Compliance & Security Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  target_table VARCHAR(50) NOT NULL,
  target_id INT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Bible Study & Small Groups
CREATE TABLE IF NOT EXISTS bible_study_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  curriculum VARCHAR(255),
  ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  leader_name VARCHAR(255) NOT NULL,
  leader_contact VARCHAR(100),
  meeting_day VARCHAR(50) NOT NULL,
  meeting_time VARCHAR(50) NOT NULL,
  location VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'General',
  max_capacity INT DEFAULT 12,
  current_chapter VARCHAR(100) DEFAULT 'Chapter 1',
  progress_stage VARCHAR(100) DEFAULT 'in_progress',
  progress_notes TEXT,
  is_rescheduled BOOLEAN DEFAULT false,
  rescheduled_date VARCHAR(50),
  rescheduled_time VARCHAR(100),
  reschedule_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Bible Study Members
CREATE TABLE IF NOT EXISTS bible_study_members (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id) ON DELETE CASCADE,
  member_name VARCHAR(255),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, member_id)
);

-- 17. Bible Study Topics & Curriculum
CREATE TABLE IF NOT EXISTS bible_study_topics (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'book',
  testament_or_category VARCHAR(100),
  total_chapters INT DEFAULT 1,
  completed_chapters INT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  completed_date VARCHAR(50),
  assigned_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
  assigned_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  lead_teacher VARCHAR(255),
  key_verse VARCHAR(255),
  summary_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. System Lookups (Categories, Locations, Payment Methods)
CREATE TABLE IF NOT EXISTS system_lookups (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#2C3968',
  sort_order INT DEFAULT 0,
  is_active INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, name)
);

-- 19. System Settings (Key-Value)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Duty Teams (Rotating Saturday Service / Cleaning Teams)
CREATE TABLE IF NOT EXISTS duty_teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  leader_id INT REFERENCES members(id) ON DELETE SET NULL,
  leader_name VARCHAR(255),
  color VARCHAR(20) DEFAULT '#2C3968',
  order_seq INT DEFAULT 1,
  tasks_checklist TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Duty Team Members
CREATE TABLE IF NOT EXISTS duty_team_members (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES duty_teams(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'Member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, member_id)
);

-- 22. Duty Schedules (Saturday Cycle Assignments & Completion)
CREATE TABLE IF NOT EXISTS duty_schedules (
  id SERIAL PRIMARY KEY,
  duty_date DATE NOT NULL,
  team_id INT NOT NULL REFERENCES duty_teams(id) ON DELETE CASCADE,
  ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(duty_date, team_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_members_ministry_id ON members(ministry_id);
CREATE INDEX IF NOT EXISTS idx_members_household_id ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_donations_member_id ON donations(member_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_lookups_type ON system_lookups(type);
CREATE INDEX IF NOT EXISTS idx_duty_teams_ministry ON duty_teams(ministry_id);
CREATE INDEX IF NOT EXISTS idx_duty_schedules_date ON duty_schedules(duty_date);

-- 23. Dishwashing Roster (Sunday Fellowship Meal Rotation)
CREATE TABLE IF NOT EXISTS dishwashing_roster (
  id SERIAL PRIMARY KEY,
  duty_date DATE NOT NULL,
  event_name VARCHAR(150) DEFAULT 'Sunday Fellowship Lunch',
  cycle_mode VARCHAR(50) NOT NULL DEFAULT 'biblestudy_group',
  cycle_order_index INT DEFAULT 0,
  biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
  ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  assigned_name VARCHAR(150) NOT NULL,
  leader_name VARCHAR(150),
  leader_contact VARCHAR(100),
  partner_assigned_name VARCHAR(150),
  partner_leader_name VARCHAR(150),
  partner_biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
  partner_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  is_joint_duty BOOLEAN DEFAULT false,
  volunteers_count INT DEFAULT 4,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dishwashing_duty_date ON dishwashing_roster(duty_date);
CREATE INDEX IF NOT EXISTS idx_dishwashing_status ON dishwashing_roster(status);

