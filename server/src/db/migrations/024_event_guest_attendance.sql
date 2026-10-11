CREATE TABLE IF NOT EXISTS event_guest_attendance (
  response_id INTEGER PRIMARY KEY REFERENCES event_invitation_responses(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attended','absent','excused')),
  reason TEXT NOT NULL DEFAULT '',
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_attendance_sessions (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
