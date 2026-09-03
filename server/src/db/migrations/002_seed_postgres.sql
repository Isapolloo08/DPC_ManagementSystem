-- ==============================================================================
-- PostgreSQL Seed Data: 002_seed_postgres.sql
-- Pre-seeded 7 Ministries, 4 Roles, Users, Households, Members, Events, Giving, Lookups, Settings
-- ==============================================================================

-- Seed Roles
INSERT INTO roles (id, name) VALUES
  (1, 'Admin'),
  (2, 'Coordinator'),
  (3, 'Leader'),
  (4, 'Volunteer'),
  (5, 'Member')
ON CONFLICT (name) DO NOTHING;

-- Seed 7 Ministries
INSERT INTO ministries (id, name, min_age, max_age, description, color) VALUES
  (1, 'Kinder', 3, 5, 'Ages 3-5: Bible stories, play, crafts, and secure child check-in', '#E07A5F'),
  (2, 'Elementary', 6, 12, 'Ages 6-12: Interactive Sunday school, worship, and Scripture memory', '#D9A441'),
  (3, 'Highschool', 13, 16, 'Ages 13-16: Teen fellowship, small groups, and discipleship', '#B85C56'),
  (4, 'Youth', 17, 21, 'Ages 17-21: College & young adults campus outreach, deep worship', '#6E8B74'),
  (5, 'Young Adult', 22, 35, 'Ages 22-35: Career navigation, marriage & life foundation', '#2C3968'),
  (6, 'Junior Adult', 36, 55, 'Ages 36-55: Family life, parenting, leadership and community impact', '#4A5568'),
  (7, 'Old Adult', 56, 120, 'Ages 56+: Golden years fellowship, prayer warriors & legacy mentorship', '#8D5B4C')
ON CONFLICT (id) DO NOTHING;

-- Seed Users (password: password123)
-- bcrypt hash for 'password123': $2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1
INSERT INTO users (id, name, username, email, password_hash, role_id) VALUES
  (1, 'Pastor David Admin', 'admin', 'admin@church.org', '$2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1', 1),
  (2, 'Sarah Jenkins', 'sarah.jenkins', 'coordinator.kinder@church.org', '$2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1', 2),
  (3, 'Daniel Cruz', 'leader.daniel', 'leader.daniel@church.org', '$2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1', 3),
  (4, 'Marcus Vance', 'marcus.vance', 'volunteer.youth@church.org', '$2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1', 4),
  (5, 'Elena Santos', 'elena.santos', 'member.elena@church.org', '$2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1', 5)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- Seed User Ministries
INSERT INTO user_ministries (user_id, ministry_id) VALUES
  (2, 1),
  (2, 2),
  (3, 3),
  (3, 4)
ON CONFLICT (user_id, ministry_id) DO NOTHING;

-- Seed Households
INSERT INTO households (id, name, address, primary_contact_phone) VALUES
  (1, 'The Santos Family', '742 Evergreen Terrace, Springfield', '+1 (555) 234-5678'),
  (2, 'The Vance Family', '104 Willow Creek Lane', '+1 (555) 876-5432'),
  (3, 'The Bautista Family', '88 Pinecrest Drive', '+1 (555) 345-6789'),
  (4, 'The Chen Family', '12 Magnolia Circle', '+1 (555) 901-2345')
ON CONFLICT (id) DO NOTHING;

