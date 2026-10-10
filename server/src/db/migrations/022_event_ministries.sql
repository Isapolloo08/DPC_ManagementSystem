-- Recurring definitions previously existed only in startup initialization.
CREATE TABLE IF NOT EXISTS recurring_sunday_events (
  id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, theme_tagline TEXT, description TEXT,
  month INT NOT NULL, week_pattern VARCHAR(50) NOT NULL DEFAULT '1st_sunday',
  target_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, target_ministry_name VARCHAR(100),
  color VARCHAR(50) DEFAULT '#2C3968', icon VARCHAR(50) DEFAULT 'Sparkles', liturgical_notes TEXT,
  program_highlights TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS event_ministries (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ministry_id INTEGER NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE, PRIMARY KEY(event_id, ministry_id)
);
CREATE TABLE IF NOT EXISTS recurring_event_ministries (
  recurring_event_id INTEGER NOT NULL REFERENCES recurring_sunday_events(id) ON DELETE CASCADE,
  ministry_id INTEGER NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE, PRIMARY KEY(recurring_event_id, ministry_id)
);
INSERT INTO event_ministries(event_id, ministry_id) SELECT id, ministry_id FROM events WHERE ministry_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO recurring_event_ministries(recurring_event_id, ministry_id) SELECT id, target_ministry_id FROM recurring_sunday_events WHERE target_ministry_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS event_ministries_ministry_idx ON event_ministries(ministry_id, event_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS recurring_event_ministries_ministry_idx ON recurring_event_ministries(ministry_id, recurring_event_id) WHERE enabled;

ALTER TABLE recurring_sunday_events ALTER COLUMN target_ministry_name TYPE TEXT;
