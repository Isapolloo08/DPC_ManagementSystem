import {
  Ministry, User, Role, Member, Household, AttendanceRecord, AttendanceRosterItem,
  EventItem, Announcement, Fund, Donation,
  DashboardMetrics, AuditLog, BibleStudyGroup, SystemLookup, SystemSetting,
  BirthdayCelebrant, BirthdaySummary, StudyTopic, StudyTopicsSummary,
  DutyTeam, DutyTeamMember, SaturdayDutyScheduleResponse, DishwashingDutyItem, DishwashingCyclePayload, DishwashingResponse,
  DishwashingTeam, SundayDutyScheduleResponse,
  UpdateProfilePayload, ChangePasswordPayload, UserActivityStats,
  BackupYearStats, BackupSummaryResponse, BackupYearDetailsResponse, BackupPreviewResponse, BackupExportPayload,
  BibleReadingProgressResponse, BibleReadingToggleResponse, BibleReadingStatsResponse
} from "./types";

export const getApiBase = () => {
  if (typeof window !== "undefined") {
    const configuredIp = localStorage.getItem("dpc_server_ip");
    if (configuredIp && configuredIp.trim()) {
      return `http://${configuredIp.trim()}:4000/api`;
    }
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return `${envUrl}/api`;
  if (typeof window === "undefined") return "http://127.0.0.1:4000/api";
  const { hostname, protocol } = window.location;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1" || protocol === "file:") {
    return "http://127.0.0.1:4000/api";
  }
  return `${protocol}//${hostname}:4000/api`;
};

