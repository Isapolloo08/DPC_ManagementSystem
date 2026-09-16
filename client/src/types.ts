export interface Ministry {
  id: number;
  name: string;
  min_age: number | null;
  max_age: number | null;
  description: string;
  color: string;
  active_members_count?: number;
  today_checkins_count?: number;
  coordinators?: { id: number; name: string; email: string }[];
  volunteers?: { id: number; name: string; email: string }[];
}

export interface Role {
  id: number;
  name: "Admin" | "Coordinator" | "Leader" | "Volunteer" | "Member" | string;
  description?: string;
  user_count?: number;
}

export interface User {
  id: number;
  name: string;
  username?: string;
  email: string;
  role_id: number;
  role_name: string;
  ministries: { id: number; name: string; color: string; min_age?: number | null; max_age?: number | null }[];
  contact_phone?: string | null;
  contact_email?: string | null;
  created_at?: string;
  member?: Member | null;
  member_id?: number | null;
  linked_member_name?: string | null;
}

export interface UpdateProfilePayload {
  name?: string;
  username?: string;
  email?: string;
  contact_phone?: string;
  birthdate?: string;
  gender?: string;
  address?: string;
  occupation?: string;
  hobbies?: string;
  school_name?: string;
  program_major?: string;
  guardian_names?: string;
  guardian_phone?: string;
  family_details?: string;
  facebook_account?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UserActivityStats {
  attendanceCount: number;
  groupsLed: { id: number; name: string; schedule_day: string; schedule_time: string; meeting_location?: string }[];
  groupsAttended: { id: number; name: string; schedule_day: string; schedule_time: string; meeting_location?: string }[];
  dutiesAssigned: { team_id: number; team_name: string; duty_role?: string }[];
}

export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  household_id: number | null;
  household_name?: string;
  household_address?: string;
  household_phone?: string;
  ministry_id: number | null;
  ministry_name?: string;
  ministry_color?: string;
  user_id: number | null;
  status: "active" | "inactive" | "visitor";
  photo_url: string | null;
  medical_notes: string | null;
  grade_level: string | null;
  address?: string | null;
  guardian_names?: string | null;
  guardian_phone?: string | null;
  invited_by?: string | null;
  school_name?: string | null;
  program_major?: string | null;
  class_schedule?: string | null;
  occupation?: string | null;
  hobbies?: string | null;
  previous_church?: string | null;
  facebook_account?: string | null;
  family_details?: string | null;
  application_date?: string | null;
  civil_status?: "Single" | "Married" | "Widowed" | "Separated" | string | null;
  spouse_name?: string | null;
  spouse_id?: number | null;
  linked_spouse_first_name?: string | null;
  linked_spouse_last_name?: string | null;
  linked_spouse_birthdate?: string | null;
  linked_spouse_ministry_id?: number | null;
  linked_spouse_ministry_name?: string | null;
  partner_record?: {
    first_name: string;
    last_name: string;
    birthdate?: string;
    gender?: string;
    contact_phone?: string;
    contact_email?: string;
    occupation?: string;
    facebook_account?: string;
    medical_notes?: string;
    hobbies?: string;
    address?: string;
  };
  created_at?: string;
  age?: number;
  is_aging_out?: boolean;
  birth_month?: number;
  birth_day?: number;
  birth_month_name?: string;
  turning_age?: number;
  days_until_birthday?: number;
  is_birthday_today?: boolean;
  is_birthday_this_week?: boolean;
  is_birthday_this_month?: boolean;
  next_birthday_date?: string;
  family_members?: { id: number; first_name: string; last_name: string; birthdate: string; ministry_id: number }[];
  attendance_history?: AttendanceRecord[];
  donations?: Donation[];
}

export interface Household {
  id: number;
  name: string;
  address: string | null;
  primary_contact_phone: string | null;
  member_count?: number;
  members?: (Member & { age: number })[];
}

export interface AttendanceRecord {
  id: number;
  member_id: number;
  first_name?: string;
  last_name?: string;
  birthdate?: string;
  ministry_id: number;
  ministry_name?: string;
  ministry_color?: string;
  event_id: number | null;
  event_title?: string;
  security_code: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  checked_in_by?: number;
  checked_in_by_name?: string;
  notes: string | null;
  medical_notes?: string | null;
  household_name?: string;
  parent_phone?: string;
}

export interface AttendanceRosterItem {
  member_id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: string | null;
  member_status: string;
  grade_level?: string | null;
  medical_notes?: string | null;
  photo_url?: string | null;
  ministry_id: number;
  ministry_name: string;
  ministry_color: string;
  household_id: number | null;
  household_name?: string | null;
  parent_phone?: string | null;
  attendance_id: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  security_code: string | null;
  attendance_notes: string | null;
  checked_in_by_name?: string | null;
  is_present: number;
  attendance_status?: "present" | "absent" | "excused" | "checked_out" | "unmarked";
}

export interface EventItem {
  id: number;
  ministry_id: number | null;
  ministry_name?: string;
  ministry_color?: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  creator_name?: string;
  rsvp_count?: number;
  registrations?: { id: number; member_id: number; first_name: string; last_name: string; status: string }[];
}

