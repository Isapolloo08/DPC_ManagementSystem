import {
  Ministry, User, Role, Member, Household, AttendanceRecord, AttendanceRosterItem,
  EventItem, Announcement, Fund, Donation,
  DashboardMetrics, AuditLog, BibleStudyGroup, SystemLookup, SystemSetting,
  BirthdayCelebrant, BirthdaySummary, StudyTopic, StudyTopicsSummary,
  DutyTeam, DutyTeamMember, SaturdayDutyScheduleResponse, DishwashingDutyItem, DishwashingCyclePayload, DishwashingResponse,
  DishwashingTeam, SundayDutyScheduleResponse,
  UpdateProfilePayload, ChangePasswordPayload, UserActivityStats,
  BackupYearStats, BackupSummaryResponse, BackupYearDetailsResponse, BackupPreviewResponse, BackupExportPayload,
  BibleReadingProgressResponse, BibleReadingToggleResponse, BibleReadingStatsResponse,
  CloudSyncStatusResponse, CloudSyncResult,
  BaptismCandidatesResponse, QualifiedBaptismCandidate,
  RecurringSundayEvent, RecurringSundayEventsResponse,
  GrowthInsightsData, GroupAttendanceResponse,
  AttendanceLogResponse, AttendanceLogFilters,
  ServicesResponse, ServiceItem, CreateServicePayload, UpdateServicePayload,
  MemberComprehensiveAttendanceSummary, EventAttendanceRosterResponse
} from "./types";

export const normalizeServerUrl = (rawInput?: string | null): string => {
  if (!rawInput || !rawInput.trim()) return "";
  const input = rawInput.trim();

  // If already starts with http:// or https://
  if (/^https?:\/\//i.test(input)) {
    return input.replace(/\/+$/, "");
  }

  // If contains a custom port (e.g., 192.168.1.5:4000 or localhost:4000)
  if (input.includes(":")) {
    return `http://${input}`.replace(/\/+$/, "");
  }

  // If it's a domain name (e.g., onrender.com, vercel.app, church.org)
  if (input.includes(".") && !/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) {
    return `https://${input}`.replace(/\/+$/, "");
  }

  // Default LAN IP or local hostname -> assume HTTP :4000
  return `http://${input}:4000`.replace(/\/+$/, "");
};

export const getApiBase = () => {
  if (typeof window !== "undefined") {
    const configuredIp = localStorage.getItem("dpc_server_ip");
    if (configuredIp && configuredIp.trim()) {
      const normalized = normalizeServerUrl(configuredIp);
      return `${normalized}/api`;
    }
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return `${normalizeServerUrl(envUrl)}/api`;
  if (typeof window === "undefined") return "http://127.0.0.1:4000/api";
  const { hostname, protocol } = window.location;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1" || protocol === "file:") {
    return "http://127.0.0.1:4000/api";
  }
  return `${protocol}//${hostname}:4000/api`;
};

// ============================================================
// Local In-Memory Reference Cache & Invalidation Engine
// ============================================================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const referenceCache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = referenceCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    referenceCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  referenceCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(pattern?: string | RegExp): void {
  if (!pattern) {
    referenceCache.clear();
    return;
  }
  for (const key of Array.from(referenceCache.keys())) {
    if (typeof pattern === "string" ? key.startsWith(pattern) : pattern.test(key)) {
      referenceCache.delete(key);
    }
  }
}

