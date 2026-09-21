import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api";
import { Member, MemberComprehensiveAttendanceSummary, AttendanceLogItem } from "../../types";
import {
  X,
  Calendar,
  Sparkles,
  Flame,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  HeartHandshake,
  PartyPopper,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  UserCheck,
  TrendingUp,
  Droplets,
  Pencil,
  Check,
  HelpCircle,
  FileText,
  ShieldCheck,
  Info
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export type AttendanceModalTab = "overview" | "logs" | "monthly" | "milestones" | "audit";

interface MemberAttendanceSummaryModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AttendanceModalTab;
  onMemberUpdated?: (updatedMember: Partial<Member>) => void;
}

export const MemberAttendanceSummaryModal: React.FC<MemberAttendanceSummaryModalProps> = ({
  member,
  isOpen,
  onClose,
  initialTab = "overview",
  onMemberUpdated
}) => {
  const { user } = useAuth();
  const canEditBaptism = user?.role_name === "Admin" || user?.role_name === "Coordinator" || user?.role_name === "Leader";

  const getDefaultDateRange = () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const [y, m, d] = today.split("-").map(Number);
    const past12Weeks = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(y, m - 1, d - 12 * 7)
    );
    return { from: past12Weeks, to: today };
  };

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState<string>(defaultDates.from);
  const [toDate, setToDate] = useState<string>(defaultDates.to);
  const [activeTab, setActiveTab] = useState<AttendanceModalTab>(initialTab);

  const [summaryData, setSummaryData] = useState<MemberComprehensiveAttendanceSummary | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Water Baptism Milestone Edit State
  const [isEditingBaptism, setIsEditingBaptism] = useState<boolean>(false);
  const [baptismForm, setBaptismForm] = useState({
    baptism_status: "not_baptized",
    is_baptized: false,
    baptism_notes: ""
  });
  const [isSavingBaptism, setIsSavingBaptism] = useState<boolean>(false);
  const [baptismSuccessMessage, setBaptismSuccessMessage] = useState<string | null>(null);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const loadAttendanceData = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, logsRes] = await Promise.all([
        api.getMemberAttendanceSummary(member.id, fromDate, toDate),
        api.getAttendanceLog({
          memberId: member.id,
          from: fromDate,
          to: toDate,
          pageSize: 200
        }).catch(() => ({ rows: [] }))
      ]);

      setSummaryData(summaryRes);
      setAttendanceLogs(logsRes.rows || []);

      if (summaryRes.baptism_tracker) {
        setBaptismForm({
          baptism_status: summaryRes.baptism_tracker.baptism_status || "not_baptized",
          is_baptized: summaryRes.baptism_tracker.is_baptized,
          baptism_notes: summaryRes.baptism_tracker.baptism_notes || ""
        });
      }
    } catch (err: any) {
      console.error("Failed to load member attendance data:", err);
      setError(err?.message || "Failed to load attendance summary");
    } finally {
      setLoading(false);
    }
  }, [member, fromDate, toDate]);

  useEffect(() => {
    if (isOpen && member) {
      loadAttendanceData();
    }
  }, [isOpen, member, loadAttendanceData]);

  const handleSaveBaptism = async () => {
    if (!member || isSavingBaptism) return;
    try {
      setIsSavingBaptism(true);
      await api.updateMemberBaptism(member.id, {
        baptism_status: baptismForm.baptism_status,
        is_baptized: baptismForm.is_baptized,
        baptism_notes: baptismForm.baptism_notes.trim() || null
      });

      setBaptismSuccessMessage("Baptism status saved!");
      setIsEditingBaptism(false);
      setTimeout(() => setBaptismSuccessMessage(null), 3000);

      if (onMemberUpdated) {
        onMemberUpdated({
          is_baptized: baptismForm.is_baptized,
          baptism_status: baptismForm.baptism_status,
          baptism_notes: baptismForm.baptism_notes.trim() || undefined
        });
      }

      await loadAttendanceData();
    } catch (err: any) {
      alert(`Failed to save baptism status: ${err.message || "Unknown error"}`);
    } finally {
      setIsSavingBaptism(false);
    }
  };

  const handleExportCsv = async () => {
    if (!member || !summaryData) return;
    try {
      setIsExporting(true);
      let csvContent = "";
      let filename = `attendance_${member.first_name}_${member.last_name}_${fromDate}_to_${toDate}.csv`;

      if (activeTab === "monthly") {
        // Export monthly breakdown
        filename = `monthly_attendance_${member.first_name}_${member.last_name}_${fromDate}_to_${toDate}.csv`;
        const headers = ["Month", "Present (Days)", "Absent", "Excused", "Total Sundays in Month", "Elapsed Sundays", "Status"];
        const rows = summaryData.monthly_breakdown.map((m) => [
          m.month_name,
          m.present,
          m.absent,
          m.excused,
          m.total_sundays_in_month,
          m.elapsed_sundays,
          m.is_future ? "Future Month" : "Elapsed"
        ]);
        csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
      } else if (activeTab === "logs") {
        // Export attendance log
        filename = `attendance_log_${member.first_name}_${member.last_name}_${fromDate}_to_${toDate}.csv`;
        const headers = ["Date", "Time", "Status", "Notes / Service", "Security Code", "Checked In By", "Ministry"];
        const rows = summaryData.records.map((r) => [
          r.date_str,
          r.time_str,
          r.status.toUpperCase(),
          r.notes || "Sunday Service",
          r.security_code || "",
          r.checked_in_by_name || "",
          r.ministry_name || ""
        ]);
        csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
      } else {
        // Export standard audit log / summary
        const blob = await api.exportAttendanceLogCsv({
          memberId: member.id,
          from: fromDate,
          to: toDate
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setIsExporting(false);
        return;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const applyQuickWindow = (weeks: number) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const [y, m, d] = today.split("-").map(Number);
    const start = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(y, m - 1, d - weeks * 7)
    );
    setFromDate(start);
    setToDate(today);
  };

  const applyYtdWindow = () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const year = today.split("-")[0];
    setFromDate(`${year}-01-01`);
    setToDate(today);
  };

  const applyThisYearWindow = () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const year = today.split("-")[0];
    setFromDate(`${year}-01-01`);
    setToDate(`${year}-12-31`);
  };

  const isPresetActive = (preset: "4w" | "12w" | "ytd" | "thisYear") => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const [y, m, d] = today.split("-").map(Number);
    const year = today.split("-")[0];
    if (preset === "4w") {
      const p4 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(y, m - 1, d - 4 * 7));
      return fromDate === p4 && toDate === today;
    }
    if (preset === "12w") {
      const p12 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(y, m - 1, d - 12 * 7));
      return fromDate === p12 && toDate === today;
    }
    if (preset === "ytd") {
      return fromDate === `${year}-01-01` && toDate === today;
    }
    if (preset === "thisYear") {
      return fromDate === `${year}-01-01` && toDate === `${year}-12-31`;
    }
    return false;
  };

  const isInitialLoading = loading && !summaryData;
  const isRefreshing = loading && !!summaryData;

  // Resolved age display
  const memberAgeDisplay = useMemo(() => {
    if (summaryData?.member?.age) return `${summaryData.member.age} yrs old`;
    if (member?.age) return `${member.age} yrs old`;
    if (member?.birthdate) {
      const birth = new Date(member.birthdate);
      const now = new Date();
      let a = now.getFullYear() - birth.getFullYear();
      const mDiff = now.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) a--;
      return `${a} yrs old`;
    }
    return null;
  }, [summaryData, member]);

  if (!isOpen || !member) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-charcoal/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200/90 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-900 via-indigo-950 to-stone-900 text-white flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-lg overflow-hidden shadow-inner shrink-0">
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.first_name} className="w-full h-full object-cover" />
              ) : (
                <span>{member.first_name[0]}{member.last_name[0]}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {member.first_name} {member.last_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-stone-900 shadow-sm">
                  {member.ministry_name || "Member"}
                </span>
                {memberAgeDisplay && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-stone-200 border border-white/10">
                    {memberAgeDisplay}
                  </span>
                )}
                {summaryData?.baptism_tracker?.is_baptized ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                    💧 Baptized
                  </span>
                ) : summaryData?.baptism_tracker?.baptism_status === "candidate" ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 animate-pulse">
                    🌊 Candidate
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-stone-300 font-medium mt-0.5">
                Attendance Intelligence, Faithful Service Rates & Spiritual Milestones
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white bg-white/5 hover:bg-white/15 rounded-xl transition relative z-10 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Filter Strip */}
        <div className="bg-stone-50 border-b border-stone-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-stone-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo" />
              <span>Window:</span>
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-charcoal outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo cursor-pointer"
            />
            <span className="text-stone-400 font-bold">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-charcoal outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo cursor-pointer"
            />
            {isRefreshing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                <Loader2 className="w-3 h-3 animate-spin text-indigo" />
                <span>Updating...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => applyQuickWindow(4)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                isPresetActive("4w")
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-700"
              }`}
            >
              4 Weeks
            </button>
            <button
              onClick={() => applyQuickWindow(12)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                isPresetActive("12w")
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-700"
              }`}
            >
              12 Weeks
            </button>
            <button
              onClick={applyYtdWindow}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                isPresetActive("ytd")
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-700"
              }`}
            >
              YTD
            </button>
            <button
              onClick={applyThisYearWindow}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                isPresetActive("thisYear")
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-700"
              }`}
            >
              This Year
            </button>
            <button
              onClick={handleExportCsv}
              disabled={isExporting || isInitialLoading}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              title="Export data for active tab in selected window"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation (5 Clean Tabs) */}
        <div className="flex border-b border-stone-200 bg-white px-5 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "overview"
                ? "border-indigo text-indigo"
                : "border-transparent text-stone-500 hover:text-charcoal"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Overview</span>
          </button>
          
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "logs"
                ? "border-indigo text-indigo"
                : "border-transparent text-stone-500 hover:text-charcoal"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Attendance Log ({summaryData?.records.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("monthly")}
            className={`py-3 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "monthly"
                ? "border-indigo text-indigo"
                : "border-transparent text-stone-500 hover:text-charcoal"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Monthly</span>
          </button>

          <button
            onClick={() => setActiveTab("milestones")}
            className={`py-3 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "milestones"
                ? "border-indigo text-indigo"
                : "border-transparent text-stone-500 hover:text-charcoal"
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>Milestones</span>
            {summaryData?.baptism_tracker?.should_alert && (
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`py-3 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "audit"
                ? "border-indigo text-indigo"
                : "border-transparent text-stone-500 hover:text-charcoal"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Audit History ({attendanceLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={`p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 transition-opacity duration-150 ${isRefreshing ? "opacity-75" : "opacity-100"}`}>
          {isInitialLoading && (
            <div className="py-16 text-center">
              <Loader2 className="w-10 h-10 text-indigo animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-stone-500">Calculating attendance rates and streak patterns...</p>
            </div>
          )}

          {!isInitialLoading && error && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <div className="text-sm font-bold text-rose-900">{error}</div>
              <button
                onClick={loadAttendanceData}
                className="mt-2 px-4 py-1.5 bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {!isInitialLoading && !error && summaryData && activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Overall Rate Banner */}
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-stone-900 text-white p-5 rounded-2xl border border-indigo-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 font-black text-2xl shadow-inner shrink-0">
                    {summaryData.consistency_score !== null ? `${summaryData.consistency_score}%` : "N/A"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Overall Consistency Score</span>
                      <span className="text-[10px] text-stone-400 group relative cursor-help" title="Formula: Attended Sundays / (Elapsed Sundays - Excused)">
                        <Info className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">
                      {summaryData.consistency_tier === "Consistent Regular" && "🌟 Consistent Regular"}
                      {summaryData.consistency_tier === "Regular Attendee" && "✨ Regular Attendee"}
                      {summaryData.consistency_tier === "Developing Habit" && "🌱 Developing Habit"}
                      {summaryData.consistency_tier === "Needs Encouragement" && "⚠️ Needs Encouragement"}
                      {summaryData.consistency_tier === "Inactive / Disengaged" && "⚪ Inactive / Disengaged"}
                      {summaryData.consistency_tier === "No Data" && "No Sessions in Window"}
                    </h3>
                    <p className="text-xs text-stone-300">
                      Evaluated across all elapsed Sundays in the selected timeframe ({fromDate} to {toDate}).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-stone-300 font-medium">Sunday Streak</div>
                    <div className="text-sm font-extrabold text-amber-400 flex items-center justify-end gap-1">
                      <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span>{summaryData.sunday_service.current_streak} consecutive</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Cards: Sunday, Bible Study, Events */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Sunday Worship Services */}
                <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-100 text-indigo rounded-xl">
                        <Sparkles className="w-4 h-4 text-indigo" />
                      </div>
                      <h4 className="text-sm font-extrabold text-charcoal">Sunday Services</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-indigo">
                        {summaryData.sunday_service.attendance_rate_percentage !== null
                          ? `${summaryData.sunday_service.attendance_rate_percentage}%`
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Attended</span>
                      <div className="text-base font-black text-emerald-700">
                        {summaryData.sunday_service.attended} <span className="text-[10px] text-stone-400 font-normal">/ {summaryData.sunday_service.total_held_services}</span>
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Absent / Exc</span>
                      <div className="text-base font-black text-amber-700">
                        {summaryData.sunday_service.absent || 0} <span className="text-[10px] text-stone-400 font-normal">({summaryData.sunday_service.excused} exc)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-200">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        Current Streak:
                      </span>
                      <span className="font-bold text-charcoal">{summaryData.sunday_service.current_streak} Sundays</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Award className="w-3.5 h-3.5 text-indigo" />
                        Longest Streak:
                      </span>
                      <span className="font-bold text-charcoal">{summaryData.sunday_service.longest_streak} Sundays</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-stone-400 font-medium">Last Attended:</span>
                      <span className="font-bold text-charcoal">{summaryData.sunday_service.last_attended_date || "None in window"}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Bible Study Groups */}
                <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
                        <HeartHandshake className="w-4 h-4 text-amber-600" />
                      </div>
                      <h4 className="text-sm font-extrabold text-charcoal">Bible Study</h4>
                    </div>
                    <span className="text-lg font-black text-amber-800">
                      {summaryData.bible_study.attendance_rate_percentage !== null
                        ? `${summaryData.bible_study.attendance_rate_percentage}%`
                        : <span className="text-xs font-bold text-stone-400">No sessions</span>}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
                    <div className="bg-white p-2 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Present</span>
                      <div className="text-sm font-black text-emerald-700">{summaryData.bible_study.attended}</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Excused</span>
                      <div className="text-sm font-black text-amber-600">{summaryData.bible_study.excused}</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Absent</span>
                      <div className="text-sm font-black text-rose-600">{summaryData.bible_study.missed}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-200">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        Current Streak:
                      </span>
                      <span className="font-bold text-charcoal">{summaryData.bible_study.current_streak} Sessions</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Award className="w-3.5 h-3.5 text-amber-700" />
                        Longest Streak:
                      </span>
                      <span className="font-bold text-charcoal">{summaryData.bible_study.longest_streak} Sessions</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-stone-400 font-medium">Last Attended:</span>
                      <span className="font-bold text-charcoal">{summaryData.bible_study.last_attended_date || "None in window"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Special Events */}
                <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-100 text-purple-900 rounded-xl">
                        <PartyPopper className="w-4 h-4 text-purple-600" />
                      </div>
                      <h4 className="text-sm font-extrabold text-charcoal">Special Events</h4>
                    </div>
                    <span className="text-lg font-black text-purple-900">
                      {summaryData.events.attended} <span className="text-xs text-stone-400 font-normal">attended</span>
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-2">
                    <div className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                      Events in this Period
                    </div>
                    {summaryData.events.events_list.length === 0 ? (
                      <p className="text-stone-400 italic text-[11px]">No special events attended in this timeframe.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                        {summaryData.events.events_list.map((ev) => (
                          <li key={ev.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-charcoal truncate max-w-[140px]" title={ev.title}>
                              {ev.title}
                            </span>
                            <span className="text-stone-400 text-[10px]">{ev.event_date}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-200">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 font-medium">Last Event:</span>
                      <span className="font-bold text-charcoal">{summaryData.events.last_attended_date || "None in window"}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE LOG */}
          {!isInitialLoading && !error && summaryData && activeTab === "logs" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo" />
                  <span>Sunday & Midweek Attendance Records ({summaryData.records.length})</span>
                </div>
                <span className="text-[11px] text-stone-400">
                  Showing logs from {fromDate} to {toDate}
                </span>
              </div>

              {summaryData.records.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-xs font-bold">No attendance records found for this member in the selected window.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-[10px] font-black text-stone-500 uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="py-3 px-4">Date & Time</th>
                          <th className="py-3 px-4">Service Name / Notes</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4">Security Tag</th>
                          <th className="py-3 px-4">Checked In By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {summaryData.records.map((r) => (
                          <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-black text-stone-900 whitespace-nowrap">
                              <div>{r.date_str}</div>
                              <div className="text-[10px] text-stone-400 font-normal">{r.time_str}</div>
                            </td>
                            <td className="py-2.5 px-4 font-bold text-charcoal/80">
                              {r.notes || "Sunday Divine Worship Service"}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                r.status === "present"
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                  : r.status === "excused"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-rose-100 text-rose-900 border border-rose-300"
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-stone-600">
                              {r.security_code ? (
                                <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 font-bold">
                                  {r.security_code}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 px-4 text-stone-600 text-xs font-medium">
                              {r.checked_in_by_name || "Self / Kiosk"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MONTHLY BREAKDOWN */}
          {!isInitialLoading && !error && summaryData && activeTab === "monthly" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo" />
                  <span>12-Month Calendar Breakdown ({toDate.split("-")[0]})</span>
                </div>
                <span className="text-[11px] text-stone-400 font-medium">
                  Sundays Present per Month
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {summaryData.monthly_breakdown.map((m) => {
                  const hasAttendance = m.present > 0;
                  return (
                    <div
                      key={m.month_num}
                      className={`p-3 rounded-2xl border transition-all ${
                        m.is_future
                          ? "bg-stone-50 border-stone-200 opacity-60"
                          : hasAttendance
                            ? "bg-emerald-50/50 border-emerald-200 shadow-2xs"
                            : "bg-white border-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-black text-xs text-stone-900">
                          {m.month_name.slice(0, 3)}
                        </span>
                        {m.is_future ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-600">
                            Upcoming
                          </span>
                        ) : (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                            hasAttendance ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
                          }`}>
                            {m.present} {m.present === 1 ? "day" : "days"}
                          </span>
                        )}
                      </div>

                      <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (m.present / Math.max(m.total_sundays_in_month || 4, 1)) * 100)}%`
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-[9px] text-stone-400 font-semibold mt-2">
                        <span>Abs: {m.absent}</span>
                        <span>Exc: {m.excused}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: MILESTONES (WATER BAPTISM) */}
          {!isInitialLoading && !error && summaryData && activeTab === "milestones" && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Candidate Alert Banner */}
              {summaryData.baptism_tracker.should_alert && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-amber-500/15 to-cyan-500/20 border-2 border-cyan-400/80 shadow-md space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-cyan-600 text-white shadow-xs animate-bounce">
                        <Droplets className="w-5 h-5 fill-white" />
                      </span>
                      <div>
                        <h4 className="font-black text-xs text-stone-900 flex items-center gap-1.5">
                          <span>BAPTISM CEREMONY CANDIDATE ALERT</span>
                          <span className="text-[10px] bg-cyan-700 text-white font-black px-2 py-0.5 rounded-full">
                            Qualified
                          </span>
                        </h4>
                        <p className="text-[11px] text-stone-700 font-medium">
                          {summaryData.baptism_tracker.alert_reason || "This member is recommended for the upcoming Baptism Ceremony!"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-white/90 px-3 py-1.5 rounded-xl border border-cyan-300 text-xs font-black text-cyan-950 shadow-2xs">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Eligible for Ceremony</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Water Baptism Milestone Studio Card */}
              <div className="p-5 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 text-white rounded-2xl border border-indigo-800 shadow-md space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300">
                      <Droplets className="w-5 h-5 fill-cyan-300" />
                    </span>
                    <div>
                      <h3 className="font-black text-sm text-amber-300">
                        Water Baptism Ceremony Milestone
                      </h3>
                      <p className="text-[11px] text-indigo-200">
                        Spiritual sacrament and ceremony milestones recording
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {baptismSuccessMessage && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-bounce shadow-2xs">
                        <Check className="w-3 h-3" />
                        <span>{baptismSuccessMessage}</span>
                      </span>
                    )}

                    {canEditBaptism && !isEditingBaptism ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingBaptism(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-amber-300 hover:text-amber-200 font-black text-xs border border-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-300" />
                        <span>Edit / Update Status</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {!isEditingBaptism ? (
                  /* VIEW MODE */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="bg-indigo-900/60 p-3.5 rounded-xl border border-indigo-800/80 space-y-1.5">
                      <span className="text-[10px] text-indigo-300 block font-bold uppercase tracking-wider">
                        Current Baptism Status
                      </span>
                      <div className="flex items-center gap-2 pt-0.5">
                        {baptismForm.baptism_status === "candidate" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-300 bg-cyan-950/80 px-3 py-1 rounded-lg border border-cyan-500/50 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            <span>🌊 Candidate for Ceremony</span>
                          </span>
                        ) : baptismForm.baptism_status === "scheduled" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300 bg-amber-950/80 px-3 py-1 rounded-lg border border-amber-500/50 shadow-2xs">
                            <span>📅 Scheduled for Ceremony</span>
                          </span>
                        ) : (baptismForm.is_baptized || baptismForm.baptism_status === "baptized") ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-lg border border-emerald-500/50 shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>💧 Water Baptized</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-700 shadow-2xs">
                            <span>⚪ Not Yet Baptized</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-indigo-900/60 p-3.5 rounded-xl border border-indigo-800/80 space-y-1.5">
                      <span className="text-[10px] text-indigo-300 block font-bold uppercase tracking-wider">
                        Officiating Minister / Ceremony Notes
                      </span>
                      <p className="text-xs font-bold text-indigo-100 pt-0.5">
                        {baptismForm.baptism_notes || <span className="text-indigo-400 italic font-normal">No minister / ceremony notes recorded yet.</span>}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div className="space-y-3.5 pt-1">
                    <div className="space-y-2">
                      <label className="font-bold text-indigo-200 text-[11px] block">
                        Select Baptism Ceremony Status:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "not_baptized", label: "Not Yet Baptized", isBaptized: false },
                          { id: "candidate", label: "Candidate for Ceremony", isBaptized: false, isAlert: true },
                          { id: "scheduled", label: "Scheduled for Ceremony", isBaptized: false, isAlert: true },
                          { id: "baptized", label: "Baptized", isBaptized: true }
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setBaptismForm(prev => ({
                              ...prev,
                              baptism_status: item.id,
                              is_baptized: item.isBaptized
                            }))}
                            className={`py-2 px-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                              baptismForm.baptism_status === item.id
                                ? item.isAlert
                                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-cyan-300 shadow-md scale-[1.02]"
                                  : item.isBaptized
                                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-400 shadow-md scale-[1.02]"
                                    : "bg-indigo-700 text-white border-indigo-400 shadow-xs"
                                : "bg-indigo-900/60 text-indigo-200 border-indigo-700/60 hover:bg-indigo-800/80"
                            }`}
                          >
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-indigo-200 text-[11px] block mb-1">
                        Officiating Minister / Ceremony Notes:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pastor Juan Dela Cruz • DPC Baptism Service"
                        value={baptismForm.baptism_notes}
                        onChange={(e) => setBaptismForm(prev => ({ ...prev, baptism_notes: e.target.value }))}
                        className="w-full bg-white text-indigo-950 p-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:border-cyan-400 font-bold text-xs"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSavingBaptism}
                        onClick={() => setIsEditingBaptism(false)}
                        className="px-4 py-2 rounded-xl bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 font-bold text-xs border border-indigo-700 cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingBaptism}
                        onClick={handleSaveBaptism}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingBaptism ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-indigo-950" />
                            <span>Save Status</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT HISTORY */}
          {!isInitialLoading && !error && activeTab === "audit" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo" />
                  <span>Audit Trail Logs ({attendanceLogs.length})</span>
                </div>
                <span className="text-[11px] text-stone-400">
                  Detailed check-in and membership audit logs
                </span>
              </div>

              {attendanceLogs.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-xs font-bold">No audit trail records found in this timeframe.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-black text-stone-500 uppercase tracking-wider sticky top-0">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Context / Group</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Recorded Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {attendanceLogs.map((log, i) => (
                          <tr key={i} className="hover:bg-stone-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-charcoal">{log.logDate}</td>
                            <td className="py-2.5 px-4">
                              {log.logType === "sunday_service" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo border border-indigo-100">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                  <span>Sunday</span>
                                </span>
                              )}
                              {log.logType === "bible_study" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <HeartHandshake className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Bible Study</span>
                                </span>
                              )}
                              {log.logType === "event" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                                  <PartyPopper className="w-2.5 h-2.5 text-purple-600" />
                                  <span>Special Event</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-stone-600">
                              {log.logType === "bible_study" && (log.groupName || "-")}
                              {log.logType === "event" && (log.eventName || "Event")}
                              {log.logType === "sunday_service" && "Sunday Worship Service"}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {log.status === "present" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Present</span>
                                </span>
                              )}
                              {log.status === "absent" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                  <XCircle className="w-2.5 h-2.5" />
                                  <span>Absent</span>
                                </span>
                              )}
                              {log.status === "excused" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Excused</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right text-stone-400 text-[11px]">
                              {log.recordedAt ? new Date(log.recordedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-500 font-medium">
            Daet Presbyterian Church Management System • Attendance Intelligence
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
