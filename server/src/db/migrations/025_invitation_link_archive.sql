-- Deleted links retain responses, stable identities and pending online imports.
ALTER TABLE event_invitation_links ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
