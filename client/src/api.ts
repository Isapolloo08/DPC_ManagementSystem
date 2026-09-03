import {
  Ministry, User, Role, Member, Household, AttendanceRecord, AttendanceRosterItem,
  EventItem, Announcement, PrayerRequest, Fund, Donation,
  DashboardMetrics, AuditLog, BibleStudyGroup, SystemLookup, SystemSetting,
  BirthdayCelebrant, BirthdaySummary, StudyTopic, StudyTopicsSummary,
  DutyTeam, DutyTeamMember, SaturdayDutyScheduleResponse, DishwashingDutyItem, DishwashingCyclePayload, DishwashingResponse
} from "./types";

const API_BASE = "http://127.0.0.1:4000/api";

function getHeaders(): HeadersInit {
  const token = localStorage.getItem("chms_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "An unexpected error occurred");
  }
  return data;
}

export const api = {
  // Auth
  getSetupStatus: () => request<{ hasUsers: boolean; totalUsers: number; isFirstUser: boolean }>("/auth/setup-status"),
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
  getMembers: (params?: { ministry_id?: number; search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    return request<Member[]>(`/members?${q.toString()}`);
  },
  getAgingOutMembers: () => request<(Member & { current_age: number; suggested_next_ministry: Ministry })[]>("/members/aging-out"),
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
  checkIn: (data: { member_id: number; ministry_id?: number; event_id?: number; notes?: string; service_name?: string }) =>
    request<{ id: number; message: string; security_code: string | null; member_name: string; ministry_name: string; medical_notes: string | null; checked_in_at: string; already_present?: boolean }>("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  batchCheckIn: (data: { member_ids: number[]; service_name?: string }) =>
    request<{ message: string; checked_in: any[] }>("/attendance/batch-check-in", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  checkOut: (data: { attendance_id?: number; member_id?: number; security_code?: string }) =>
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
  getPrayerRequests: (params?: { ministry_id?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.status) q.set("status", params.status);
    return request<PrayerRequest[]>(`/communications/prayer-requests?${q.toString()}`);
  },
  submitPrayerRequest: (data: { ministry_id?: number | null; request_text: string; is_anonymous?: boolean }) =>
    request<{ id: number; message: string }>("/communications/prayer-requests", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updatePrayerStatus: (id: number, status: "open" | "answered" | "archived") =>
    request<{ message: string }>(`/communications/prayer-requests/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
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
  toggleStudyTopicCompleted: (id: number) => request<{ message: string; status: string; completed_date?: string }>(`/study-topics/${id}/toggle-completed`, {
    method: "POST"
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
  createDutyTeam: (data: { name: string; ministry_id?: number | null; leader_id?: number | null; leader_name?: string | null; color?: string; order_seq?: number; tasks_checklist?: string }) =>
    request<{ id: number; message: string }>("/duty/teams", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateDutyTeam: (id: number, data: Partial<DutyTeam>) =>
    request<{ message: string }>(`/duty/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteDutyTeam: (id: number) =>
    request<{ message: string }>(`/duty/teams/${id}`, {
      method: "DELETE"
    }),
  addDutyTeamMember: (teamId: number, data: { member_id: number; role?: string }) =>
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

  // Dishwashing & Kitchen Fellowship Duty Roster
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
    })
};