function getHeaders(): HeadersInit {
  const token = localStorage.getItem("chms_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Robust HTTP client with Exponential Backoff + Jitter retry for network & 5xx errors
 */
async function request<T>(endpoint: string, options: RequestInit = {}, maxRetries = 3): Promise<T> {
  const apiBase = getApiBase();
  const method = (options.method || "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "HEAD" || method === "OPTIONS";

  let attempt = 0;
  while (true) {
    attempt++;
    try {
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
        // 1. Handle 401 Session Expiration
        if (res.status === 401 && typeof window !== "undefined") {
          const currentToken = localStorage.getItem("chms_token");
          if (
            currentToken &&
            !endpoint.includes("/auth/login") &&
            !endpoint.includes("/auth/register") &&
            !endpoint.includes("/auth/setup-status")
          ) {
            window.dispatchEvent(
              new CustomEvent("auth:session-expired", {
                detail: {
                  message: data?.error || "Your 3-day login session has expired. Please log in again to continue."
                }
              })
            );
          }
        }

        // 2. Retry only on 5xx server errors for idempotent GET requests
        if (res.status >= 500 && isIdempotent && attempt <= maxRetries) {
          const backoff = Math.pow(2, attempt) * 200; // 400ms, 800ms, 1600ms
          const jitter = Math.random() * 150; // Random jitter prevents synchronized retry waves
          await sleep(backoff + jitter);
          continue;
        }

        throw new Error(data?.error || data?.message || `Server request failed with status ${res.status}`);
      }

      return data as T;
    } catch (err: any) {
      // If user/component intentionally aborted request, don't retry
      if (err.name === "AbortError") {
        throw err;
      }

      // Retry on network errors for idempotent requests
      if (isIdempotent && attempt <= maxRetries) {
        const backoff = Math.pow(2, attempt) * 200;
        const jitter = Math.random() * 150;
        await sleep(backoff + jitter);
        continue;
      }

      throw err;
    }
  }
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

  // Users & Roles Management (Cached reference data)
  getRoles: async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCached<Role[]>("ref:roles");
      if (cached) return cached;
    }
    const roles = await request<Role[]>("/roles");
    setCached("ref:roles", roles, 15 * 60 * 1000); // 15 mins
    return roles;
  },
  getUsers: (params?: { role_id?: number; role_name?: string; search?: string; page?: number; limit?: number }, options?: { signal?: AbortSignal }) => {
    const q = new URLSearchParams();
    if (params?.role_id) q.set("role_id", String(params.role_id));
    if (params?.role_name) q.set("role_name", params.role_name);
    if (params?.search) q.set("search", params.search);
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    return request<any>(`/users?${q.toString()}`, { signal: options?.signal });
  },
  getUser: (id: number) => request<User>(`/users/${id}`),
  createUser: async (userData: { name: string; username?: string; email: string; password: string; role_id: number; ministry_ids?: number[]; member_id?: number | null }) => {
    const res = await request<{ id: number; message: string }>("/users", {
      method: "POST",
      body: JSON.stringify(userData)
    });
    return res;
  },
  updateUser: (id: number, userData: { name?: string; username?: string; email?: string; password?: string; role_id?: number; ministry_ids?: number[]; member_id?: number | null }) => request<{ message: string }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(userData)
  }),
  deleteUser: (id: number) => request<{ message: string }>(`/users/${id}`, {
    method: "DELETE"
  }),

  // Ministries (Cached reference data)
  getMinistries: async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCached<Ministry[]>("ref:ministries");
      if (cached) return cached;
    }
    const data = await request<Ministry[]>("/ministries");
    setCached("ref:ministries", data, 10 * 60 * 1000); // 10 mins
    return data;
  },
  getMinistry: (id: number) => request<Ministry & { members: Member[] }>(`/ministries/${id}`),
  suggestMinistry: (birthdate: string) => request<{ calculated_age: number; suggested_ministry: Ministry }>(`/ministries/suggest?birthdate=${birthdate}`),
  createMinistry: async (data: Partial<Ministry>) => {
    const res = await request<{ id: number; message: string }>("/ministries", {
      method: "POST",
      body: JSON.stringify(data)
    });
    invalidateCache("ref:ministries");
    return res;
  },
  updateMinistry: async (id: number, data: Partial<Ministry>) => {
    const res = await request<{ message: string }>(`/ministries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    invalidateCache("ref:ministries");
    return res;
  },
  deleteMinistry: async (id: number) => {
    const res = await request<{ message: string }>(`/ministries/${id}`, {
      method: "DELETE"
    });
    invalidateCache("ref:ministries");
    return res;
  },

  // Members & Households
  getMembers: (params?: {
    ministry_id?: number;
    search?: string;
    status?: string;
    membership_filter?: string;
    attendance_health_filter?: string;
    household_id?: number;
    birthday_filter?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.membership_filter) q.set("membership_filter", params.membership_filter);
    if (params?.attendance_health_filter) q.set("attendance_health_filter", params.attendance_health_filter);
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
  checkMemberDuplicate: (params: { name?: string; email?: string; phone?: string; exclude_id?: number }) => {
    const q = new URLSearchParams();
    if (params.name) q.set("name", params.name);
    if (params.email) q.set("email", params.email);
    if (params.phone) q.set("phone", params.phone);
    if (params.exclude_id) q.set("exclude_id", String(params.exclude_id));
    return request<{
      exists: boolean;
      duplicateName: Member | null;
      duplicateEmail: Member | null;
      duplicatePhone: Member | null;
    }>(`/members/check-duplicate?${q.toString()}`);
  },

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
  batchMarkAttendance: (data: {
    present_ids?: number[];
    absent_ids?: number[];
    excused_ids?: number[];
    unmark_ids?: number[];
    target_date?: string;
    service_name?: string;
  }) =>
    request<{ success: boolean; message: string; stats: { present: number; absent: number; excused: number; unmarked: number; total: number } }>("/attendance/batch-mark", {
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
  updateMemberBaptism: (memberId: number, data: { baptism_status?: string; is_baptized?: boolean; baptism_date?: string | null; baptism_notes?: string | null }) =>
    request<{ success: boolean; message: string; baptism_status: string; is_baptized: boolean }>(`/members/${memberId}/baptism`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  getQualifiedBaptismCandidates: (ministry_id?: number) => {
    const q = ministry_id ? `?ministry_id=${ministry_id}` : "";
    return request<BaptismCandidatesResponse>(`/members/baptism-candidates/qualified${q}`);
  },
  nominateBaptismCandidates: (data: { member_ids: number[]; notes?: string }) =>
    request<{ success: boolean; count: number; member_ids: number[]; message: string }>("/members/baptism-candidates/nominate", {
      method: "POST",
      body: JSON.stringify(data)
    }),

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
  updateEvent: (id: number, data: Partial<EventItem>) => request<{ message: string }>(`/events/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  deleteEvent: (id: number) => request<{ message: string }>(`/events/${id}`, {
    method: "DELETE"
  }),
  rsvpEvent: (eventId: number, member_id?: number, status = "registered") => request<{ message: string; status?: string }>(`/events/${eventId}/rsvp`, {
    method: "POST",
    body: JSON.stringify({ member_id, status })
  }),

  // Recurring Sunday Events Cycle
  getRecurringSundayEvents: (params?: { year?: number; ministry_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.year) q.set("year", String(params.year));
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return request<RecurringSundayEventsResponse>(`/events/recurring-sunday-cycle${queryStr}`);
  },
  createRecurringSundayEvent: (data: Partial<RecurringSundayEvent>) =>
    request<{ id: number; message: string }>("/events/recurring-sunday-cycle", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateRecurringSundayEvent: (id: number, data: Partial<RecurringSundayEvent>) =>
    request<{ message: string }>(`/events/recurring-sunday-cycle/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteRecurringSundayEvent: (id: number) =>
    request<{ message: string }>(`/events/recurring-sunday-cycle/${id}`, {
      method: "DELETE"
    }),
  syncRecurringSundayEventToCalendar: (id: number, data?: { year?: number; start_time_str?: string; end_time_str?: string; location?: string }) =>
    request<{ success: boolean; event_id: number; projected_date: string; formatted_date: string; message: string }>(`/events/recurring-sunday-cycle/${id}/sync-to-calendar`, {
      method: "POST",
      body: JSON.stringify(data || {})
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
  rescheduleGroup: (id: number, data: { is_rescheduled: boolean; rescheduled_date?: string | null; rescheduled_time?: string | null; reschedule_reason?: string | null; location?: string | null }) => request<{ message: string; is_rescheduled: boolean }>(`/groups/${id}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),
  deleteGroup: (id: number) => request<{ message: string }>(`/groups/${id}`, {
    method: "DELETE"
  }),
  joinGroup: (groupId: number, data?: { member_id?: number; member_ids?: number[]; member_name?: string }) => request<{ message: string }>(`/groups/${groupId}/join`, {
    method: "POST",
    body: JSON.stringify(data || {})
  }),
  getGroupAttendance: (groupId: number) => request<GroupAttendanceResponse>(`/groups/${groupId}/attendance`),
  saveGroupAttendance: (groupId: number, data: {
    session_date: string;
    topic_title?: string;
    chapter?: string;
    notes?: string;
    records?: Array<{ member_id: number; status: string; notes?: string }>;
    present_member_ids?: number[];
    is_special?: boolean;
    special_reason?: string;
  }) => request<{ message: string }>(`/groups/${groupId}/attendance`, {
    method: "POST",
    body: JSON.stringify(data)
  }),
  deleteGroupAttendanceSession: (groupId: number, date: string) => request<{ message: string }>(`/groups/${groupId}/attendance/${date}`, {
    method: "DELETE"
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

  // Finance & Giving (Cached reference data for funds)
  getFunds: async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCached<Fund[]>("ref:funds");
      if (cached) return cached;
    }
    const data = await request<Fund[]>("/finance/funds");
    setCached("ref:funds", data, 10 * 60 * 1000); // 10 mins
    return data;
  },
  createFund: async (data: Partial<Fund>) => {
    const res = await request<{ id: number; message: string }>("/finance/funds", {
      method: "POST",
      body: JSON.stringify(data)
    });
    invalidateCache("ref:funds");
    return res;
  },
  updateFund: async (id: number, data: Partial<Fund>) => {
    const res = await request<{ message: string }>(`/finance/funds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    invalidateCache("ref:funds");
    return res;
  },
  deleteFund: async (id: number) => {
    const res = await request<{ message: string }>(`/finance/funds/${id}`, {
      method: "DELETE"
    });
    invalidateCache("ref:funds");
    return res;
  },
  getDonations: (fund_id?: number, params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (fund_id) q.set("fund_id", String(fund_id));
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return request<any>(`/finance/donations${queryStr}`);
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

  // Master Lookups & System Settings (Cached reference data)
  getLookups: async (paramsOrType?: { type?: string; active_only?: boolean } | string, activeOnly = true, forceRefresh = false) => {
    const q = new URLSearchParams();
    let cacheKey = "ref:lookups:all";
    if (typeof paramsOrType === "string") {
      if (paramsOrType) q.set("type", paramsOrType);
      if (activeOnly) q.set("active_only", "true");
      cacheKey = `ref:lookups:${paramsOrType}:${activeOnly}`;
    } else if (paramsOrType) {
      if (paramsOrType.type) q.set("type", paramsOrType.type);
      if (paramsOrType.active_only !== undefined) q.set("active_only", String(paramsOrType.active_only));
      cacheKey = `ref:lookups:${paramsOrType.type || "all"}:${paramsOrType.active_only ?? true}`;
    }

    if (!forceRefresh) {
      const cached = getCached<SystemLookup[]>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<SystemLookup[]>(`/settings/lookups?${q.toString()}`);
    setCached(cacheKey, data, 10 * 60 * 1000); // 10 mins
    return data;
  },
  createLookup: async (data: Partial<SystemLookup>) => {
    const res = await request<{ id: number; message: string }>("/settings/lookups", {
      method: "POST",
      body: JSON.stringify(data)
    });
    invalidateCache("ref:lookups");
    return res;
  },
  updateLookup: async (id: number, data: Partial<SystemLookup>) => {
    const res = await request<{ message: string }>(`/settings/lookups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    invalidateCache("ref:lookups");
    return res;
  },
  deleteLookup: async (id: number) => {
    const res = await request<{ message: string }>(`/settings/lookups/${id}`, {
      method: "DELETE"
    });
    invalidateCache("ref:lookups");
    return res;
  },

  getGeneralSettings: async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCached<{ settings: Record<string, string>; list: SystemSetting[] }>("ref:settings_general");
      if (cached) return cached;
    }
    const data = await request<{ settings: Record<string, string>; list: SystemSetting[] }>("/settings/general");
    setCached("ref:settings_general", data, 10 * 60 * 1000); // 10 mins
    return data;
  },
  updateGeneralSettings: async (settings: Record<string, string>) => {
    const res = await request<{ message: string }>("/settings/general", {
      method: "PUT",
      body: JSON.stringify({ settings })
    });
    invalidateCache("ref:settings_general");
    return res;
  },

  // Dashboard Reports & Audit
  getDashboardMetrics: (ministry_id?: number) => {
    const q = ministry_id ? `?ministry_id=${ministry_id}` : "";
    return request<DashboardMetrics>(`/reports/dashboard${q}`);
  },
  getGrowthInsights: (params?: { ministry_id?: number; timeframe?: string }) => {
    const q = new URLSearchParams();
    if (params?.ministry_id) q.set("ministry_id", String(params.ministry_id));
    if (params?.timeframe) q.set("timeframe", params.timeframe);
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return request<GrowthInsightsData>(`/reports/growth-insights${queryString}`);
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
  getBibleReadingStats: () => request<BibleReadingStatsResponse>("/bible-reading/stats"),

  // Supabase Cloud Sync & Offsite Replication
  getCloudSyncStatus: () => request<CloudSyncStatusResponse>("/cloud-sync/status"),
  saveCloudSyncConfig: (cloudDatabaseUrl: string) =>
    request<{ success: boolean; message: string; host?: string }>("/cloud-sync/config", {
      method: "POST",
      body: JSON.stringify({ cloudDatabaseUrl })
    }),
  testCloudSyncConnection: (cloudDatabaseUrl?: string) =>
    request<{ success: boolean; message: string; host?: string }>("/cloud-sync/test", {
      method: "POST",
      body: JSON.stringify({ cloudDatabaseUrl })
    }),
  pushToCloud: () => request<CloudSyncResult>("/cloud-sync/push", { method: "POST" }),
  pullFromCloud: () => request<CloudSyncResult>("/cloud-sync/pull", { method: "POST" }),

  // Unified Attendance Log
  getAttendanceLog: (filters: AttendanceLogFilters = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
    if (filters.ministryId !== undefined && filters.ministryId !== "" && filters.ministryId !== "all") {
      params.set("ministryId", String(filters.ministryId));
    }
    if (filters.groupId !== undefined && filters.groupId !== "" && filters.groupId !== "all") {
      params.set("groupId", String(filters.groupId));
    }
    if (filters.memberId !== undefined && filters.memberId !== "") {
      params.set("memberId", String(filters.memberId));
    }
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

    const queryString = params.toString() ? `?${params.toString()}` : "";
    return request<AttendanceLogResponse>(`/attendance-log${queryString}`, { signal });
  },

  exportAttendanceLogCsv: async (filters: AttendanceLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
    if (filters.ministryId !== undefined && filters.ministryId !== "" && filters.ministryId !== "all") {
      params.set("ministryId", String(filters.ministryId));
    }
    if (filters.groupId !== undefined && filters.groupId !== "" && filters.groupId !== "all") {
      params.set("groupId", String(filters.groupId));
    }
    if (filters.memberId !== undefined && filters.memberId !== "") {
      params.set("memberId", String(filters.memberId));
    }
    if (filters.search) params.set("search", filters.search);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const apiBase = getApiBase();
    const token = localStorage.getItem("chms_token");
    const res = await fetch(`${apiBase}/attendance-log/export.csv${queryString}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      let errText = "Failed to export CSV";
      try {
        const json = await res.json();
        errText = json.error || errText;
      } catch {}
      throw new Error(errText);
    }
    return res.blob();
  },

  // Service Calendar Management
  getServices: (params: { from?: string; to?: string; type?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.type) q.set("type", params.type);
    if (params.status) q.set("status", params.status);
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return request<ServicesResponse>(`/services${queryString}`);
  },
  createService: (payload: CreateServicePayload) =>
    request<{ service: ServiceItem }>("/services", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateService: (id: number, payload: UpdateServicePayload) =>
    request<{ service: ServiceItem }>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  generateUpcomingSundays: () =>
    request<{ success: boolean; count: number; message: string }>("/services/generate-sundays", {
      method: "POST"
    }),

  // Member Attendance Summary & Intelligence
  getMemberAttendanceSummary: (id: number, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return request<MemberComprehensiveAttendanceSummary>(`/members/${id}/attendance-summary${queryString}`);
  },

  // Event Attendance Roster & Marking
  getEventAttendanceRoster: (eventId: number) =>
    request<EventAttendanceRosterResponse>(`/events/${eventId}/attendance-roster`),
  markEventAttendance: (eventId: number, data: { member_ids?: number[]; member_id?: number; status?: string; notes?: string; reason?: string }) =>
    request<{ success: boolean; message: string; count: number; status: string }>(`/events/${eventId}/attendance/mark`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  batchMarkEventAttendance: (eventId: number, data: { present_ids?: number[]; absent_ids?: number[]; notes?: string }) =>
    request<{ success: boolean; message: string; stats?: { present: number; absent: number } }>(`/events/${eventId}/attendance/batch-mark`, {
      method: "POST",
      body: JSON.stringify(data)
    })
};




