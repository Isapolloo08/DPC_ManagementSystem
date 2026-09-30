-- ==============================================================================
-- PostgreSQL Migration: 012_update_notification_roles_for_pastor_and_admin.sql
-- Description: Ensures notifications and alerts are strictly routed to Pastor and Admin (Super Admin).
-- Removes legacy notification rules targeting Coordinator, Leader, Member, Volunteer.
-- Seeds in-app and email notification rules for both Admin and Pastor across all notification events.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Remove non-Admin and non-Pastor roles from notification rules
  DELETE FROM notification_rules
  WHERE recipient_type = 'role'
    AND recipient_value NOT IN ('Admin', 'Pastor', 'IT Admin');

  -- 2. Insert or update default notification rules for Admin & Pastor
  INSERT INTO notification_rules (
    event_type, recipient_type, recipient_value, ministry_id,
    threshold, email_enabled, in_app_enabled, enabled
  ) VALUES
    -- Absence alert (Bible Study attendance)
    ('absence_alert', 'role', 'Admin', NULL, 3, FALSE, TRUE, TRUE),
    ('absence_alert', 'role', 'Pastor', NULL, 3, TRUE, TRUE, TRUE),
    ('absence_alert', 'email', 'pastor', NULL, 3, TRUE, FALSE, TRUE),

    -- Session rescheduled (Bible Study schedule change)
    ('session_rescheduled', 'role', 'Admin', NULL, NULL, FALSE, TRUE, TRUE),
    ('session_rescheduled', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE),

    -- At-risk member alerts
    ('at_risk_member', 'role', 'Admin', NULL, 3, FALSE, TRUE, TRUE),
    ('at_risk_member', 'role', 'Pastor', NULL, 3, TRUE, TRUE, TRUE),

    -- Sunday absence streak
    ('sunday_absence_streak', 'role', 'Admin', NULL, 3, FALSE, TRUE, TRUE),
    ('sunday_absence_streak', 'role', 'Pastor', NULL, 3, TRUE, TRUE, TRUE),

    -- Saturday duty roster incomplete
    ('duty_incomplete', 'role', 'Admin', NULL, NULL, FALSE, TRUE, TRUE),
    ('duty_incomplete', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE),

    -- Dishwashing roster unresolved
    ('dishwashing_unresolved', 'role', 'Admin', NULL, NULL, FALSE, TRUE, TRUE),
    ('dishwashing_unresolved', 'role', 'Pastor', NULL, NULL, TRUE, TRUE, TRUE)
  ON CONFLICT (event_type, recipient_type, recipient_value, COALESCE(ministry_id, 0))
  DO UPDATE SET
    in_app_enabled = EXCLUDED.in_app_enabled,
    email_enabled = EXCLUDED.email_enabled,
    enabled = EXCLUDED.enabled;

END $$;
