CREATE TABLE IF NOT EXISTS event_attendance_ministry_sessions (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ministry_id INTEGER NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY(event_id, ministry_id)
);