-- Seed Members
INSERT INTO members (id, first_name, last_name, birthdate, gender, contact_email, contact_phone, household_id, ministry_id, user_id, status, medical_notes, grade_level) VALUES
  (1, 'Roberto', 'Santos', '1978-04-12', 'Male', 'roberto@santos.org', '+1 (555) 234-5678', 1, 6, null, 'active', null, null),
  (2, 'Elena', 'Santos', '1982-09-20', 'Female', 'member.elena@church.org', '+1 (555) 234-5679', 1, 6, 4, 'active', null, null),
  (3, 'Mateo', 'Santos', '2021-02-15', 'Male', null, null, 1, 1, null, 'active', 'Peanut allergy - EpiPen in backpack', 'Pre-K'),
  (4, 'Sofia', 'Santos', '2015-11-04', 'Female', null, null, 1, 2, null, 'active', null, 'Grade 5'),
  (5, 'Marcus', 'Vance', '2005-02-18', 'Male', 'volunteer.youth@church.org', '+1 (555) 876-5432', 2, 4, 3, 'active', null, 'College Jr'),
  (6, 'Chloe', 'Vance', '2009-08-30', 'Female', 'chloe.v@gmail.com', '+1 (555) 876-5433', 2, 3, null, 'active', null, 'Grade 11'),
  (7, 'Arthur', 'Bautista', '1955-06-10', 'Male', 'arthur.b@church.org', '+1 (555) 345-6789', 3, 7, null, 'active', null, null),
  (8, 'Maria', 'Bautista', '1958-12-01', 'Female', 'maria.b@church.org', '+1 (555) 345-6780', 3, 7, null, 'active', null, null),
  (9, 'Hannah', 'Bautista', '1996-01-24', 'Female', 'hannah.b@techfirm.io', '+1 (555) 345-6781', 3, 5, null, 'active', null, null),
  (10, 'Kevin', 'Chen', '1990-10-15', 'Male', 'kevin.chen@email.com', '+1 (555) 901-2345', 4, 5, null, 'active', null, null),
  (11, 'Leo', 'Chen', '2022-06-10', 'Male', null, null, 4, 1, null, 'active', 'Mild asthma - Inhaler with Coordinator', 'Preschool')
ON CONFLICT (id) DO NOTHING;

-- Seed Events
INSERT INTO events (id, ministry_id, title, description, start_time, end_time, location, created_by) VALUES
  (1, null, 'Sunday All-Church Celebration', 'Sunday morning worship service, communion, and fellowship.', '2026-08-30 09:30:00+00', '2026-08-30 11:30:00+00', 'Main Sanctuary', 1),
  (2, 1, 'Kinder Kingdom: Noah & The Ark', 'Storytime, water crafts, and puppet show for little ones.', '2026-08-30 09:45:00+00', '2026-08-30 11:15:00+00', 'Room 102 (Children Wing)', 2),
  (3, 2, 'Elementary Explorers: Champions of Faith', 'Interactive worship, quiz showdown, and team games.', '2026-08-30 09:45:00+00', '2026-08-30 11:15:00+00', 'Gymnasium Annex', 2),
  (4, 3, 'Highschool IGNITE Friday Night', 'Acoustic worship, pizza night, and breakout discussions.', '2026-09-04 18:30:00+00', '2026-09-04 21:00:00+00', 'Youth Loft', 1),
  (5, 5, 'Young Adult Crossroads: Faith & Career', 'Navigating marketplace leadership and purpose.', '2026-09-06 13:00:00+00', '2026-09-06 15:00:00+00', 'Fellowship Hall Cafe', 1)
ON CONFLICT (id) DO NOTHING;

-- Seed Attendance
INSERT INTO attendance (id, member_id, ministry_id, event_id, security_code, checked_in_at, checked_out_at, checked_in_by, notes) VALUES
  (1, 3, 1, 2, 'KND-4819', '2026-08-23 09:35:00+00', '2026-08-23 11:20:00+00', 2, 'Picked up by mother Elena Santos'),
  (2, 4, 2, 3, 'ELM-9302', '2026-08-23 09:40:00+00', '2026-08-23 11:25:00+00', 2, 'Walked out with parent'),
  (3, 3, 1, 2, 'KND-7731', CURRENT_TIMESTAMP, NULL, 2, 'Active in room 102'),
  (4, 11, 1, 2, 'KND-8824', CURRENT_TIMESTAMP, NULL, 2, 'Active in room 102')
ON CONFLICT (id) DO NOTHING;

