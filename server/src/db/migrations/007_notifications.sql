-- ==============================================================================
-- PostgreSQL Migration: 007_notifications.sql
-- Local notification delivery, configurable rules, and durable email outbox
-- ==============================================================================

-- One durable in-app notification per recipient.
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link_tab VARCHAR(100),
  link_ref_id INT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications (user_id, is_read, created_at DESC);

-- Rules may target a concrete user, a role within the event scope, or a
-- configured/literal email address. A NULL ministry_id means the event payload's
-- ministry scope, when present, otherwise church-wide.
CREATE TABLE IF NOT EXISTS notification_rules (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  recipient_type VARCHAR(20) NOT NULL
    CHECK (recipient_type IN ('user', 'role', 'email')),
  recipient_value VARCHAR(255) NOT NULL,
  ministry_id INT REFERENCES ministries(id) ON DELETE CASCADE,
  threshold INT CHECK (threshold IS NULL OR threshold > 0),
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_event_enabled
  ON notification_rules (event_type, enabled);

CREATE INDEX IF NOT EXISTS idx_notification_rules_ministry
  ON notification_rules (ministry_id)
  WHERE ministry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_rules_unique_target
  ON notification_rules (
    event_type,
    recipient_type,
    recipient_value,
    COALESCE(ministry_id, 0)
  );

-- Email is queued locally so application actions do not depend on network
-- availability. The worker updates status and retry metadata asynchronously.
CREATE TABLE IF NOT EXISTS email_outbox (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(320) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON email_outbox (status, attempts, created_at ASC)
  WHERE status IN ('pending', 'failed');

-- Records dispatch outcomes and supplies an event/recipient idempotency key.
-- notification:new and email delivery can therefore be retried without creating
-- duplicate absence summaries for the same Bible-study session.
CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_key VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('in_app', 'email')),
  recipient VARCHAR(320) NOT NULL,
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_type, event_key, channel, recipient)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_event_created
  ON notification_log (event_type, created_at DESC);

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS notification_log_id INT REFERENCES notification_log(id) ON DELETE SET NULL;

-- Initial recipient and channel policy. A NULL ministry_id keeps role targets
-- scoped to the ministry supplied by the event payload. "pastor" is resolved
-- from the protected notification/email settings rather than being hardcoded.
INSERT INTO notification_rules (
  event_type, recipient_type, recipient_value, ministry_id,
  threshold, email_enabled, in_app_enabled, enabled
) VALUES
  ('absence_alert', 'role', 'Admin', NULL, 3, FALSE, TRUE, TRUE),
  ('absence_alert', 'role', 'Pastor', NULL, 3, TRUE, TRUE, TRUE),
  ('absence_alert', 'email', 'pastor', NULL, 3, TRUE, FALSE, TRUE),
  ('session_rescheduled', 'role', 'Admin', NULL, NULL, FALSE, TRUE, TRUE),
  ('session_rescheduled', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE),
  ('at_risk_member', 'role', 'Admin', NULL, 3, FALSE, TRUE, TRUE),
  ('at_risk_member', 'role', 'Pastor', NULL, 3, TRUE, TRUE, TRUE),
  ('sunday_absence_streak', 'role', 'Admin', NULL, 3, FALSE, TRUE, TRUE),
  ('sunday_absence_streak', 'role', 'Pastor', NULL, 3, TRUE, TRUE, TRUE),
  ('duty_incomplete', 'role', 'Admin', NULL, NULL, FALSE, TRUE, TRUE),
  ('duty_incomplete', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE),
  ('dishwashing_unresolved', 'role', 'Admin', NULL, NULL, FALSE, TRUE, TRUE),
  ('dishwashing_unresolved', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE)
ON CONFLICT DO NOTHING;

