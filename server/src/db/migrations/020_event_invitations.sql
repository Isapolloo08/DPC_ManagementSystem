CREATE TABLE IF NOT EXISTS event_invitation_links (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (length(token) = 64),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  deadline TIMESTAMPTZ NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS event_invitation_member_unique
  ON event_invitation_links(event_id, member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_invitation_event_idx ON event_invitation_links(event_id);
CREATE TABLE IF NOT EXISTS event_invitation_responses (
  id SERIAL PRIMARY KEY,
  invitation_id INTEGER NOT NULL REFERENCES event_invitation_links(id) ON DELETE CASCADE,
  response_key TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  contact TEXT NOT NULL DEFAULT '' CHECK (length(contact) <= 160),
  answer TEXT NOT NULL CHECK (answer IN ('yes', 'no', 'maybe')),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(invitation_id, response_key),
  CHECK (answer <> 'no' OR length(trim(reason)) > 0)
);
