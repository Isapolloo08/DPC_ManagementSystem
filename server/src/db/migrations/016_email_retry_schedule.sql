ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_email_outbox_due
  ON email_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed') AND attempts < 5;
