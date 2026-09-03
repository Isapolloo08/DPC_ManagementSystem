-- PostgreSQL Migration: 003_dishwashing_roster.sql
-- Table for rotating dishwashing and kitchen fellowship meal duty assignments

CREATE TABLE IF NOT EXISTS dishwashing_roster (
  id SERIAL PRIMARY KEY,
  duty_date DATE NOT NULL,
  event_name VARCHAR(150) DEFAULT 'Sunday Fellowship Lunch',
  cycle_mode VARCHAR(50) NOT NULL DEFAULT 'biblestudy_group', -- 'biblestudy_group' | 'ministry'
  cycle_order_index INT DEFAULT 0,
  biblestudy_group_id INT REFERENCES biblestudy_groups(id) ON DELETE SET NULL,
  ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
  assigned_name VARCHAR(150) NOT NULL,
  leader_name VARCHAR(150),
  leader_contact VARCHAR(100),
  volunteers_count INT DEFAULT 4,
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled' | 'completed' | 'swapped'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dishwashing_duty_date ON dishwashing_roster(duty_date);
CREATE INDEX IF NOT EXISTS idx_dishwashing_status ON dishwashing_roster(status);
