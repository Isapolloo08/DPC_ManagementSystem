ALTER TABLE planned_visits ADD COLUMN IF NOT EXISTS management_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
CREATE UNIQUE INDEX IF NOT EXISTS planned_visit_management_token ON planned_visits(management_token);
ALTER TABLE planned_visits ADD COLUMN IF NOT EXISTS visitor_reply TEXT NOT NULL DEFAULT 'Pending' CHECK(visitor_reply IN ('Pending','Confirmed','Cancelled'));
ALTER TABLE planned_visits ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 1 CHECK(sync_revision>0);
CREATE TABLE IF NOT EXISTS visit_sync_pending (
 source UUID NOT NULL, submission UUID NOT NULL, revision BIGINT NOT NULL CHECK(revision>0),
 visit_date DATE NOT NULL, updated_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(source,submission)
);
CREATE TABLE IF NOT EXISTS visit_sync_receipts (
 source UUID NOT NULL, receiver UUID NOT NULL, submission UUID NOT NULL, revision BIGINT NOT NULL CHECK(revision>0),
 visit_id INTEGER NOT NULL REFERENCES planned_visits(id), payload_hash TEXT NOT NULL,
 confirmed BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY(source,receiver,submission,revision)
);
CREATE TABLE IF NOT EXISTS visit_sync_confirmations (
 receiver UUID NOT NULL, submission UUID NOT NULL, revision BIGINT NOT NULL CHECK(revision>0), PRIMARY KEY(receiver,submission,revision)
);
CREATE TABLE IF NOT EXISTS visit_sync_state (
 id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL DEFAULT 'Not checked', last_check TIMESTAMPTZ
);
INSERT INTO visit_sync_state(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION planned_visit_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.visit_date,NEW.visitor_reply) IS DISTINCT FROM ROW(OLD.visit_date,OLD.visitor_reply) THEN
   IF NEW.sync_revision=OLD.sync_revision THEN NEW.sync_revision := OLD.sync_revision+1; END IF;
   NEW.updated_at := now();
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS planned_visit_revision ON planned_visits;
CREATE TRIGGER planned_visit_revision BEFORE UPDATE ON planned_visits FOR EACH ROW EXECUTE FUNCTION planned_visit_revision();
CREATE OR REPLACE FUNCTION retain_pending_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM invitation_sync_node WHERE id=1 AND source_enabled) THEN
   IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'Online visit submissions cannot be truncated'; END IF;
   IF NOT EXISTS(SELECT 1 FROM visit_sync_confirmations WHERE submission=OLD.receipt_id AND revision=OLD.sync_revision) THEN
     RAISE EXCEPTION 'Pending online visit must be imported before deletion';
   END IF;
 END IF;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS retain_pending_visit ON planned_visits;
CREATE TRIGGER retain_pending_visit BEFORE DELETE ON planned_visits FOR EACH ROW EXECUTE FUNCTION retain_pending_visit();
DROP TRIGGER IF EXISTS retain_pending_visit_truncate ON planned_visits;
CREATE TRIGGER retain_pending_visit_truncate BEFORE TRUNCATE ON planned_visits FOR EACH STATEMENT EXECUTE FUNCTION retain_pending_visit();