export interface Announcement {
  id: number;
  ministry_id: number | null;
  ministry_name?: string;
  ministry_color?: string;
  author_id: number;
  author_name: string;
  author_role: string;
  title: string;
  body: string;
  is_pinned: number;
  created_at: string;
}

export interface Fund {
  id: number;
  name: string;
  description: string;
  target_amount: number;
  raised_amount?: number;
  donor_count?: number;
  progress_percentage?: number;
}

export interface Donation {
  id: number;
  member_id: number | null;
  first_name?: string;
  last_name?: string;
  fund_id: number;
  fund_name?: string;
  amount: number;
  method: string;
  notes: string | null;
  donated_at: string;
}

export interface DashboardMetrics {
  metrics: {
    total_active_members: number;
    total_households: number;
    today_checkins: number;
    ytd_giving_amount: number;
    active_announcements?: number;
    open_prayer_requests?: number;
    upcoming_events_count: number;
    aging_out_alerts_count: number;
    birthdays_this_month_count?: number;
    birthdays_today_count?: number;
  };
  upcoming_birthdays?: BirthdayCelebrant[];
  ministry_breakdown: {
    id: number;
    name: string;
    color: string;
    member_count: number;
    today_checkins: number;
  }[];
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  role_name: string | null;
  action: string;
  target_table: string;
  target_id: number | null;
  details: string;
  created_at: string;
}

export interface BibleStudyMember {
  id: number;
  group_id: number;
  member_id: number | null;
  member_name: string | null;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  joined_at: string;
}

export interface BibleStudyGroup {
  id: number;
  name: string;
  description: string | null;
  curriculum: string | null;
  ministry_id: number | null;
  ministry_name?: string;
  ministry_color?: string;
  leader_id?: number | null;
  leader_name: string;
  leader_contact: string | null;
  meeting_day: string;
  meeting_time: string;
  location: string;
  category: string;
  max_capacity: number;
  current_member_count?: number;
  members?: BibleStudyMember[];
  current_chapter?: string;
  curriculum_total_chapters?: number;
  progress_stage?: string;
  progress_notes?: string | null;
  is_rescheduled?: boolean | number;
  rescheduled_date?: string | null;
  rescheduled_time?: string | null;
  reschedule_reason?: string | null;
  created_at?: string;
}

export type LookupType = 
  | "bible_study_category"
  | "event_category"
  | "event_location"
  | "announcement_category"
  | "payment_method"
  | "member_status";

export interface SystemLookup {
  id: number;
  type: LookupType | string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: number;
  created_at?: string;
  usage_count?: number;
}

export interface BirthdayCelebrant {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  photo_url?: string | null;
  household_name?: string | null;
  ministry_id: number | null;
  ministry_name?: string | null;
  ministry_color?: string | null;
  birth_month: number;
  birth_day: number;
  birth_month_name: string;
  current_age: number;
  turning_age: number;
  days_until_birthday: number;
  is_today: boolean;
  is_this_week: boolean;
  is_this_month: boolean;
  next_birthday_date: string;
}

export interface BirthdaySummary {
  celebrants: BirthdayCelebrant[];
  counts: {
    today: number;
    this_week: number;
    this_month: number;
    next_30_days: number;
    total_active: number;
  };
  monthly_distribution: {
    month: number;
    month_name: string;
    count: number;
    celebrants: { id: number; first_name: string; last_name: string; birth_day: number; ministry_name?: string }[];
  }[];
}

export interface SystemSetting {
  key: string;
  value: string;
  category: string;
  updated_at?: string;
}

export interface StudyTopic {
  id: number;
  title: string;
  total_chapters: number;
  summary_notes?: string | null;
  created_at?: string;
}

export interface StudyTopicDetailResponse {
  topic: StudyTopic;
  all_groups: BibleStudyGroup[];
}

export interface StudyTopicsSummary {
  topics: StudyTopic[];
  total_count: number;
}

export interface DutyTeamMember {
  assignment_id: number;
  team_role: "Team Leader" | "Member";
  joined_at?: string;
  member_id: number;
  first_name: string;
  last_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  photo_url?: string | null;
  ministry_name?: string | null;
}

export interface DutyTeam {
  id: number;
  name: string;
  ministry_id?: number | null;
  ministry_name?: string | null;
  ministry_color?: string | null;
  leader_id?: number | null;
  leader_name?: string | null;
  leader_phone?: string | null;
  color: string;
  order_seq: number;
  tasks_checklist?: string | null;
  created_at?: string;
  members_count: number;
  members: DutyTeamMember[];
}

export interface SaturdayDutyScheduleItem {
  duty_date: string;
  date_formatted: string;
  week_number: number;
  is_this_saturday: boolean;
  is_next_saturday?: boolean;
  is_past: boolean;
  status: "on_duty" | "scheduled" | "completed" | "swapped";
  completed_at?: string | null;
  notes?: string | null;
  team: DutyTeam | null;
}

export interface SaturdayDutyScheduleResponse {
  total_teams: number;
  cycle_interval_weeks: number;
  schedule: SaturdayDutyScheduleItem[];
}