function getHeaders(): HeadersInit {
  const token = localStorage.getItem("chms_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // If response is not JSON
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Server request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  getSetupStatus: () => request<{ hasUsers: boolean; totalUsers: number; hasAdmin: boolean; totalAdmins: number; isFirstUser: boolean }>("/auth/setup-status"),
  register: (data: { name: string; username?: string; email: string; password: string; role_id?: number }) => request<{ token: string; user: User; isFirstUser: boolean }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  getDemoUsers: () => request<User[]>("/auth/demo-users"),
  switchDemo: (userId: number) => request<{ token: string; user: User }>("/auth/switch-demo", {
    method: "POST",
    body: JSON.stringify({ userId })
  }),
  getMe: () => request<{ user: User }>("/auth/me"),
  login: (emailOrUsername: string, password: string) => request<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ emailOrUsername, password })
  }),
  updateProfile: (data: UpdateProfilePayload) => request<{ message: string; user: User }>("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  changePassword: (data: ChangePasswordPayload) => request<{ message: string }>("/auth/change-password", {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  getProfileActivity: () => request<UserActivityStats>("/auth/profile-activity"),

  // Users & Roles Management
  getRoles: () => request<Role[]>("/roles"),
  getUsers: (params?: { role_id?: number; role_name?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.role_id) q.set("role_id", String(params.role_id));
    if (params?.role_name) q.set("role_name", params.role_name);
    if (params?.search) q.set("search", params.search);
    return request<User[]>(`/users?${q.toString()}`);
  },
  getUser: (id: number) => request<User>(`/users/${id}`),
  createUser: (userData: { name: string; username?: string; email: string; password: string; role_id: number; ministry_ids?: number[]; member_id?: number | null }) => request<{ id: number; message: string }>("/users", {
    method: "POST",
    body: JSON.stringify(userData)
  }),
  updateUser: (id: number, userData: { name?: string; username?: string; email?: string; password?: string; role_id?: number; ministry_ids?: number[]; member_id?: number | null }) => request<{ message: string }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(userData)
  }),
  deleteUser: (id: number) => request<{ message: string }>(`/users/${id}`, {
    method: "DELETE"
  }),

  // Ministries
  getMinistries: () => request<Ministry[]>("/ministries"),
  getMinistry: (id: number) => request<Ministry & { members: Member[] }>(`/ministries/${id}`),
  suggestMinistry: (birthdate: string) => request<{ calculated_age: number; suggested_ministry: Ministry }>(`/ministries/suggest?birthdate=${birthdate}`),
  createMinistry: (data: Partial<Ministry>) => request<{ id: number; message: string }>("/ministries", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateMinistry: (id: number, data: Partial<Ministry>) => request<{ message: string }>(`/ministries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  deleteMinistry: (id: number) => request<{ message: string }>(`/ministries/${id}`, {
    method: "DELETE"
  }),

  // Members & Households
  getMembers: (params?: {
    ministry_id?: number;
    search?: string;
    status?: string;
    household_id?: number;
    birthday_filter?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.household_id) q.set("household_id", String(params.household_id));
    if (params?.birthday_filter) q.set("birthday_filter", params.birthday_filter);
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    return request<any>(`/members?${q.toString()}`);
  },
  getAgingOutMembers: () => request<(Member & { current_age: number; suggested_next_ministry: Ministry })[]>("/members/aging-out"),
  autoTransitionAgingOut: () => request<{ count: number; message: string }>("/members/auto-transition", { method: "POST" }),
  getBirthdays: (params?: { timeframe?: "today" | "this_week" | "this_month" | "next_30_days" | "all"; month?: number; ministry_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.timeframe) q.set("timeframe", params.timeframe);
    if (params?.month !== undefined) q.set("month", String(params.month));
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    return request<BirthdaySummary>(`/members/birthdays?${q.toString()}`);
  },
  sendBirthdayGreeting: (id: number, data?: { message?: string; channel?: "announcement" | "sms" | "email" }) => request<{ message: string; blessing: string; announcement_id?: number }>(`/members/${id}/birthday-greeting`, {
    method: "POST",
    body: JSON.stringify(data || {})
  }),
  getMember: (id: number) => request<Member>(`/members/${id}`),
  createMember: (memberData: Partial<Member>) => request<{ id: number; message: string; ministry_id: number }>("/members", {
    method: "POST",
    body: JSON.stringify(memberData)
  }),
  updateMember: (id: number, memberData: Partial<Member>) => request<{ message: string }>(`/members/${id}`, {
    method: "PUT",
    body: JSON.stringify(memberData)
  }),
  deleteMember: (id: number) => request<{ message: string }>(`/members/${id}`, {
    method: "DELETE"
  }),

  // Households
  getHouseholds: () => request<Household[]>("/households"),
  getHousehold: (id: number) => request<Household>(`/households/${id}`),
  createHousehold: (data: { name: string; address?: string; primary_contact_phone?: string }) => request<{ id: number; message: string }>("/households", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  // Attendance & Check-In
  getTodayAttendance: (ministry_id?: number, date?: string) => {
    const q = new URLSearchParams();
    if (ministry_id) q.set("ministry_id", String(ministry_id));
    if (date) q.set("date", date);
    return request<AttendanceRecord[]>(`/attendance/today?${q.toString()}`);
  },
  getAttendanceRoster: (params?: { ministry_id?: number; search?: string; household_id?: number; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.search) q.set("search", params.search);
    if (params?.household_id) q.set("household_id", String(params.household_id));
    if (params?.date) q.set("date", params.date);
    return request<AttendanceRosterItem[]>(`/attendance/roster?${q.toString()}`);
  },
  checkIn: (data: { member_id: number; ministry_id?: number; event_id?: number; notes?: string; service_name?: string; status?: "present" | "absent" | "excused"; reason?: string; target_date?: string }) =>
    request<{ id: number; message: string; security_code: string | null; member_name: string; ministry_name: string; medical_notes: string | null; checked_in_at: string; attendance_status?: string; already_present?: boolean }>("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  batchCheckIn: (data: { member_ids: number[]; service_name?: string }) =>
    request<{ message: string; checked_in: any[] }>("/attendance/batch-check-in", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  checkOut: (data: { attendance_id?: number; member_id?: number; security_code?: string; force?: boolean }) =>
    request<{ message: string; checked_out_at: string }>("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  undoCheckIn: (attendanceId: number) =>
    request<{ message: string }>(`/attendance/${attendanceId}`, {
      method: "DELETE"
    }),
  getAttendanceTrends: (params?: { ministry_id?: number }) => {
    const q = params?.ministry_id ? `?ministry_id=${params.ministry_id}` : "";
    return request<{ ministry_id: number; ministry_name: string; color: string; total_checkins: number; weekly: { week: string; count: number }[] }[]>(`/attendance/trends${q}`);
  },

  // Events
  getEvents: (params?: { ministry_id?: number; upcoming?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.upcoming) q.set("upcoming", "true");
    return request<EventItem[]>(`/events?${q.toString()}`);
  },
  createEvent: (data: Partial<EventItem>) => request<{ id: number; message: string }>("/events", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  rsvpEvent: (eventId: number, member_id?: number, status = "registered") => request<{ message: string; status?: string }>(`/events/${eventId}/rsvp`, {
    method: "POST",
    body: JSON.stringify({ member_id, status })
  }),

  // Communications
  getAnnouncements: (ministry_id?: number) => {
    const q = ministry_id ? `?ministry_id=${ministry_id}` : "";
    return request<Announcement[]>(`/communications/announcements${q}`);
  },
  createAnnouncement: (data: { ministry_id?: number | null; title: string; body: string; is_pinned?: boolean }) =>
    request<{ id: number; message: string }>("/communications/announcements", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Bible Study & Small Groups
  getGroups: (params?: { ministry_id?: number; category?: string; meeting_day?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.category) q.set("category", params.category);
    if (params?.meeting_day) q.set("meeting_day", params.meeting_day);
    if (params?.search) q.set("search", params.search);
    return request<BibleStudyGroup[]>(`/groups?${q.toString()}`);
  },
  getBibleStudyGroups: (params?: { ministry_id?: number; category?: string; meeting_day?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.category) q.set("category", params.category);
    if (params?.meeting_day) q.set("meeting_day", params.meeting_day);
    if (params?.search) q.set("search", params.search);
    return request<BibleStudyGroup[]>(`/groups?${q.toString()}`);
  },
  createGroup: (data: Partial<BibleStudyGroup>) => request<{ id: number; message: string }>("/groups", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateGroup: (id: number, data: Partial<BibleStudyGroup>) => request<{ message: string }>(`/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  updateGroupProgress: (id: number, data: { current_chapter: string; progress_stage?: string; progress_notes?: string }) => request<{ message: string }>(`/groups/${id}/progress`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),
  rescheduleGroup: (id: number, data: { is_rescheduled: boolean; rescheduled_date?: string | null; rescheduled_time?: string | null; reschedule_reason?: string | null }) => request<{ message: string; is_rescheduled: boolean }>(`/groups/${id}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),
  deleteGroup: (id: number) => request<{ message: string }>(`/groups/${id}`, {
    method: "DELETE"
  }),
  joinGroup: (groupId: number, data?: { member_id?: number; member_name?: string }) => request<{ message: string }>(`/groups/${groupId}/join`, {
    method: "POST",
    body: JSON.stringify(data || {})
  }),

  // Bible Study Topics & Completed Books
  getStudyTopics: (params?: { status?: string; type?: string; ministry_id?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.type) q.set("type", params.type);
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.search) q.set("search", params.search);
    return request<StudyTopicsSummary>(`/study-topics?${q.toString()}`);
  },
  getStudyTopic: (id: number) => request<{ topic: StudyTopic; group_members: any[]; all_groups: any[] }>(`/study-topics/${id}`),
  createStudyTopic: (data: Partial<StudyTopic>) => request<{ id: number; message: string }>("/study-topics", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateStudyTopic: (id: number, data: Partial<StudyTopic>) => request<{ message: string }>(`/study-topics/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  deleteStudyTopic: (id: number) => request<{ message: string }>(`/study-topics/${id}`, {
    method: "DELETE"
  }),

  // Finance & Giving
  getFunds: () => request<Fund[]>("/finance/funds"),
  createFund: (data: Partial<Fund>) => request<{ id: number; message: string }>("/finance/funds", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateFund: (id: number, data: Partial<Fund>) => request<{ message: string }>(`/finance/funds/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  deleteFund: (id: number) => request<{ message: string }>(`/finance/funds/${id}`, {
    method: "DELETE"
  }),
  getDonations: (fund_id?: number) => {
    const q = fund_id ? `?fund_id=${fund_id}` : "";
    return request<Donation[]>(`/finance/donations${q}`);
  },
  recordDonation: (data: { member_id?: number; fund_id: number; amount: number; method?: string; notes?: string }) =>
    request<{ id: number; message: string }>("/finance/donations", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getGivingStatement: (memberId: number, year?: number) => {
    const q = year ? `?year=${year}` : "";
    return request<any>(`/finance/statement/${memberId}${q}`);
  },

  // Master Lookups & System Settings
  getLookups: (params?: { type?: string; active_only?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set("type", params.type);
    if (params?.active_only) q.set("active_only", "true");
    return request<SystemLookup[]>(`/settings/lookups?${q.toString()}`);
  },
  createLookup: (data: Partial<SystemLookup>) => request<{ id: number; message: string }>("/settings/lookups", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateLookup: (id: number, data: Partial<SystemLookup>) => request<{ message: string }>(`/settings/lookups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  deleteLookup: (id: number) => request<{ message: string }>(`/settings/lookups/${id}`, {
    method: "DELETE"
  }),

  getGeneralSettings: () => request<{ settings: Record<string, string>; list: SystemSetting[] }>("/settings/general"),
  updateGeneralSettings: (settings: Record<string, string>) => request<{ message: string }>("/settings/general", {
    method: "PUT",
    body: JSON.stringify({ settings })
  }),

  // Dashboard Reports & Audit
  getDashboardMetrics: (ministry_id?: number) => {
    const q = ministry_id ? `?ministry_id=${ministry_id}` : "";
    return request<DashboardMetrics>(`/reports/dashboard${q}`);
  },
  getAuditLogs: () => request<AuditLog[]>("/audit"),

  // Saturday Duty Roster & Rotating Teams
  getDutyTeams: (ministry_id?: number) => {
    const q = ministry_id ? `?ministry_id=${ministry_id}` : "";
    return request<DutyTeam[]>(`/duty/teams${q}`);
  },
  createDutyTeam: (data: {
    name: string;
    ministry_id?: number | null;
    leader_id?: number | null;
    leader_name?: string | null;
    color?: string;
    order_seq?: number;
    tasks_checklist?: string;
    member_ids?: number[];
  }) =>
    request<{ id: number; message: string }>("/duty/teams", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateDutyTeam: (id: number, data: Partial<DutyTeam> & { member_ids?: number[] }) =>
    request<{ message: string }>(`/duty/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteDutyTeam: (id: number) =>
    request<{ message: string }>(`/duty/teams/${id}`, {
      method: "DELETE"
    }),
  addDutyTeamMember: (teamId: number, data: { member_id?: number; member_ids?: number[]; role?: string }) =>
    request<{ message: string }>(`/duty/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  removeDutyTeamMember: (teamId: number, memberId: number) =>
    request<{ message: string }>(`/duty/teams/${teamId}/members/${memberId}`, {
      method: "DELETE"
    }),
  getDutySchedule: (params?: { ministry_id?: number; count?: number }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.count) q.set("count", String(params.count));
    return request<SaturdayDutyScheduleResponse>(`/duty/schedule?${q.toString()}`);
  },
  completeSaturdayDuty: (data: { duty_date: string; team_id: number; ministry_id?: number | null; notes?: string }) =>
    request<{ message: string }>("/duty/schedule/complete", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  swapSaturdayDuty: (data: { date1: string; teamId1: number; date2: string; teamId2: number; ministry_id?: number | null }) =>
    request<{ message: string }>("/duty/schedule/swap", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Dishwashing & Kitchen Fellowship Duty Roster (Rotating Cycle)
  getDishwashingTeams: (ministry_id?: number) => {
    const q = ministry_id ? `?ministry_id=${ministry_id}` : "";
    return request<DishwashingTeam[]>(`/dishwashing/teams${q}`);
  },
  createDishwashingTeam: (data: {
    name: string;
    cycle_mode?: "biblestudy_group" | "ministry" | "custom";
    biblestudy_group_id?: number | null;
    ministry_id?: number | null;
    leader_id?: number | null;
    leader_name?: string | null;
    leader_contact?: string | null;
    color?: string;
    order_seq?: number;
    tasks_checklist?: string;
    volunteers_count?: number;
    member_ids?: number[];
  }) =>
    request<{ id: number; message: string }>("/dishwashing/teams", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateDishwashingTeam: (id: number, data: Partial<DishwashingTeam> & { member_ids?: number[] }) =>
    request<{ message: string }>(`/dishwashing/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteDishwashingTeam: (id: number) =>
    request<{ message: string }>(`/dishwashing/teams/${id}`, {
      method: "DELETE"
    }),
  addDishwashingTeamMember: (teamId: number, data: { member_id: number; role?: string }) =>
    request<{ message: string }>(`/dishwashing/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  batchAddDishwashingTeamMembers: (teamId: number, data: { member_ids: number[]; role?: string }) =>
    request<{ message: string }>(`/dishwashing/teams/${teamId}/members/batch`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  removeDishwashingTeamMember: (teamId: number, memberId: number) =>
    request<{ message: string }>(`/dishwashing/teams/${teamId}/members/${memberId}`, {
      method: "DELETE"
    }),
  getDishwashingSchedule: (params?: { count?: number }) => {
    const q = new URLSearchParams();
    if (params?.count) q.set("count", String(params.count));
    return request<SundayDutyScheduleResponse>(`/dishwashing/schedule?${q.toString()}`);
  },
  completeSundayDishwashingDuty: (data: { duty_date: string; team_id: number; notes?: string }) =>
    request<{ message: string }>("/dishwashing/schedule/complete", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  swapSundayDishwashingDuty: (data: { date1: string; teamId1: number; date2: string; teamId2: number }) =>
    request<{ message: string }>("/dishwashing/schedule/swap", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  overrideSundayDishwashingDuty: (data: { duty_date: string; team_id: number; notes?: string; status?: string }) =>
    request<{ message: string }>("/dishwashing/schedule/override", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Legacy/Custom Dishwashing endpoints
  getDishwashingDuties: (params?: { status?: string; cycle_mode?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.cycle_mode) q.set("cycle_mode", params.cycle_mode);
    return request<DishwashingResponse>(`/dishwashing?${q.toString()}`);
  },
  generateDishwashingCycle: (data: DishwashingCyclePayload) =>
    request<{ message: string; totalCreated: number }>("/dishwashing/generate-cycle", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  createDishwashingDuty: (data: Partial<DishwashingDutyItem>) =>
    request<{ id: number; message: string }>("/dishwashing", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateDishwashingDuty: (id: number, data: Partial<DishwashingDutyItem>) =>
    request<{ message: string }>(`/dishwashing/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteDishwashingDuty: (id: number) =>
    request<{ message: string }>(`/dishwashing/${id}`, {
      method: "DELETE"
    }),
  swapDishwashingDuty: (id: number, target_duty_id: number) =>
    request<{ message: string }>(`/dishwashing/${id}/swap`, {
      method: "POST",
      body: JSON.stringify({ target_duty_id })
    }),

  // Backup, Restore & Data Management
  getBackupSummary: () => request<BackupSummaryResponse>("/backup/summary"),
  getBackupYearDetails: (year: number) => request<BackupYearDetailsResponse>(`/backup/year-details/${year}`),
  exportBackup: (year?: number | "all", password?: string) =>
    request<BackupExportPayload>("/backup/export", {
      method: "POST",
      body: JSON.stringify({ year: year || "all", password: password || "" })
    }),
  previewBackup: (data: any) =>
    request<BackupPreviewResponse>("/backup/preview", {
      method: "POST",
      body: JSON.stringify({ data })
    }),
  restoreBackup: (data: any, mode: "replace" | "merge" = "replace", password?: string) =>
    request<{ success: boolean; message: string; restoredCounts: Record<string, number> }>("/backup/restore", {
      method: "POST",
      body: JSON.stringify({ data, mode, password: password || "" })
    }),
  deleteByYear: (year: number, confirmYear: number, password?: string) =>
    request<{ success: boolean; message: string; deletedCounts: Record<string, number> }>("/backup/delete-by-year", {
      method: "POST",
      body: JSON.stringify({ year, confirmYear, password: password || "" })
    }),

  // Daily Bible Reading Plan
  getBibleReadingProgress: () => request<BibleReadingProgressResponse>("/bible-reading/progress"),
  toggleBibleReadingDay: (day_key: string, notes?: string) =>
    request<BibleReadingToggleResponse>("/bible-reading/toggle", {
      method: "POST",
      body: JSON.stringify({ day_key, notes })
    }),
  markBatchBibleReadingDays: (day_keys: string[], completed: boolean = true) =>
    request<{ success: boolean; count: number; completed: boolean }>("/bible-reading/mark-batch", {
      method: "POST",
      body: JSON.stringify({ day_keys, completed })
    }),
  getBibleReadingStats: () => request<BibleReadingStatsResponse>("/bible-reading/stats")
};



