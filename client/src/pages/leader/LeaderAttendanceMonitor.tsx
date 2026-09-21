import React, { useState, useEffect, useMemo } from "react";
import {
  BibleStudyGroup, GroupAttendanceResponse,
  BibleStudyMemberAttendance, BibleStudySessionDetail
} from "../../types";
import { api } from "../../api";
import { useSocketEvent } from "../../socket";
import {
  Users, CheckCircle2, AlertCircle, Calendar,
  Search, Filter, ChevronDown, ChevronUp, UserX,
  Phone, Mail, Check, X, ShieldAlert, Sparkles,
  Printer, ArrowUpDown, Clock, BookOpen, RefreshCw,
  UserCheck, AlertTriangle, MessageSquare, Trash2,
  ChevronLeft, ChevronRight, CalendarClock
} from "lucide-react";
import { ConfirmationModal } from "../../components/common/ConfirmationModal";

interface LeaderAttendanceMonitorProps {
  activeGroup: BibleStudyGroup | null;
  onOpenRollCall: () => void;
  onToast: (msg: string, type?: "success" | "error") => void;
}

export const LeaderAttendanceMonitor: React.FC<LeaderAttendanceMonitorProps> = ({
  activeGroup,
  onOpenRollCall,
  onToast
}) => {
  const [data, setData] = useState<GroupAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"disciples" | "sessions">("disciples");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "at_risk" | "has_absences" | "consistent">("all");
  const [sortBy, setSortBy] = useState<"absences_desc" | "rate_asc" | "name_asc">("absences_desc");

  // Expanded member details map
  const [expandedMembers, setExpandedMembers] = useState<Record<number, boolean>>({});
  // Expanded session details map
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  // Expanded history badges map for disciples
  const [expandedHistoryDisciples, setExpandedHistoryDisciples] = useState<Record<number, boolean>>({});

  // Pagination for past sessions tab
  const [sessionPage, setSessionPage] = useState(1);
  const SESSIONS_PER_PAGE = 8;

  // Delete session modal state
  const [deleteSessionDate, setDeleteSessionDate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAttendanceData = async () => {
    if (!activeGroup) return;
    try {
      setLoading(true);
      const res = await api.getGroupAttendance(activeGroup.id);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load group attendance data:", err);
      onToast(err.message || "Failed to load attendance monitoring data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [activeGroup?.id]);

  // Real-time synchronization
  useSocketEvent("attendance:changed", () => loadAttendanceData());
  useSocketEvent("groups:changed", () => loadAttendanceData());

  const toggleMemberExpand = (memberId: number) => {
    setExpandedMembers(prev => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  const toggleSessionExpand = (dateStr: string) => {
    setExpandedSessions(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  // Filtered & Sorted Disciples List
  const filteredDisciples = useMemo(() => {
    if (!data?.members) return [];

    return data.members
      .filter((m) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const name = (m.display_name || "").toLowerCase();
          const phone = (m.contact_phone || "").toLowerCase();
          const email = (m.contact_email || "").toLowerCase();
          const ministry = (m.ministry_name || "").toLowerCase();
          if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !ministry.includes(q)) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter === "at_risk") {
          return m.health_status === "at_risk" || m.absent_count >= 3 || m.consecutive_absences >= 2;
        }
        if (statusFilter === "has_absences") {
          return m.absent_count > 0;
        }
        if (statusFilter === "consistent") {
          return m.absent_count === 0;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "absences_desc") {
          return b.absent_count - a.absent_count || a.attendance_rate - b.attendance_rate;
        }
        if (sortBy === "rate_asc") {
          return a.attendance_rate - b.attendance_rate || b.absent_count - a.absent_count;
        }
        return (a.display_name || "").localeCompare(b.display_name || "");
      });
  }, [data?.members, searchQuery, statusFilter, sortBy]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];
    if (!searchQuery.trim()) return data.sessions;
    const q = searchQuery.toLowerCase().trim();
    return data.sessions.filter(s =>
      s.session_date.includes(q) ||
      (s.topic_title || "").toLowerCase().includes(q) ||
      (s.chapter || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q)
    );
  }, [data?.sessions, searchQuery]);

  // Reset pagination on search or sub-tab switch
  useEffect(() => {
    setSessionPage(1);
  }, [searchQuery, activeSubTab]);

  const totalSessionPages = Math.max(1, Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE));
  const paginatedSessions = useMemo(() => {
    const start = (sessionPage - 1) * SESSIONS_PER_PAGE;
    return filteredSessions.slice(start, start + SESSIONS_PER_PAGE);
  }, [filteredSessions, sessionPage]);

  const handleDeleteSession = async () => {
    if (!activeGroup || !deleteSessionDate) return;
    try {
      setIsDeleting(true);
      await api.deleteGroupAttendanceSession(activeGroup.id, deleteSessionDate);
      onToast(`✓ Attendance records for ${deleteSessionDate} removed`, "success");
      setDeleteSessionDate(null);
      loadAttendanceData();
    } catch (err: any) {
      onToast(err.message || "Failed to delete session", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!activeGroup) {
    return (
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-12 text-center space-y-3">
        <Users className="w-12 h-12 text-charcoal/30 mx-auto" />
        <h3 className="text-base font-black text-charcoal">No Group Selected</h3>
        <p className="text-xs text-charcoal/60 max-w-sm mx-auto">
          Please select a Small Group from the dropdown above to monitor attendance and absentee records.
        </p>
      </div>
    );
  }

  const summary = data?.summary || {
    total_sessions: 0,
    total_enrolled: activeGroup.members?.length || 0,
    overall_attendance_rate: 100,
    total_absences: 0,
    total_presents: 0,
    at_risk_count: 0,
    average_attendees_per_session: "0"
  };

  return (
    <div className="space-y-6">
      {/* ==================================================== */}
      {/* 4 TOP SUMMARY METRIC CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-charcoal/50">
              Total Sessions Held
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center font-black text-xs">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-charcoal">
              {summary.total_sessions} <span className="text-xs font-bold text-charcoal/50">sessions</span>
            </div>
            <p className="text-[11px] text-charcoal/60 mt-0.5 font-semibold">
              Avg {summary.average_attendees_per_session} attendees / session
            </p>
          </div>
        </div>

        {/* Overall Attendance Rate */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-charcoal/50">
              Attendance Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-950">
              {summary.overall_attendance_rate}%
            </div>
            <div className="w-full bg-emerald-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary.overall_attendance_rate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total Absences Logged */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-charcoal/50">
              Total Absences (Dati)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xs">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-950">
              {summary.total_absences} <span className="text-xs font-bold text-charcoal/50">missed slots</span>
            </div>
            <p className="text-[11px] text-amber-800/80 mt-0.5 font-semibold">
              Across all recorded meetings
            </p>
          </div>
        </div>

        {/* At-Risk Disciples Requiring Follow-Up */}
        <div className={`rounded-3xl border shadow-xs p-5 flex flex-col justify-between relative overflow-hidden ${
          summary.at_risk_count > 0
            ? "bg-gradient-to-br from-rose-50 to-orange-50/50 border-rose-200"
            : "bg-white border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-900/70">
              Needs Follow-Up
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-950">
              {summary.at_risk_count} <span className="text-xs font-bold text-charcoal/50">disciples</span>
            </div>
            <p className="text-[11px] text-rose-800/80 mt-0.5 font-semibold">
              {summary.at_risk_count > 0 ? ">=2 or 3 consecutive absences" : "All members consistent"}
            </p>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MAIN CONTAINER: SUB-TABS & CONTROLS */}
      {/* ==================================================== */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
        {/* Sub-Tabs Header & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveSubTab("disciples")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSubTab === "disciples"
                  ? "bg-white text-charcoal shadow-xs"
                  : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <UserCheck className="w-4 h-4 text-indigo" />
              <span>Disciple Absentee Breakdown</span>
              <span className="bg-indigo-100 text-indigo-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {data?.members?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("sessions")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSubTab === "sessions"
                  ? "bg-white text-charcoal shadow-xs"
                  : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Past Session History Logs (Dati)</span>
              <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {data?.sessions?.length || 0}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenRollCall}
              className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Take Weekly Roll-Call</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer print:hidden"
              title="Print attendance report"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={loadAttendanceData}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal/70 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeSubTab === "disciples" ? "Search disciple name, phone, ministry..." : "Search past session topic, date, chapter..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-ivory-light rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-semibold text-charcoal"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters for Disciples Sub-Tab */}
          {activeSubTab === "disciples" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    statusFilter === "all" ? "bg-white text-charcoal shadow-2xs" : "text-charcoal/60"
                  }`}
                >
                  All ({data?.members?.length || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("at_risk")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    statusFilter === "at_risk" ? "bg-rose-500 text-white shadow-2xs" : "text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  Needs Follow-Up ({summary.at_risk_count})
                </button>
                <button
                  onClick={() => setStatusFilter("has_absences")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    statusFilter === "has_absences" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  Has Absences ({data?.members?.filter(m => m.absent_count > 0).length || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("consistent")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    statusFilter === "consistent" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  100% Consistent
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-charcoal/40" />
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-ivory-light py-1.5 px-2.5 rounded-xl border border-gray-200 text-[11px] font-bold text-charcoal cursor-pointer"
                >
                  <option value="absences_desc">Most Absences First</option>
                  <option value="rate_asc">Lowest Attendance Rate</option>
                  <option value="name_asc">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* SUB-TAB 1: DISCIPLE ABSENTEE & ATTENDANCE BREAKDOWN */}
        {/* ==================================================== */}
        {activeSubTab === "disciples" && (
          <div className="space-y-3">
            {filteredDisciples.length === 0 ? (
              <div className="py-12 text-center text-charcoal/50 space-y-2 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <UserCheck className="w-8 h-8 mx-auto text-charcoal/30" />
                <p className="font-bold text-xs">No disciples matched your filter</p>
                <p className="text-[11px]">Try adjusting your search query or selecting "All"</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white">
                {filteredDisciples.map((disciple) => {
                  const isExpanded = Boolean(expandedMembers[disciple.member_id]);
                  const initials = `${disciple.first_name?.[0] || ""}${disciple.last_name?.[0] || ""}`.toUpperCase() || "M";

                  const isAtRisk = disciple.health_status === "at_risk" || disciple.absent_count >= 3 || disciple.consecutive_absences >= 2;

                  return (
                    <div
                      key={disciple.member_id}
                      className={`transition-colors ${
                        isAtRisk ? "bg-rose-50/20" : ""
                      }`}
                    >
                      {/* Member Main Row */}
                      <div
                        onClick={() => toggleMemberExpand(disciple.member_id)}
                        className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/80 transition-colors"
                      >
                        {/* Member Identity */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                            isAtRisk
                              ? "bg-rose-100 text-rose-800 ring-2 ring-rose-300"
                              : disciple.absent_count === 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-50 text-indigo"
                          }`}>
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-charcoal text-sm truncate">
                                {disciple.display_name}
                              </span>

                              {isAtRisk && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black animate-pulse">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Needs Shepherd Follow-Up</span>
                                </span>
                              )}

                              {disciple.consecutive_absences >= 2 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  {disciple.consecutive_absences} missed in a row
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-charcoal/50 mt-0.5 flex-wrap">
                              {disciple.ministry_name ? (
                                <span className="font-bold text-indigo bg-indigo-50 px-1.5 py-0.2 rounded-md">
                                  {disciple.ministry_name}
                                </span>
                              ) : (
                                <span>General Member</span>
                              )}
                              {disciple.contact_phone && (
                                <span className="flex items-center gap-1 text-charcoal/70">
                                  <Phone className="w-3 h-3" />
                                  <span>{disciple.contact_phone}</span>
                                </span>
                              )}
                              {disciple.contact_email && (
                                <span className="hidden md:flex items-center gap-1 text-charcoal/50 truncate">
                                  <Mail className="w-3 h-3" />
                                  <span className="truncate">{disciple.contact_email}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Absences & Attendance Statistics */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          {/* Present vs Total */}
                          <div className="text-left sm:text-right">
                            <div className="text-xs font-black text-charcoal">
                              {disciple.present_count} / {summary.total_sessions} <span className="text-[10px] font-bold text-charcoal/50">Sessions</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 sm:justify-end">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    disciple.attendance_rate >= 80
                                      ? "bg-emerald-500"
                                      : disciple.attendance_rate >= 60
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${disciple.attendance_rate}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-black text-charcoal/70">
                                {disciple.attendance_rate}%
                              </span>
                            </div>
                          </div>

                          {/* Absent Counter Badge (User explicitly requested: makita lahat kung ilan na absent) */}
                          <div className="shrink-0 text-center">
                            <span className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-black shadow-2xs ${
                              disciple.absent_count === 0
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : disciple.absent_count >= 3
                                ? "bg-rose-500 text-white shadow-xs"
                                : "bg-amber-100 text-amber-950 border border-amber-300"
                            }`}>
                              <UserX className="w-3.5 h-3.5" />
                              <span>{disciple.absent_count} {disciple.absent_count === 1 ? "Absent" : "Absences"}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            className="p-1 text-charcoal/40 hover:text-indigo rounded-lg cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Session-by-Session Timeline Tray */}
                      {isExpanded && (
                        <div className="bg-gray-50/70 border-t border-gray-100 p-4 space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between text-xs font-bold text-charcoal/70">
                            <span>Attendance History Across All {summary.total_sessions} Sessions:</span>
                            {disciple.contact_phone && (
                              <a
                                href={`tel:${disciple.contact_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-indigo hover:text-indigo-800 text-[11px] flex items-center gap-1 font-bold"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call Disciple for Follow-Up</span>
                              </a>
                            )}
                          </div>

                          {disciple.history.length === 0 ? (
                            <p className="text-xs text-charcoal/50 italic">No session attendance recorded yet.</p>
                          ) : (
                            <div>
                              {(() => {
                                const isAllHistoryShown = Boolean(expandedHistoryDisciples[disciple.member_id]);
                                const displayedHistory = isAllHistoryShown ? disciple.history : disciple.history.slice(0, 6);

                                return (
                                  <div className="space-y-2.5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {displayedHistory.map((h, idx) => {
                                        const formattedDate = new Date(h.session_date).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric"
                                        });

                                        return (
                                          <div
                                            key={idx}
                                            className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 transition-all ${
                                              h.status === "present"
                                                ? "bg-white border-emerald-200 text-emerald-950"
                                                : h.status === "excused"
                                                ? "bg-white border-sky-200 text-sky-950"
                                                : "bg-rose-50/80 border-rose-200 text-rose-950 font-semibold"
                                            }`}
                                          >
                                            <div>
                                              <div className="font-extrabold flex items-center gap-1.5">
                                                <Calendar className="w-3 h-3 text-charcoal/40" />
                                                <span>{formattedDate}</span>
                                              </div>
                                              <div className="text-[10px] text-charcoal/60 truncate mt-0.5">
                                                {h.chapter || h.topic_title}
                                              </div>
                                              {h.notes && (
                                                <div className="text-[10px] text-charcoal/50 italic mt-0.5 line-clamp-1">
                                                  "{h.notes}"
                                                </div>
                                              )}
                                            </div>

                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                              h.status === "present"
                                                ? "bg-emerald-100 text-emerald-900"
                                                : h.status === "excused"
                                                ? "bg-sky-100 text-sky-900"
                                                : "bg-rose-500 text-white"
                                            }`}>
                                              {h.status}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {disciple.history.length > 6 && (
                                      <div className="pt-1 flex justify-center">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedHistoryDisciples(prev => ({
                                              ...prev,
                                              [disciple.member_id]: !prev[disciple.member_id]
                                            }));
                                          }}
                                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo font-bold text-[11px] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                        >
                                          {isAllHistoryShown ? (
                                            <>
                                              <ChevronUp className="w-3.5 h-3.5" />
                                              <span>Show Recent 6 Only</span>
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="w-3.5 h-3.5" />
                                              <span>View All {disciple.history.length} Sessions (+{disciple.history.length - 6} older)</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* SUB-TAB 2: PAST SESSION HISTORY LOGS ("DATI") */}
        {/* ==================================================== */}
        {activeSubTab === "sessions" && (
          <div className="space-y-3">
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-charcoal/50 space-y-2 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <Calendar className="w-8 h-8 mx-auto text-charcoal/30" />
                <p className="font-bold text-xs">No past Bible Study sessions found</p>
                <p className="text-[11px]">Click "Take Weekly Roll-Call" above to log attendance for a meeting date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedSessions.map((session) => {
                  const isExpanded = Boolean(expandedSessions[session.session_date]);
                  const formattedDate = new Date(session.session_date).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  });

                  return (
                    <div
                      key={session.id || session.session_date}
                      className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden transition-all hover:border-gray-300"
                    >
                      {/* Session Header Bar */}
                      <div
                        onClick={() => toggleSessionExpand(session.session_date)}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/60 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                            <BookOpen className="w-5 h-5 text-amber-600" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-sm text-charcoal">
                                {formattedDate}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo font-bold text-[10px]">
                                {session.chapter || "Bible Study Session"}
                              </span>
                            </div>

                            <p className="text-xs text-charcoal/70 font-semibold mt-0.5">
                              {session.topic_title || activeGroup.curriculum || "Weekly Life Group Fellowship"}
                            </p>

                            {session.notes && (
                              <p className="text-[11px] text-charcoal/50 italic mt-0.5 line-clamp-1">
                                💬 "{session.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Attendees vs Absentees Ratio */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-extrabold text-xs">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{session.present_count} Present</span>
                            </span>

                            {session.absent_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-extrabold text-xs">
                                <X className="w-3.5 h-3.5 text-rose-600" />
                                <span>{session.absent_count} Absent</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteSessionDate(session.session_date);
                            }}
                            className="p-1.5 rounded-lg text-charcoal/30 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Delete session log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="p-1 text-charcoal/40">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Session Roster (Attendees vs Absentees List) */}
                      {isExpanded && (
                        <div className="bg-gray-50/80 border-t border-gray-100 p-4 space-y-4 animate-in fade-in text-xs">
                          {/* Attendees Section */}
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-emerald-950 mb-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Present Disciples ({session.attendees.length}):</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {session.attendees.length === 0 ? (
                                <span className="text-charcoal/40 italic">No disciples marked present</span>
                              ) : (
                                session.attendees.map(a => (
                                  <span
                                    key={a.member_id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-emerald-200 text-emerald-900 font-bold text-xs shadow-2xs"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>{a.name}</span>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Absentees Section (Crucial for Leader to see who missed) */}
                          {session.absentees.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-rose-950 mb-2">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span>Absent Disciples ({session.absentees.length}):</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {session.absentees.map(a => (
                                  <span
                                    key={a.member_id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-rose-200 text-rose-900 font-bold text-xs shadow-2xs"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                                    <span>{a.name}</span>
                                    {a.contact_phone && (
                                      <a
                                        href={`tel:${a.contact_phone}`}
                                        className="text-rose-600 hover:text-rose-800 ml-1"
                                        title={`Call ${a.name}`}
                                      >
                                        <Phone className="w-3 h-3" />
                                      </a>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Session Notes */}
                          {session.notes && (
                            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
                              <div className="font-bold text-charcoal/70 flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo" />
                                <span>Leader Session Notes & Prayer Highlights:</span>
                              </div>
                              <p className="text-charcoal/80 italic pl-4 border-l-2 border-indigo/40">
                                {session.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pagination Controls for Past Sessions */}
                {filteredSessions.length > 0 && totalSessionPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 text-xs">
                    <div className="text-charcoal/60 font-semibold text-[11px]">
                      Showing <strong className="text-charcoal">{(sessionPage - 1) * SESSIONS_PER_PAGE + 1}</strong> to <strong className="text-charcoal">{Math.min(sessionPage * SESSIONS_PER_PAGE, filteredSessions.length)}</strong> of <strong className="text-charcoal">{filteredSessions.length}</strong> past sessions
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={sessionPage <= 1}
                        onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-charcoal/70 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalSessionPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setSessionPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              sessionPage === pageNum
                                ? "bg-indigo text-white shadow-2xs"
                                : "bg-white text-charcoal/70 hover:bg-gray-100 border border-gray-200"
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={sessionPage >= totalSessionPages}
                        onClick={() => setSessionPage(p => Math.min(totalSessionPages, p + 1))}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-charcoal/70 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Session Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteSessionDate)}
        title="Delete Session Attendance Log?"
        description={`Are you sure you want to delete the attendance records for ${deleteSessionDate}? Disciples' absentee counts will be recalculated automatically.`}
        type="danger"
        confirmText={isDeleting ? "Deleting..." : "Delete Log"}
        onConfirm={handleDeleteSession}
        onClose={() => setDeleteSessionDate(null)}
        isLoading={isDeleting}
      />
    </div>
  );
};
