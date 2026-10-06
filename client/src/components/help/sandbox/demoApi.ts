import { demoToken, guideSandbox, isGuideSandbox } from './runtime';

// API-shaped fixtures belong to this document only. They never enter real caches,
// localStorage, Socket.IO, or a server. Responses are copied just like HTTP JSON.
type Row = Record<string, any>;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const today = isoDate(new Date());
const now = new Date().toISOString();
function nextWeekday(day: number, offset = 0) {
  const date = new Date(); date.setDate(date.getDate() + (day - date.getDay() + 7) % 7 + offset * 7);
  return isoDate(date);
}

export function createDemoDatabase(role: string) {
  let nextId = 99900;
  const ministries: Row[] = ['Kinder', 'Elementary', 'Highschool', 'Youth', 'Young Adult', 'Junior Adult', 'Old Adult'].map((name, index) => ({
    id: index + 1, name, color: ['#d97706', '#0891b2', '#e11d48', '#64748b', '#4f46e5', '#059669', '#7c3aed'][index],
    min_age: [3, 6, 13, 17, 26, 36, 56][index], max_age: [5, 12, 16, 25, 35, 55, 120][index],
    description: 'Sample ministry', member_count: 1, active_members_count: 1, today_checkins_count: 0, coordinators: [], volunteers: [],
  }));
  const roles = ['Admin', 'Pastor', 'Coordinator', 'Leader', 'Volunteer', 'Member', 'IT Admin'].map((name, index) => ({ id: index + 1, name, description: `Sample ${name} role` }));
  let members: Row[] = ['Ana', 'Ben', 'Carlo', 'Diego', 'Elena', 'Grace'].map((first_name, index) => {
    const ministry = ministries[[3, 3, 1, 5, 5, 6][index]];
    return { id: 9101 + index, first_name, middle_name: '', last_name: 'Sample', full_name: `${first_name} Sample`,
      birthdate: ['2004-04-15', '2005-06-20', '2018-02-10', '1985-01-12', '1987-08-07', '1960-11-14'][index],
      gender: index % 2 ? 'Male' : 'Female', status: 'active', member_status: 'active', membership_type: 'regular',
      membership_status: 'baptized_regular', contact_phone: '09123456789', contact_email: `${first_name.toLowerCase()}@example.test`,
      ministry_id: ministry.id, ministry_name: ministry.name, ministry_color: ministry.color,
      household_id: 9201, household_name: 'Sample Santos Family', address: 'Sample Street, Daet, Camarines Norte',
      baptism_status: 'baptized', baptism_date: '2024-06-01', is_baptized: true, medical_notes: '',
      created_at: now, emergency_contact_name: 'Elena Sample', emergency_contact_phone: '09123456789',
    };
  });
  const account: Row = { id: 9901, name: `Demo ${role}`, username: 'demo.practice', email: 'demo@example.test',
    role_id: roles.find(item => item.name === role)?.id, role_name: role,
    ministries: ['Admin', 'Pastor', 'IT Admin'].includes(role) ? [] : [ministries[3]],
    member_id: 9101, member: members[0], linked_member_name: 'Ana Sample', created_at: now, contact_phone: '09123456789' };
  let users: Row[] = [account, { ...account, id: 9902, name: 'Sample Leader', username: 'sample.leader', email: 'leader@example.test', role_name: 'Leader', role_id: 4 },
    { ...account, id: 9903, name: 'Sample Member', username: 'sample.member', email: 'member@example.test', role_name: 'Member', role_id: 6, member_id: 9102 }];
  let households: Row[] = [{ id: 9201, name: 'Sample Santos Family', address: 'Sample Street, Daet, Camarines Norte',
    primary_contact_phone: '09123456789', father_name: 'Diego Sample', mother_name: 'Elena Sample', guardian_name: '',
    family_members: members.map(member => ({ name: member.full_name, member_id: member.id, relationship: member.id === 9104 ? 'Father' : member.id === 9105 ? 'Mother' : 'Child' })),
    members, member_count: members.length, created_at: now }];
  let topics: Row[] = [{ id: 9301, title: 'Sample Faith Foundations', total_chapters: 8, summary_notes: 'Practice curriculum: introduction, faith, prayer and discipleship.', created_at: now },
    { id: 9302, title: 'Sample Gospel Study', total_chapters: 6, summary_notes: 'A second example book for practicing curriculum selection.', created_at: now }];
  const disciples = (): Row[] => members.slice(0, 3).map(member => ({ ...member, member_id: member.id, member_name: member.full_name, membership_role: 'Member', joined_at: now }));
  let groups: Row[] = [{ id: 9501, name: 'Sample Faith Group', description: 'A sample discipleship group for this walkthrough.',
    status: 'active', category: 'General', ministry_id: 4, ministry_name: 'Youth', ministry_color: ministries[3].color,
    leader_id: account.id, leader_name: account.name, leader_contact: '09123456789', assistant_leader_name: 'Sample Leader',
    leaders: [{ id: account.id, name: account.name, role: 'Leader' }], curriculum: topics[0].title,
    book_id: 9301, current_chapter: 'Chapter 2', progress_stage: 'in_progress', progress_notes: 'Sample progress',
    meeting_day: new Date().toLocaleDateString('en-US', { weekday: 'long' }), meeting_time: '7:00 PM - 8:00 PM',
    location: 'Sample Fellowship Room', max_capacity: 12, members: disciples(), current_member_count: 3,
    is_rescheduled: false, created_at: now }];
  let announcements: Row[] = [{ id: 9601, title: 'Sample Fellowship Notice', body: 'This is sample information. Practice reading or publishing a notice here.',
    ministry_id: null, author_id: account.id, author_name: account.name, author_role: role, is_pinned: 1, created_at: now }];
  let events: Row[] = [{ id: 9701, title: 'Sample Church Fellowship', name: 'Sample Church Fellowship', description: 'Sample gathering for practicing the calendar.',
    start_time: `${today}T09:00:00`, end_time: `${today}T11:00:00`, event_date: today,
    location: 'Sample Fellowship Room', event_type: 'fellowship', ministry_id: null, created_by: account.id, registration_count: 3, created_at: now }];
  let recurring: Row[] = [{ id: 9702, name: 'Sample Thanksgiving Service', title: 'Sample Thanksgiving Service',
    month: new Date().getMonth() + 1, week_pattern: '1st_sunday', sunday_ordinal: 1, week_of_month: 1, event_type: 'thanksgiving', description: 'Sample annual celebration',
    recurrence_type: 'nth_sunday', is_active: true, projected_date: nextWeekday(0), projected_formatted: nextWeekday(0), is_synced_to_calendar: false }];
  let services: Row[] = [0, 1, 2].map((offset, index) => ({ id: 9801 + index, title: 'Sample Sunday Worship', service_date: nextWeekday(0, offset),
    service_type: 'sunday_service', status: 'held', notes: 'Sample service', check_in_count: index === 0 ? 3 : 0, is_recorded: index === 0 }));
  const teamMembers = () => disciples().map((member, index) => ({ ...member, assignment_id: 9950 + index, team_role: index === 0 ? 'Team Leader' : 'Member' }));
  let dutyTeams: Row[] = [{ id: 9401, name: 'Sample Sanctuary Team', ministry_id: 4, ministry_name: 'Youth', color: '#64748b',
    leader_id: account.id, leader_name: account.name, order_seq: 1, tasks_checklist: 'Sweep the sanctuary\nArrange chairs', members_count: 3, members: teamMembers() },
    { id: 9402, name: 'Sample Welcome Team', ministry_id: 4, ministry_name: 'Youth', color: '#0891b2', leader_name: 'Sample Leader', order_seq: 2, members_count: 1, members: teamMembers().slice(0, 1) }];
  let washingTeams: Row[] = dutyTeams.map((team, index) => ({ ...team, id: 9451 + index, name: index ? 'Sample Kitchen Team' : 'Sample Fellowship Team',
    cycle_mode: 'custom', volunteers_count: 3, leader_contact: '09123456789', biblestudy_group_ids: [], ministry_ids: [4] }));
  let roster: Row[] = members.map(member => ({ ...member, member_id: member.id, attendance_id: member.id === 9103 ? 9913 : null,
    checked_in_at: member.id === 9103 ? now : null, checked_out_at: null, security_code: member.id === 9103 ? 'DEMO123' : null,
    attendance_notes: '', is_present: member.id === 9103 ? 1 : 0, attendance_status: member.id === 9103 ? 'present' : 'unmarked' }));
  let groupRecords: Row[] = disciples().map(member => ({ member_id: member.id, member_name: member.full_name, session_date: today, status: 'present', notes: 'Sample attendance' }));
  let notifications: Row[] = [{ id: 9961, title: 'Sample group reminder', message: 'Your sample group has a meeting today.', body: 'Your sample group has a meeting today.',
    type: 'group_meeting', event_type: 'group_meeting', is_read: 0, created_at: now, related_tab: 'leaderportal', target_tab: 'leaderportal' }];
  let audit: Row[] = [{ id: 9971, user_id: account.id, user_name: account.name, user_email: account.email, role_name: role,
    action: 'UPDATE', target_table: 'members', target_id: 9101, details: JSON.stringify({ before: { contact_phone: 'Sample old phone' }, after: { contact_phone: '09123456789' } }), created_at: now }];
  let lookups: Row[] = [['event_location', 'Sample Fellowship Room'], ['bible_study_category', 'General'], ['event_category', 'Fellowship'], ['member_status', 'Regular'], ['announcement_category', 'Notice']]
    .map(([type, value], index) => ({ id: 9981 + index, type, name: value, value, label: value, description: 'Sample option', color: '#64748b', is_active: true, sort_order: index }));
  let settings: Row = { church_name: 'Sample Presbyterian Church', church_address: 'Sample Street, Daet', church_contact_phone: '09123456789', church_email: 'church@example.test' };
  let emailSettings: Row = { enabled: false, configured: false, provider: 'smtp', smtp_host: 'smtp.example.test', smtp_port: 587, sender_email: 'sample@example.test' };
  const stats = () => ({ present: roster.filter(row => row.attendance_status === 'present').length, absent: roster.filter(row => row.attendance_status === 'absent').length,
    excused: roster.filter(row => row.attendance_status === 'excused').length, unmarked: roster.filter(row => row.attendance_status === 'unmarked').length, total: roster.length });
  const result = (extra: Row = {}) => ({ success: true, message: 'Saved in this practice session only.', ...extra });
  const paginate = (rows: Row[], query: URLSearchParams) => {
    const page = Number(query.get('page')) || 1, limit = Number(query.get('limit')) || 20;
    return { data: rows.slice((page - 1) * limit, page * limit), pagination: { total: rows.length, page, limit, totalPages: Math.ceil(rows.length / limit) || 1 } };
  };
  const filtered = (rows: Row[], query: URLSearchParams) => rows.filter(row => {
    const search = query.get('search')?.toLowerCase();
    return (!search || JSON.stringify(row).toLowerCase().includes(search)) && (!query.get('ministry_id') || !row.ministry_id || row.ministry_id === Number(query.get('ministry_id')));
  });
  const schedule = (teams: Row[], weekday: number) => Array.from({ length: 12 }, (_, index) => ({
    duty_date: nextWeekday(weekday, index), date_formatted: new Date(`${nextWeekday(weekday, index)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    week_number: index + 1, is_this_saturday: weekday === 6 && index === 0, is_next_saturday: weekday === 6 && index === 1,
    is_this_sunday: weekday === 0 && index === 0, is_next_sunday: weekday === 0 && index === 1, is_past: false,
    status: index === 0 ? 'on_duty' : 'scheduled', team: teams[index % teams.length] ?? null, notes: 'Sample schedule',
  }));
  const birthdaySummary = () => ({ celebrants: members.slice(0, 2).map(member => ({ ...member, birth_month: new Date().getMonth() + 1, birth_day: new Date().getDate(),
    birth_month_name: new Date().toLocaleDateString('en-US', { month: 'long' }), current_age: 22, turning_age: 23,
    days_until_birthday: 0, next_birthday_date: today, is_today: true, is_this_week: true, is_this_month: true })),
    counts: { today: 2, this_week: 2, this_month: 2, next_30_days: 2, total_active: members.length },
    monthly_distribution: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, month_name: new Date(2026, index).toLocaleDateString('en-US', { month: 'long' }),
      count: index === new Date().getMonth() ? 2 : 0, celebrants: index === new Date().getMonth() ? members.slice(0, 2).map(member => ({ ...member, birth_day: new Date().getDate() })) : [] })) });
  const backupTables = () => ({ members, households, bible_study_groups: groups, attendance: roster, events, duty_schedules: schedule(dutyTeams, 6), dishwashing_roster: schedule(washingTeams, 0), announcements, notifications, members_created: members });
  const groupAttendance = (groupId: number) => {
    const group = groups.find(row => row.id === groupId) || groups[0];
    const enrolled: Row[] = group.members || [];
    const dates = [...new Set(groupRecords.map(row => row.session_date))].sort().reverse();
    const sessions = dates.map((date, index) => {
      const records = groupRecords.filter(row => row.session_date === date);
      const people: Row[] = records.map(row => ({ ...row, name: members.find(member => member.id === row.member_id)?.full_name || 'Sample member' }));
      const attendees = people.filter(row => row.status === 'present'), absentees = people.filter(row => row.status === 'absent'), excused = people.filter(row => row.status === 'excused');
      return { id: 9990 + index, session_date: date, topic_title: records[0]?.topic_title || 'Sample Faith Foundations', chapter: records[0]?.chapter || 'Chapter 2',
        recorded_by_name: account.name, present_count: attendees.length, absent_count: absentees.length, excused_count: excused.length,
        total_enrolled: enrolled.length, attendees, absentees, excused };
    });
    const summaryMembers = enrolled.map(member => {
      const history = groupRecords.filter(row => row.member_id === (member.member_id || member.id));
      const present = history.filter(row => row.status === 'present').length;
      return { ...member, display_name: member.member_name || member.full_name, total_sessions: dates.length,
        present_count: present, absent_count: history.filter(row => row.status === 'absent').length, excused_count: history.filter(row => row.status === 'excused').length,
        consecutive_absences: 0, attendance_rate: dates.length ? Math.round(present / dates.length * 100) : 0, health_status: present ? 'consistent' : 'moderate', history };
    });
    const totalPresents = sessions.reduce((sum, session) => sum + session.present_count, 0);
    return { group, members: summaryMembers, sessions, summary: { total_sessions: dates.length, total_enrolled: enrolled.length,
      overall_attendance_rate: dates.length && enrolled.length ? Math.round(totalPresents / (dates.length * enrolled.length) * 100) : 0,
      total_absences: sessions.reduce((sum, session) => sum + session.absent_count, 0), total_presents: totalPresents, at_risk_count: 0,
      average_attendees_per_session: dates.length ? (totalPresents / dates.length).toFixed(1) : '0' } };
  };

  async function handle(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = new URL(endpoint, 'https://practice.example.test'), path = url.pathname, query = url.searchParams;
    const method = (options.method || 'GET').toUpperCase();
    const body: Row = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : {};
    const id = Number(path.split('/')[2]);
    let response: any;
    if (method === 'GET') {
      if (path === '/auth/me') response = { user: account };
      else if (path === '/auth/setup-status') response = { hasUsers: true, totalUsers: 3, hasAdmin: true, totalAdmins: 1, isFirstUser: false, demoModeEnabled: false };
      else if (path === '/auth/demo-users') response = users;
      else if (path === '/auth/profile-activity') response = { attendanceCount: 3, groupsLed: role === 'Member' ? [] : groups, groupsAttended: groups, dutiesAssigned: [{ team_id: 9401, team_name: 'Sample Sanctuary Team', duty_role: 'Member' }] };
      else if (path === '/ministries') response = ministries;
      else if (path === '/ministries/suggest') response = { calculated_age: 22, suggested_ministry: ministries[3] };
      else if (path === '/roles') response = roles;
      else if (path === '/users') response = query.has('page') ? paginate(users, query) : users;
      else if (/^\/users\/\d+$/.test(path)) response = users.find(row => row.id === id);
      else if (path === '/members/check-duplicate') response = { exists: false, duplicateName: null, duplicateEmail: null, duplicatePhone: null };
      else if (path === '/members/birthdays') response = birthdaySummary();
      else if (path === '/members/baptism-candidates/qualified') response = { candidates: [], counts: { total_qualified: 0, pending_nomination: 0 } };
      else if (path === '/members/aging-out') response = [];
      else if (path === '/members') response = query.has('page') ? paginate(filtered(members, query), query) : filtered(members, query);
      else if (/^\/members\/\d+$/.test(path)) response = members.find(row => row.id === id);
      else if (/^\/members\/\d+\/attendance-summary$/.test(path)) {
        const member = members.find(row => row.id === id) || members[0];
        const metrics = { attended: 3, missed: 1, absent: 1, excused: 0, unrecorded_services_count: 0, total_held_services: 4,
          attendance_rate_percentage: 75, consistency_rate_percentage: 75, current_streak: 2, longest_streak: 3, last_attended_date: today };
        response = { member, member_id: id, from_date: query.get('from') || today, to_date: query.get('to') || today,
          sunday_service: metrics, bible_study: metrics, events: { attended: 1, total_events: 1, last_attended_date: today, events_list: events },
          overall_attendance_rate: 75, consistency_score: 75, consistency_tier: 'Regular Attendee',
          monthly_breakdown: [{ month_num: new Date().getMonth() + 1, month_name: new Date().toLocaleDateString('en-US', { month: 'long' }), present: 3, absent: 1, excused: 0, total_sundays_in_month: 4, elapsed_sundays: 4, is_future: false }],
          records: [{ id: 9913, checked_in_at: now, date_str: today, time_str: '09:00 AM', status: 'present', notes: 'Sample service', security_code: 'DEMO123', checked_in_by_name: account.name }],
          baptism_tracker: { is_baptized: member.is_baptized, baptism_status: member.baptism_status, baptism_date: member.baptism_date, is_eligible_for_ceremony: false, should_alert: false } };
      }
      else if (path === '/households') response = households.map(row => ({ ...row, members: members.filter(member => member.household_id === row.id), member_count: members.filter(member => member.household_id === row.id).length }));
      else if (/^\/households\/\d+$/.test(path)) response = households.find(row => row.id === id);
      else if (path === '/groups/mine') response = groups.filter(row => row.status === 'active');
      else if (path === '/groups/transitions') response = [];
      else if (path === '/groups') response = filtered(groups, query);
      else if (/^\/groups\/\d+\/history$/.test(path)) response = { group: groups.find(row => row.id === id), history: [], transitions: [], attendance_sessions: [] };
      else if (/^\/groups\/\d+\/attendance$/.test(path)) response = groupAttendance(id);
      else if (path === '/study-topics') response = { topics: filtered(topics, query), all: topics, total_count: topics.length, total: topics.length, summary: {} };
      else if (/^\/study-topics\/\d+$/.test(path)) response = { topic: topics.find(row => row.id === id), all_groups: groups, group_members: disciples() };
      else if (path === '/attendance/roster') response = filtered(roster, query);
      else if (path === '/attendance/today') response = roster.filter(row => row.attendance_id);
      else if (path === '/attendance/trends') response = ministries.map(ministry => ({ ministry_id: ministry.id, ministry_name: ministry.name, color: ministry.color, total_checkins: 3, weekly: [] }));
      else if (path === '/attendance-log') {
        const rows = members.slice(0, 3).map(member => ({ logType: 'sunday_service', logDate: today, memberId: member.id, memberName: member.full_name,
          ministryId: member.ministry_id, ministryName: member.ministry_name, status: 'present', recordedAt: now }));
        response = { rows, total: rows.length, page: 1, pageSize: 20, summary: { total: 3, present: 3, absent: 0, excused: 0 } };
      }
      else if (path === '/services') response = { services, total: services.length, from_date: query.get('from') || today, to_date: query.get('to') || nextWeekday(0, 12) };
      else if (path === '/events/recurring-sunday-cycle') response = { year: Number(query.get('year')) || new Date().getFullYear(), available_years: [new Date().getFullYear()], events: recurring, total_annual_events: recurring.length, summary: {} };
      else if (path === '/events') response = events;
      else if (/^\/events\/\d+\/attendance-roster$/.test(path)) response = { event: events.find(row => row.id === id), attendees: roster.map((row, index) => ({ ...row, registered_at: index < 3 ? now : null,
        status: index === 0 ? 'attended' : index < 3 ? 'registered' : 'unregistered' })), summary: { total_registered: 3, total_attended: 1, total_absent: 0, total_excused: 0, total_active_members: members.length } };
      else if (path === '/communications/announcements') response = announcements;
      else if (path === '/duty/teams') response = filtered(dutyTeams, query);
      else if (path === '/dishwashing/teams') response = washingTeams;
      else if (path === '/duty/schedule') response = { schedule: schedule(dutyTeams, 6), total_teams: dutyTeams.length, cycle_interval_weeks: dutyTeams.length };
      else if (path === '/dishwashing/schedule') { const rows = schedule(washingTeams, 0); response = { schedule: rows, thisSunday: rows[0], nextSunday: rows[1], total_teams: washingTeams.length, cycle_interval_weeks: washingTeams.length }; }
      else if (path === '/dishwashing') response = { duties: [], stats: { total: 0 }, teams: washingTeams };
      else if (path === '/audit') response = audit;
      else if (path === '/settings/lookups') response = lookups.filter(row => !query.get('type') || row.type === query.get('type'));
      else if (path === '/settings/general') response = { settings, list: Object.entries(settings).map(([key, value]) => ({ key, value })) };
      else if (path === '/reports/dashboard') response = { metrics: { total_active_members: members.length, total_households: households.length, today_checkins: 1, active_announcements: announcements.length,
        upcoming_events_count: events.length, aging_out_alerts_count: 0, unenrolled_members_count: 3, birthdays_this_month_count: 2 },
        ministry_breakdown: ministries.map(ministry => ({ ...ministry, ministry_id: ministry.id, ministry_name: ministry.name, member_count: members.filter(member => member.ministry_id === ministry.id).length, today_checkins: 0 })) };
      else if (path === '/reports/growth-insights') response = { timeframe: query.get('timeframe') || '6m', summary: { total_active_members: members.length, discipleship_ratio: 50, disciples_in_groups: 3,
        total_groups: groups.length, total_capacity: 12, capacity_utilization: 25, retention_rate: 80, total_new_members: 5, new_members_attended: 4,
        new_members_in_groups: 3, new_members_baptized: 3, total_baptisms_period: 3, avg_weekly_attendance: 4, peak_attendance: 5 },
        baptisms: [{ month_key: today.slice(0, 7), month_label: 'Sample month', count: 3, male_count: 1, female_count: 2 }],
        attendance_trends: [{ date: today, date_label: 'Sample Sunday', day_name: 'Sunday', total: 4, present: 4, late: 0, unique_members: 4 }], ministry_attendance: [],
        groups_list: groups.map(row => ({ ...row, enrolled_count: row.members.length, utilization_rate: 25 })) };
      else if (path === '/notifications/unread-count') response = { count: notifications.filter(row => !row.is_read).length };
      else if (path === '/notifications') response = { items: notifications.filter(row => query.get('unread') !== 'true' || !row.is_read), unread_count: notifications.filter(row => !row.is_read).length };
      else if (path === '/notifications/email-settings') response = emailSettings;
      else if (path === '/notifications/rules') response = [];
      else if (path === '/cloud-sync/status') response = { configured: false, enabled: false, connected: false, isConfigured: false, message: 'Sample workspace' };
      else if (path === '/bible-reading/progress') response = { success: true, completedKeys: [], records: [] };
      else if (path === '/bible-reading/stats') response = { success: true, totalCompletionsCount: 3, activeReadersCount: 2 };
      else if (path === '/backup/summary') response = { success: true, totalStats: { members: members.length, households: households.length, attendance: 3, events: 1, announcements: 1 },
        yearlyBreakdown: [{ year: new Date().getFullYear(), totalRecords: 10, attendance: 3, events: 1, dutySchedules: 2, dishwashingRoster: 2, announcements: 1, notifications: 1, membersCreated: 6 }], generatedAt: now };
      else if (/^\/backup\/year-details\//.test(path)) response = { success: true, year: Number(path.split('/')[3]), tables: backupTables() };
      else throw new Error(`Sample data is not configured for ${path}. No server request was made.`);
    } else {
      const collections: Record<string, { get: () => Row[]; set: (rows: Row[]) => void }> = {
        '/members': { get: () => members, set: rows => { members = rows; } }, '/households': { get: () => households, set: rows => { households = rows; } },
        '/groups': { get: () => groups, set: rows => { groups = rows; } }, '/study-topics': { get: () => topics, set: rows => { topics = rows; } },
        '/users': { get: () => users, set: rows => { users = rows; } }, '/ministries': { get: () => ministries, set: rows => { ministries.splice(0, ministries.length, ...rows); } },
        '/services': { get: () => services, set: rows => { services = rows; } }, '/events': { get: () => events, set: rows => { events = rows; } },
        '/events/recurring-sunday-cycle': { get: () => recurring, set: rows => { recurring = rows; } },
        '/communications/announcements': { get: () => announcements, set: rows => { announcements = rows; } },
        '/duty/teams': { get: () => dutyTeams, set: rows => { dutyTeams = rows; } }, '/dishwashing/teams': { get: () => washingTeams, set: rows => { washingTeams = rows; } },
        '/settings/lookups': { get: () => lookups, set: rows => { lookups = rows; } },
      };
      const root = Object.keys(collections).find(key => path === key || new RegExp(`^${key}/\\d+$`).test(path));
      if (root) {
        const collection = collections[root], recordId = Number(path.slice(root.length + 1));
        const row: Row = { ...(collection.get().find(item => item.id === recordId) || collection.get()[0]), ...body, id: recordId || ++nextId, created_at: now };
        if (root === '/members') {
          row.full_name = `${row.first_name} ${row.last_name}`;
          const ministry = ministries.find(item => item.id === Number(row.ministry_id)) || ministries[3];
          row.ministry_id = ministry.id; row.ministry_name = ministry.name; row.ministry_color = ministry.color;
        }
        if (root === '/groups') row.members = body.member_ids ? members.filter(member => body.member_ids.includes(member.id)).map(member => ({ ...member, member_id: member.id })) : row.members || [];
        if (root.endsWith('/teams')) row.members = body.member_ids ? members.filter(member => body.member_ids.includes(member.id)).map(member => ({ ...member, member_id: member.id, team_role: 'Member' })) : row.members || [];
        if (root === '/communications/announcements') row.author_name = account.name;
        collection.set(method === 'DELETE' ? collection.get().filter(item => item.id !== recordId) : recordId ? collection.get().map(item => item.id === recordId ? row : item) : [...collection.get(), row]);
        if (root === '/members') roster = members.map(member => roster.find(item => item.member_id === member.id) || { ...member, member_id: member.id, attendance_status: 'unmarked', is_present: 0 });
        response = result({ id: row.id, ministry_id: row.ministry_id, service: row });
      }
      else if (path === '/attendance/batch-mark' || path === '/attendance/check-in') {
        roster = roster.map(row => {
          const status = body.member_id === row.member_id ? body.status || 'present'
            : body.present_ids?.includes(row.member_id) ? 'present' : body.absent_ids?.includes(row.member_id) ? 'absent'
            : body.excused_ids?.includes(row.member_id) ? 'excused' : body.unmark_ids?.includes(row.member_id) ? 'unmarked' : null;
          return status ? { ...row, attendance_status: status, is_present: status === 'present' ? 1 : 0, attendance_id: ++nextId, checked_in_at: now, security_code: row.security_code || 'DEMO123' } : row;
        });
        response = result({ stats: stats(), id: nextId, member_name: roster.find(row => row.member_id === body.member_id)?.full_name, security_code: 'DEMO123', checked_in_at: now });
      }
      else if (path === '/attendance/check-out') { roster = roster.map(row => row.member_id === body.member_id || row.attendance_id === body.attendance_id ? { ...row, checked_out_at: now } : row); response = result({ checked_out_at: now }); }
      else if (/^\/attendance\/\d+$/.test(path)) { roster = roster.map(row => row.attendance_id === id ? { ...row, attendance_id: null, attendance_status: 'unmarked', is_present: 0 } : row); response = result(); }
      else if (/^\/groups\/\d+\/attendance$/.test(path)) {
        const records = body.records || disciples().map(member => ({ member_id: member.id, status: body.present_member_ids?.includes(member.id) ? 'present' : 'absent' }));
        groupRecords = [...groupRecords.filter(row => row.session_date !== body.session_date), ...records.map((row: Row) => ({ ...row, session_date: body.session_date, topic_title: body.topic_title, chapter: body.chapter }))]; response = result();
      }
      else if (/^\/groups\/\d+\/attendance\//.test(path) && method === 'DELETE') { groupRecords = groupRecords.filter(row => row.session_date !== path.split('/')[4]); response = result(); }
      else if (/^\/groups\/\d+\/(progress|reschedule|complete|archive|restore|join)$/.test(path)) {
        groups = groups.map(row => row.id !== id ? row : { ...row, ...body,
          status: path.endsWith('/complete') ? 'completed' : path.endsWith('/archive') ? 'archived' : path.endsWith('/restore') ? 'active' : row.status,
          members: path.endsWith('/join') ? [...row.members, ...members.filter(member => (body.member_ids || [body.member_id]).includes(member.id)).map(member => ({ ...member, member_id: member.id }))] : row.members });
        response = result();
      }
      else if (path === '/settings/general') { settings = { ...settings, ...body.settings }; response = result(); }
      else if (path === '/notifications/email-settings') { emailSettings = { ...emailSettings, ...body }; response = result(); }
      else if (path.startsWith('/notifications/')) { notifications = notifications.map(row => ({ ...row, is_read: body.is_read === false ? 0 : 1 })); response = result(); }
      else if (path === '/auth/profile') { Object.assign(account, body); response = result({ user: account }); }
      else if (path.startsWith('/auth/') && /password|login|register/.test(path)) response = result({ user: account, token: demoToken });
      else if (path === '/backup/export' || path === '/backup/preview') response = result({ system: 'DPC_SAMPLE_ONLY', version: '1', backupType: 'sample', targetYear: new Date().getFullYear(), createdAt: now, exportedBy: account.name,
        totalRows: members.length, tableCounts: { members: members.length }, samplePreviews: { members }, tables: backupTables() });
      else if (/^\/backup\/(restore|delete-by-year)$/.test(path)) response = result({ restoredCounts: {}, deletedCounts: {} });
      else if (/^\/(duty|dishwashing)\/schedule\//.test(path) || /^\/events\/\d+\/(attendance|rsvp)/.test(path)
        || path.startsWith('/cloud-sync/') || path.startsWith('/bible-reading/') || /^\/members\/\d+\/(baptism|birthday-greeting)$/.test(path)) response = result({ stats: stats(), count: 1 });
      else throw new Error(`This action is not available in the sample workspace (${path}). No server request was made.`);
    }
    return structuredClone(response);
  }
  return { handle };
}

let database: ReturnType<typeof createDemoDatabase> | undefined;
export async function demoRequest(endpoint: string, options: RequestInit = {}) {
  if (!isGuideSandbox()) throw new Error('The sample database is available only inside practice mode.');
  database ??= createDemoDatabase(guideSandbox!.role);
  return database.handle(endpoint, options);
}
