-- All Bible study attendance and progress saves notify the Pastor through both channels.
-- Preserve recipient/channel choices on later restarts.
INSERT INTO notification_rules (
  event_type, recipient_type, recipient_value, ministry_id,
  threshold, email_enabled, in_app_enabled, enabled
) VALUES
  ('bible_study_update', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE),
  ('bible_study_update', 'email', 'pastor', NULL, NULL, TRUE, FALSE, TRUE)
ON CONFLICT DO NOTHING;
