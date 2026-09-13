-- ==============================================================================
-- PostgreSQL System Baseline Configuration: 002_seed_postgres.sql
-- Roles, Core Ministries, System Lookups, and Default System Settings (No Mock Data)
-- ==============================================================================

-- 1. Ensure 5 System Roles exist
INSERT INTO roles (id, name) VALUES
  (1, 'Admin'),
  (2, 'Coordinator'),
  (3, 'Leader'),
  (4, 'Volunteer'),
  (5, 'Member')
ON CONFLICT (name) DO NOTHING;

-- 2. Ensure 7 Core Age-Bracket Ministries exist
INSERT INTO ministries (id, name, min_age, max_age, description, color) VALUES
  (1, 'Kinder', 3, 5, 'Ages 3-5: Bible stories, play, crafts, and secure child check-in', '#E07A5F'),
  (2, 'Elementary', 6, 12, 'Ages 6-12: Interactive Sunday school, worship, and Scripture memory', '#D9A441'),
  (3, 'Highschool', 13, 16, 'Ages 13-16: Teen fellowship, small groups, and discipleship', '#B85C56'),
  (4, 'Youth', 17, 21, 'Ages 17-21: College & young adults campus outreach, deep worship', '#6E8B74'),
  (5, 'Young Adult', 22, 35, 'Ages 22-35: Career navigation, marriage & life foundation', '#2C3968'),
  (6, 'Junior Adult', 36, 55, 'Ages 36-55: Family life, parenting, leadership and community impact', '#4A5568'),
  (7, 'Old Adult', 56, 120, 'Ages 56+: Golden years fellowship, prayer warriors & legacy mentorship', '#8D5B4C')
ON CONFLICT (name) DO NOTHING;

-- 3. System Lookups (Default reference categories for dropdowns & forms)
INSERT INTO system_lookups (type, name, description, color, sort_order, is_active) VALUES
  ('bible_study_category', 'General', 'General fellowship & Bible study groups', '#2C3968', 1, 1),
  ('bible_study_category', 'Men''s Group', 'Men of integrity, fatherhood & spiritual leadership', '#1E40AF', 2, 1),
  ('bible_study_category', 'Women''s Group', 'Women of grace, encouragement & prayer', '#BE185D', 3, 1),
  ('bible_study_category', 'Youth', 'Teens & high school discipleship', '#059669', 4, 1),
  ('bible_study_category', 'Young Professionals', 'Career navigation, dating & marketplace faith', '#D97706', 5, 1),
  ('bible_study_category', 'Couples / Family', 'Marriage enrichment and parenting', '#7C3AED', 6, 1),
  ('bible_study_category', 'Seniors', 'Golden age prayer and wisdom circle', '#92400E', 7, 1),
  ('event_location', 'Main Sanctuary', 'Primary worship center (capacity 350)', '#2C3968', 1, 1),
  ('event_location', 'Room 102 (Children Wing)', 'Children classrooms & nursery', '#E07A5F', 2, 1),
  ('event_location', 'Gymnasium Annex', 'Multi-purpose recreational hall', '#D9A441', 3, 1),
  ('event_location', 'Youth Loft Center', 'Second floor youth meeting room', '#6E8B74', 4, 1),
  ('event_location', 'Fellowship Hall Cafe', 'Dining area and informal lounge', '#4A5568', 5, 1),
  ('event_category', 'Sunday Worship', 'Weekly Sunday divine worship service', '#2C3968', 1, 1),
  ('event_category', 'Midweek Prayer', 'Wednesday corporate prayer and intercession', '#1E40AF', 2, 1),
  ('event_category', 'Youth Night', 'Saturday youth fellowship & games', '#059669', 3, 1),
  ('event_category', 'Family Fellowship', 'Church-wide potluck and community gathering', '#D9A441', 4, 1),
  ('event_category', 'Leadership Meeting', 'Session and ministry leader strategy', '#7C3AED', 5, 1),
  ('event_category', 'Community Outreach', 'Medical mission, feeding, and charity work', '#E07A5F', 6, 1),
  ('prayer_topic', 'Healing & Health', 'Physical, emotional, and mental healing', '#BE185D', 1, 1),
  ('prayer_topic', 'Family & Marriage', 'Parenting, marital peace, and home blessings', '#7C3AED', 2, 1),
  ('prayer_topic', 'Financial Provision', 'Employment, business, and debt freedom', '#059669', 3, 1),
  ('prayer_topic', 'Spiritual Growth', 'Discipleship, devotion, and sanctification', '#1E40AF', 4, 1),
  ('prayer_topic', 'Church & Missions', 'Pastors, church plants, and missionary support', '#D97706', 5, 1),
  ('announcement_category', 'General Announcement', 'Important church-wide notices', '#2C3968', 1, 1),
  ('announcement_category', 'Ministry Update', 'Reports from departments and coordinators', '#059669', 2, 1),
  ('announcement_category', 'Urgent Prayer', 'Immediate intercession requests', '#BE185D', 3, 1),
  ('announcement_category', 'Volunteer Opportunity', 'Calls for service helpers and teachers', '#D97706', 4, 1),
  ('member_status', 'Active Member', 'Regular attendee with covenant commitment', '#059669', 1, 1),
  ('member_status', 'Regular Attendee', 'Attends services regularly, not yet formal member', '#1E40AF', 2, 1),
  ('member_status', 'Visitor / Guest', 'First-time or occasional visitor', '#D97706', 3, 1),
  ('member_status', 'Inactive', 'Has not attended in past 6 months', '#64748B', 4, 1),
  ('payment_method', 'Cash', 'Physical envelope or donation box', '#10B981', 1, 1),
  ('payment_method', 'GCash', 'Philippine mobile wallet QR scan', '#007DFE', 2, 1),
  ('payment_method', 'Bank Transfer', 'Direct BDO / BPI bank deposit', '#6366F1', 3, 1),
  ('payment_method', 'Online / Card', 'Credit/Debit card or Stripe payment', '#8B5CF6', 4, 1)
ON CONFLICT (type, name) DO NOTHING;

-- 4. Default System Settings
INSERT INTO system_settings (key, value, category) VALUES
  ('church_name', 'Daet Presbyterian Church', 'general'),
  ('church_tagline', 'Knowing Christ and Making Him Known', 'general'),
  ('contact_email', 'contact@daetpresbyterian.org', 'general'),
  ('contact_phone', '+63 (54) 440-1234', 'general'),
  ('address', 'Vinzon Avenue, Daet, Camarines Norte', 'general'),
  ('sunday_service_time', '9:30 AM', 'general'),
  ('currency_symbol', '₱', 'finance'),
  ('tax_exempt_id', 'TIN-009-876-543-000', 'finance')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Align Sequence IDs
SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1));
SELECT setval('ministries_id_seq', COALESCE((SELECT MAX(id) FROM ministries), 1));
SELECT setval('system_lookups_id_seq', COALESCE((SELECT MAX(id) FROM system_lookups), 1));
