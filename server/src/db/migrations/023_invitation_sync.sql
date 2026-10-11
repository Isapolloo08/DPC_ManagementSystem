-- Stable provenance is copied by invitation publication, never inferred from IDs.
ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_identity UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE members ADD COLUMN IF NOT EXISTS sync_identity UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE event_invitation_links ADD COLUMN IF NOT EXISTS sync_identity UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS events_sync_identity ON events(sync_identity);
CREATE UNIQUE INDEX IF NOT EXISTS members_sync_identity ON members(sync_identity);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_sync_identity ON event_invitation_links(sync_identity);
CREATE SEQUENCE IF NOT EXISTS invitation_revision_sequence;
ALTER TABLE event_invitation_responses ADD COLUMN IF NOT EXISTS sync_identity UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE event_invitation_responses ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT nextval('invitation_revision_sequence');
CREATE UNIQUE INDEX IF NOT EXISTS responses_sync_identity ON event_invitation_responses(sync_identity);

CREATE TABLE IF NOT EXISTS invitation_sync_node (
  id INTEGER PRIMARY KEY CHECK(id=1), identity UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  source_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  source_id UUID, source_url TEXT, credential TEXT,
  last_check TIMESTAMPTZ, state TEXT NOT NULL DEFAULT 'Not paired'
);
INSERT INTO invitation_sync_node(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS invitation_sync_receivers (
  receiver UUID PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS invitation_sync_confirmations (
  receiver UUID NOT NULL REFERENCES invitation_sync_receivers(receiver),
  submission UUID NOT NULL, revision BIGINT NOT NULL, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(receiver,submission,revision)
);
CREATE TABLE IF NOT EXISTS invitation_sync_receipts (
  source UUID NOT NULL, receiver UUID NOT NULL, submission UUID NOT NULL, revision BIGINT NOT NULL,
  response_id INTEGER NOT NULL REFERENCES event_invitation_responses(id) ON DELETE CASCADE,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(source,receiver,submission,revision)
);
CREATE INDEX IF NOT EXISTS invitation_sync_confirmation_work ON invitation_sync_receipts(next_attempt) WHERE NOT confirmed;
CREATE TABLE IF NOT EXISTS invitation_sync_pending (
  source UUID NOT NULL, submission UUID NOT NULL, revision BIGINT NOT NULL,
  event_identity UUID NOT NULL, event_title TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(source,submission)
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS invitation_event_identity UUID;

CREATE OR REPLACE FUNCTION invitation_response_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.name,NEW.contact,NEW.answer,NEW.reason) IS DISTINCT FROM (OLD.name,OLD.contact,OLD.answer,OLD.reason)
     AND NEW.sync_revision=OLD.sync_revision THEN
    NEW.sync_revision := nextval('invitation_revision_sequence');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invitation_response_revision ON event_invitation_responses;
CREATE TRIGGER invitation_response_revision BEFORE UPDATE ON event_invitation_responses
FOR EACH ROW EXECUTE FUNCTION invitation_response_revision();

CREATE OR REPLACE FUNCTION retain_pending_invitation_response() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM invitation_sync_node WHERE source_enabled)
    AND (NOT EXISTS(SELECT 1 FROM invitation_sync_receivers)
      OR EXISTS(SELECT 1 FROM invitation_sync_receivers r WHERE NOT EXISTS
        (SELECT 1 FROM invitation_sync_confirmations c WHERE c.receiver=r.receiver AND c.submission=OLD.sync_identity AND c.revision=OLD.sync_revision))) THEN
    RAISE EXCEPTION 'Pending online invitation submissions must be pulled before deletion. Deactivate the invitation instead.' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS retain_pending_invitation_response ON event_invitation_responses;
CREATE TRIGGER retain_pending_invitation_response BEFORE DELETE ON event_invitation_responses
FOR EACH ROW EXECUTE FUNCTION retain_pending_invitation_response();

CREATE OR REPLACE FUNCTION retain_pending_invitation_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM invitation_sync_node WHERE source_enabled) AND EXISTS
    (SELECT 1 FROM event_invitation_responses s WHERE NOT EXISTS(SELECT 1 FROM invitation_sync_receivers)
      OR EXISTS(SELECT 1 FROM invitation_sync_receivers r WHERE NOT EXISTS
        (SELECT 1 FROM invitation_sync_confirmations c WHERE c.receiver=r.receiver AND c.submission=s.sync_identity AND c.revision=s.sync_revision))) THEN
    RAISE EXCEPTION 'Pending online invitation submissions cannot be purged. Deactivate invitations instead.' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS retain_pending_invitation_truncate ON event_invitation_responses;
CREATE TRIGGER retain_pending_invitation_truncate BEFORE TRUNCATE ON event_invitation_responses
FOR EACH STATEMENT EXECUTE FUNCTION retain_pending_invitation_truncate();