-- Seed Announcements
INSERT INTO announcements (id, ministry_id, author_id, title, body, is_pinned) VALUES
  (1, null, 1, 'Welcome to our New Church Management System', 'We are pleased to introduce our digital portal. Members can now view ministry schedules, check in kids securely, and track prayer requests.', TRUE),
  (2, 1, 2, 'Kinder Security Tag Pickup Notice', 'For the safety of all children, parents must present their matching digital/printed security tag code upon checkout.', TRUE),
  (3, 4, 3, 'Youth Camp 2026 Registration Open!', 'Early bird registration is now live. Secure your slot for mountain retreat weekend before Sept 15!', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Seed Prayer Requests
INSERT INTO prayer_requests (id, member_id, ministry_id, request_text, is_anonymous, status) VALUES
  (1, 2, 6, 'Please pray for safe travel and peace as my brother undergoes knee surgery this Tuesday.', FALSE, 'open'),
  (2, null, 4, 'Guidance for college seniors choosing their career paths and remaining steadfast in faith.', TRUE, 'open'),
  (3, 10, 5, 'Thanksgiving for new employment opportunity and blessing of community support.', FALSE, 'answered')
ON CONFLICT (id) DO NOTHING;

-- Seed Funds
INSERT INTO funds (id, name, description, target_amount) VALUES
  (1, 'General Tithes & Offerings', 'Church ministry operations, staff, and worship support.', 120000.00),
  (2, 'Missions & Outreach', 'Local community food bank & overseas missionary support.', 45000.00),
  (3, 'Sanctuary Sound & Media Upgrade', 'High-definition projectors and audio stage monitoring.', 25000.00),
  (4, 'Youth & Children Camp Scholarships', 'Sponsorship for underprivileged children to attend camp.', 15000.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Donations
INSERT INTO donations (id, member_id, fund_id, amount, method, notes, donated_at) VALUES
  (1, 1, 1, 750.00, 'bank transfer', 'Monthly tithe', '2026-08-01 10:30:00+00'),
  (2, 2, 2, 200.00, 'online', 'Missions love gift', '2026-08-05 14:15:00+00'),
  (3, 9, 4, 150.00, 'online', 'Camp sponsor', '2026-08-12 09:00:00+00'),
  (4, 7, 1, 500.00, 'cash', 'Envelope #104', '2026-08-15 11:45:00+00'),
  (5, 1, 3, 300.00, 'bank transfer', 'Sanctuary pledge', '2026-08-20 16:20:00+00')
ON CONFLICT (id) DO NOTHING;

-- Seed Bible Study Groups
INSERT INTO bible_study_groups (id, name, description, curriculum, ministry_id, leader_name, leader_contact, meeting_day, meeting_time, location, category, max_capacity) VALUES
  (1, 'Men of Valor Fellowship', 'Walking in integrity, spiritual leadership at home and work.', 'Book of Romans (Study Guide)', 6, 'Arthur Bautista', '+1 (555) 345-6789', 'Wednesday', '7:00 PM', 'Sanctuary Library Room 201', 'Men''s Group', 12),
  (2, 'Grace & Truth Women''s Circle', 'Encouragement, biblical womanhood, and heartfelt prayer support.', 'Proverbs 31 & Gospel of John', 6, 'Elena Santos', '+1 (555) 234-5679', 'Thursday', '6:30 PM', 'Fellowship Hall Cafe', 'Women''s Group', 14),
  (3, 'IGNITE Youth Discipleship', 'High school believers diving into Scripture, apologetics, and worship.', 'Gospel of Mark & Daily Life', 3, 'Chloe Vance', '+1 (555) 876-5433', 'Friday', '5:00 PM', 'Youth Loft Center', 'Youth', 16),
  (4, 'Young Adults Crossroads (YAC)', 'Navigating career, marriage, purpose, and cultural challenges with biblical truth.', 'Ephesians: Rooted & Grounded', 5, 'Hannah Bautista', '+1 (555) 345-6781', 'Saturday', '4:00 PM', 'Zoom & Coffee Lounge', 'Young Professionals', 15),
  (5, 'Golden Years Prayer & Word', 'Senior saints gathering for hymn singing, intercessory prayer, and deep study.', 'Psalms of Comfort & Hope', 7, 'Maria Bautista', '+1 (555) 345-6780', 'Tuesday', '10:00 AM', 'Room 105 (Annex)', 'Seniors', 20),
  (6, 'Covenant Couples & Family Life', 'Building Christ-centered marriages, intentional parenting, and family worship.', 'Sacred Marriage by Gary Thomas', 6, 'Roberto Santos', '+1 (555) 234-5678', 'Sunday', '4:30 PM', 'Santos Residence / Home Groups', 'Couples / Family', 10)
ON CONFLICT (id) DO NOTHING;

-- Seed Bible Study Members
INSERT INTO bible_study_members (group_id, member_id, member_name) VALUES
  (1, 1, 'Roberto Santos'),
  (1, 7, 'Arthur Bautista'),
  (2, 2, 'Elena Santos'),
  (2, 8, 'Maria Bautista'),
  (3, 6, 'Chloe Vance'),
  (4, 5, 'Marcus Vance'),
  (4, 9, 'Hannah Bautista'),
  (4, 10, 'Kevin Chen'),
  (5, 7, 'Arthur Bautista'),
  (5, 8, 'Maria Bautista'),
  (6, 1, 'Roberto Santos'),
  (6, 2, 'Elena Santos')
ON CONFLICT (group_id, member_id) DO NOTHING;

-- Seed Bible Study Topics
INSERT INTO bible_study_topics (id, title, type, testament_or_category, total_chapters, completed_chapters, status, completed_date, assigned_group_id, assigned_ministry_id, lead_teacher, key_verse, summary_notes) VALUES
  (1, 'Gospel of John: Believe & Live', 'book', 'New Testament', 21, 21, 'completed', '2026-05-15', 2, 6, 'Elena Santos', 'John 20:31', 'Thorough 21-week study through the signs and "I AM" statements of Christ.'),
  (2, 'Ephesians: Calling & Armor of God', 'book', 'New Testament', 6, 6, 'completed', '2026-07-20', 4, 5, 'Hannah Bautista', 'Ephesians 2:8-10', 'Deep dive into spiritual blessings, unity in the body, and spiritual warfare.'),
  (3, 'Romans: The Righteousness of God', 'book', 'New Testament', 16, 9, 'in_progress', null, 1, 6, 'Arthur Bautista', 'Romans 8:1', 'Currently exploring justification by faith and the law of the Spirit of life.'),
  (4, 'Gospel of Mark: The Servant King', 'book', 'New Testament', 16, 12, 'in_progress', null, 3, 3, 'Chloe Vance', 'Mark 10:45', 'Action-packed study of the miracles and cross of Christ for high school youth.'),
  (5, 'Psalms of Comfort, Lament & Praise', 'book', 'Old Testament', 150, 45, 'in_progress', null, 5, 7, 'Maria Bautista', 'Psalm 23:1', 'Weekly exposition of selected Psalms bringing comfort and assurance.'),
  (6, 'Proverbs: Wisdom for Everyday Decisions', 'topical', 'Practical Wisdom', 31, 31, 'completed', '2026-08-10', 6, 6, 'Roberto Santos', 'Proverbs 3:5-6', 'Family finances, communication, relationships, and raising godly children.')
ON CONFLICT (id) DO NOTHING;

-- Seed System Lookups
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

-- Seed System Settings
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

-- Reset primary key sequences for PostgreSQL
SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1));
SELECT setval('ministries_id_seq', COALESCE((SELECT MAX(id) FROM ministries), 1));
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('households_id_seq', COALESCE((SELECT MAX(id) FROM households), 1));
SELECT setval('members_id_seq', COALESCE((SELECT MAX(id) FROM members), 1));
SELECT setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 1));
SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM attendance), 1));
SELECT setval('announcements_id_seq', COALESCE((SELECT MAX(id) FROM announcements), 1));
SELECT setval('prayer_requests_id_seq', COALESCE((SELECT MAX(id) FROM prayer_requests), 1));
SELECT setval('funds_id_seq', COALESCE((SELECT MAX(id) FROM funds), 1));
SELECT setval('donations_id_seq', COALESCE((SELECT MAX(id) FROM donations), 1));
SELECT setval('bible_study_groups_id_seq', COALESCE((SELECT MAX(id) FROM bible_study_groups), 1));
SELECT setval('bible_study_members_id_seq', COALESCE((SELECT MAX(id) FROM bible_study_members), 1));
SELECT setval('bible_study_topics_id_seq', COALESCE((SELECT MAX(id) FROM bible_study_topics), 1));
SELECT setval('system_lookups_id_seq', COALESCE((SELECT MAX(id) FROM system_lookups), 1));