export interface DishwashingTeam {
  id: number;
  name: string;
  cycle_mode: "biblestudy_group" | "ministry" | "custom";
  biblestudy_group_id?: number | null;
  ministry_id?: number | null;
  ministry_name?: string | null;
  ministry_color?: string | null;
  group_name?: string | null;
  group_meeting_day?: string | null;
  leader_id?: number | null;
  leader_name?: string | null;
  leader_phone?: string | null;
  leader_contact?: string | null;
  color: string;
  order_seq: number;
  tasks_checklist?: string | null;
  volunteers_count: number;
  created_at?: string;
  members_count: number;
  members: DutyTeamMember[];
}

export interface SundayDutyScheduleItem {
  duty_date: string;
  date_formatted: string;
  week_number: number;
  is_this_sunday: boolean;
  is_next_sunday: boolean;
  status: "on_duty" | "scheduled" | "completed" | "swapped";
  completed_at?: string | null;
  notes?: string | null;
  team: DishwashingTeam | null;
}

export interface SundayDutyScheduleResponse {
  total_teams: number;
  cycle_interval_weeks: number;
  thisSunday: SundayDutyScheduleItem | null;
  nextSunday: SundayDutyScheduleItem | null;
  schedule: SundayDutyScheduleItem[];
}

export interface DishwashingDutyItem {
  id: number;
  duty_date: string;
  event_name: string;
  cycle_mode: "biblestudy_group" | "ministry";
  cycle_order_index: number;
  biblestudy_group_id?: number | null;
  ministry_id?: number | null;
  assigned_name: string;
  leader_name?: string | null;
  partner_assigned_name?: string | null;
  partner_leader_name?: string | null;
  partner_biblestudy_group_id?: number | null;
  partner_ministry_id?: number | null;
  is_joint_duty?: boolean;
  volunteers_count: number;
  status: "scheduled" | "completed" | "swapped";
  notes?: string | null;
  created_at?: string;
  ministry_name?: string | null;
  ministry_color?: string | null;
  group_name?: string | null;
  group_meeting_day?: string | null;
  group_leader_name?: string | null;
}

export interface DishwashingResponse {
  duties: DishwashingDutyItem[];
  thisSunday: DishwashingDutyItem | null;
  nextSunday: DishwashingDutyItem | null;
  cycleOptions: {
    groups: { id: number; name: string; leader_name?: string; ministry_id?: number }[];
    ministries: { id: number; name: string; color?: string; coordinator_name?: string }[];
  };
  stats: { assigned_name: string; total_assigned: number; total_completed: number }[];
}

export interface DishwashingCyclePayload {
  cycle_mode: "biblestudy_group" | "ministry";
  start_date: string;
  weeks_count: number;
  replace_existing?: boolean;
  teams_per_turn?: number;
}

export interface BackupYearStats {
  year: number;
  totalRecords: number;
  attendance: number;
  donationsCount: number;
  donationsTotal: number;
  events: number;
  dutySchedules: number;
  dishwashingRoster: number;
  announcements: number;
  membersCreated: number;
}

export interface BackupSummaryResponse {
  success: boolean;
  totalStats: Record<string, number>;
  yearlyBreakdown: BackupYearStats[];
  generatedAt: string;
}

export interface BackupYearDetailsResponse {
  success: boolean;
  year: number;
  tables: {
    attendance: any[];
    donations: any[];
    events: any[];
    duty_schedules: any[];
    dishwashing_roster: any[];
    announcements: any[];
    members_created: any[];
  };
}

export interface BackupPreviewResponse {
  success: boolean;
  system: string;
  backupType: string;
  targetYear: string | number;
  createdAt: string;
  exportedBy: string;
  totalRows: number;
  tableCounts: Record<string, number>;
  samplePreviews: Record<string, any[]>;
}

export interface BackupExportPayload {
  system: string;
  version: string;
  backupType: string;
  targetYear: string | number;
  createdAt: string;
  exportedBy: string;
  totalRows: number;
  tableCounts: Record<string, number>;
  data: Record<string, any[]>;
}

export interface BibleReadingProgressResponse {
  success: boolean;
  completedKeys: string[];
  records: {
    id: number;
    day_key: string;
    completed_at: string;
    notes: string | null;
  }[];
}

export interface BibleReadingToggleResponse {
  success: boolean;
  day_key: string;
  isCompleted: boolean;
}

export interface BibleReadingStatsResponse {
  success: boolean;
  totalCompletionsCount: number;
  activeReadersCount: number;
}

export interface SyncCountComparison {
  table: string;
  label: string;
  localCount: number;
  cloudCount: number;
}

export interface CloudSyncStatusResponse {
  configured: boolean;
  cloudHost: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
  lastSyncedBy: string | null;
  lastSyncDirection: "push" | "pull" | null;
  comparison: SyncCountComparison[];
  error?: string;
}

export interface CloudSyncProgressEvent {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface CloudSyncResult {
  success: boolean;
  syncedTables: number;
  totalRows: number;
  message: string;
}

