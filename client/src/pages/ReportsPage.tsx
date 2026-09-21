import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { DashboardMetrics, BirthdaySummary, GrowthInsightsData } from "../types";
import { ReportsPageSkeleton } from "../components/common/SkeletonLoader";
import { useSocketEvent } from "../socket";
import {
  BarChart3, TrendingUp, Users, Heart, UserCheck, Calendar,
  Cake, Gift, PartyPopper, BookOpen, Droplets, ArrowUpRight,
  ShieldCheck, CheckCircle2, Clock, MapPin, Printer, RefreshCw,
  Sparkles, Layers, Activity, ChevronRight, Award, Compass, HelpCircle
} from "lucide-react";

export const ReportsPage: React.FC = () => {
  const { user, selectedMinistryId } = useAuth();
  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0 
    ? user.ministries[0].id 
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);
  const coordinatorMinistryName = user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth";
  const activeScope = coordinatorMinistryId ?? selectedMinistryId ?? undefined;

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"growth" | "demographics">("growth");
  const [timeframe, setTimeframe] = useState<"3m" | "6m" | "12m" | "ytd">("6m");

  // Data States
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [growthData, setGrowthData] = useState<GrowthInsightsData | null>(null);
  const [birthdaySummary, setBirthdaySummary] = useState<BirthdaySummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadReports();
  }, [selectedMinistryId, coordinatorMinistryId, timeframe]);

  // Real-time synchronization
  useSocketEvent("attendance:changed", () => loadReports(true));
  useSocketEvent("members:changed", () => loadReports(true));
  useSocketEvent("ministries:changed", () => loadReports(true));
  useSocketEvent("groups:changed", () => loadReports(true));
  useSocketEvent("finance:changed", () => loadReports(true));

  const loadReports = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const [m, g, b] = await Promise.all([
        api.getDashboardMetrics(activeScope),
        api.getGrowthInsights({ ministry_id: activeScope, timeframe }),
        api.getBirthdays({ ministry_id: activeScope, timeframe: "all" })
      ]);
      setMetrics(m);
      setGrowthData(g);
      setBirthdaySummary(b);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const displayedBreakdown = coordinatorMinistryId 
    ? (metrics?.ministry_breakdown?.filter(m => m.id === coordinatorMinistryId) || [])
    : (metrics?.ministry_breakdown || []);

  const scopedMemberCount = coordinatorMinistryId 
    ? (metrics?.ministry_breakdown?.find(m => m.id === coordinatorMinistryId)?.member_count ?? metrics?.metrics.total_active_members ?? "...")
    : (metrics?.metrics.total_active_members ?? "...");

  const handlePrintReport = () => {
    window.print();
  };

  // Derived baptism chart calculations
  const maxBaptisms = useMemo(() => {
    if (!growthData?.baptisms || growthData.baptisms.length === 0) return 5;
    return Math.max(5, ...growthData.baptisms.map(b => b.count));
  }, [growthData?.baptisms]);

  // Derived attendance chart calculations
  const maxAttendance = useMemo(() => {
    if (!growthData?.attendance_trends || growthData.attendance_trends.length === 0) return 50;
    return Math.max(50, ...growthData.attendance_trends.map(a => a.total));
  }, [growthData?.attendance_trends]);

  if (loading && !metrics && !growthData) {
    return <ReportsPageSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 lg:p-8 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <Activity className="w-3.5 h-3.5 text-amber-300" />
              <span>{coordinatorMinistryId ? `${coordinatorMinistryName} Scope` : "Leadership Intelligence"}</span>
            </div>
            {isRefreshing && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Live Syncing...
              </span>
            )}
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
            Ministry Health & Growth Insights
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed font-medium">
            {coordinatorMinistryId 
              ? `Water baptism trajectory, retention metrics, small group health, and Sunday attendance trends for ${coordinatorMinistryName} Ministry.`
              : "Executive analytics dashboard with month-over-month baptism counts, discipleship ratio, new member retention funnel, and Sunday service momentum."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 flex items-center gap-2 flex-wrap shrink-0">
          {/* Timeframe Selector */}
          <div className="bg-black/40 backdrop-blur-md p-1 rounded-2xl border border-white/10 flex items-center gap-1 text-xs font-bold">
            {[
              { id: "3m", label: "3 Mo" },
              { id: "6m", label: "6 Mo" },
              { id: "12m", label: "12 Mo" },
              { id: "ytd", label: "YTD" }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id as any)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  timeframe === t.id
                    ? "bg-amber-400 text-slate-950 font-black shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Print / Export Button */}
          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer backdrop-blur-md"
            title="Print Executive Summary for Leadership Meeting"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Print Report</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2 print:hidden overflow-x-auto">
        <button
          onClick={() => setActiveTab("growth")}
          className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "growth"
              ? "bg-indigo text-white shadow-md shadow-indigo/20"
              : "bg-white text-charcoal/70 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-amber-300" />
          <span>Growth Insights & Vitality</span>
        </button>

        <button
          onClick={() => setActiveTab("demographics")}
          className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "demographics"
              ? "bg-indigo text-white shadow-md shadow-indigo/20"
              : "bg-white text-charcoal/70 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Cake className="w-4 h-4 text-rose-400" />
          <span>Demographics & Birthdays</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GROWTH INSIGHTS & VITALITY SCORECARD */}
      {/* ========================================================================= */}
      {activeTab === "growth" && (
        <div className="space-y-6">
          {/* 1. Executive Vitality Scorecard (4 KPI Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Discipleship Ratio */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-charcoal/70">Discipleship Ratio</span>
                <span className="p-2 rounded-2xl bg-indigo-50 text-indigo border border-indigo-100/80">
                  <BookOpen className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-indigo tracking-tight">
                  {growthData?.summary.discipleship_ratio ?? 0}%
                </div>
                <span className="text-[11px] font-bold text-charcoal/50">in Small Groups</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-indigo rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, growthData?.summary.discipleship_ratio || 0)}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-charcoal/60 font-bold mt-2 flex items-center justify-between">
                <span>{growthData?.summary.disciples_in_groups || 0} of {growthData?.summary.total_active_members || 0} Disciples</span>
                <span className="text-emerald-600">Goal: ≥ 60%</span>
              </div>
            </div>

            {/* Card 2: New Member Retention Rate */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-charcoal/70">New Member Retention</span>
                <span className="p-2 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100/80">
                  <UserCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-emerald-900 tracking-tight">
                  {growthData?.summary.retention_rate ?? 0}%
                </div>
                <span className="text-[11px] font-bold text-emerald-700">
                  {(growthData?.summary.retention_rate || 0) >= 80 ? "Healthy 🟢" : "Stable 🟡"}
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, growthData?.summary.retention_rate || 0)}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-charcoal/60 font-bold mt-2 flex items-center justify-between">
                <span>{growthData?.summary.new_members_attended || 0} of {growthData?.summary.total_new_members || 0} New Joined</span>
                <span className="text-emerald-700">Active in {timeframe.toUpperCase()}</span>
              </div>
            </div>

            {/* Card 3: Water Baptism Momentum */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-charcoal/70">Water Baptisms</span>
                <span className="p-2 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100/80">
                  <Droplets className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-sky-950 tracking-tight">
                  {growthData?.summary.total_baptisms_period ?? 0}
                </div>
                <span className="text-[11px] font-bold text-sky-700">Baptized in Period</span>
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[10px] font-bold bg-sky-100 text-sky-900 px-2 py-0.5 rounded-md">
                  {growthData?.baptisms.reduce((sum, b) => sum + b.male_count, 0) || 0} Brothers
                </span>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md">
                  {growthData?.baptisms.reduce((sum, b) => sum + b.female_count, 0) || 0} Sisters
                </span>
              </div>
              <div className="text-[10px] text-sky-800 font-bold mt-2">
                Across {growthData?.baptisms.length || 0} recorded months
              </div>
            </div>

            {/* Card 4: Average Weekly Sunday Attendance */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-charcoal/70">Avg Weekly Attendance</span>
                <span className="p-2 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100/80">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-amber-950 tracking-tight">
                  {growthData?.summary.avg_weekly_attendance ?? 0}
                </div>
                <span className="text-[11px] font-bold text-amber-800">Weekly Average</span>
              </div>
              <div className="text-[11px] text-charcoal/70 font-bold mt-2.5 flex items-center justify-between">
                <span>Peak Sunday: <strong>{growthData?.summary.peak_attendance ?? 0}</strong></span>
                <span className="text-[10px] bg-amber-100 text-amber-950 px-2 py-0.5 rounded-full font-black">
                  {growthData?.attendance_trends.length || 0} Services
                </span>
              </div>
              <div className="text-[10px] text-charcoal/50 mt-1">
                Measured across recorded check-in logs
              </div>
            </div>
          </div>

          {/* 2. Month-over-Month Baptism Counts & Trajectory */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
                    <Droplets className="w-5 h-5 text-sky-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-charcoal">
                      Month-over-Month Water Baptism Trajectory
                    </h2>
                    <p className="text-xs text-charcoal/60">
                      Tracking public declarations of faith and baptismal growth across ministries.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-950 border border-sky-200 text-xs font-black">
                  <Award className="w-3.5 h-3.5 text-sky-600" />
                  <span>{growthData?.summary.total_baptisms_period || 0} Baptisms Total</span>
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            {growthData?.baptisms && growthData.baptisms.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {growthData.baptisms.map((b, idx) => {
                    const heightPercent = Math.max(12, Math.round((b.count / maxBaptisms) * 100));
                    return (
                      <div
                        key={idx}
                        className="bg-ivory-light p-4 rounded-2xl border border-gray-200/80 hover:border-sky-300 transition-all flex flex-col justify-between group hover:shadow-md"
                      >
                        <div className="text-center mb-2">
                          <span className="text-[10px] font-bold text-charcoal/50 uppercase block">
                            {b.month_label}
                          </span>
                          <span className="text-2xl font-black text-sky-950 mt-0.5 block">
                            {b.count}
                          </span>
                        </div>

                        {/* Bar Graphic */}
                        <div className="h-28 w-full bg-gray-100 rounded-xl flex items-end justify-center p-1 relative overflow-hidden">
                          <div
                            className="w-full bg-gradient-to-t from-sky-600 to-sky-400 rounded-lg transition-all duration-500 group-hover:from-sky-500 group-hover:to-teal-400 shadow-2xs"
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                        </div>

                        {/* Brother / Sister Breakdown */}
                        <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px] font-bold text-charcoal/70">
                          <span className="text-sky-800">♂ {b.male_count}</span>
                          <span className="text-rose-700">♀ {b.female_count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-ivory-light rounded-2xl border border-dashed border-gray-300 space-y-2">
                <Droplets className="w-8 h-8 text-sky-400 mx-auto" />
                <h4 className="font-bold text-xs text-charcoal">No Water Baptism Records in this Timeframe</h4>
                <p className="text-[11px] text-charcoal/50 max-w-sm mx-auto">
                  Baptism dates logged on member profiles will automatically populate this trajectory chart.
                </p>
              </div>
            )}
          </div>

          {/* 3. Average Weekly Sunday Attendance Trends & Ministry Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Attendance Graph */}
            <div className="lg:col-span-2 bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo" />
                    <span>Weekly Sunday Service Attendance Momentum</span>
                  </h2>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    Week-by-week attendee check-in trends and Sunday consistency.
                  </p>
                </div>
                <span className="text-xs font-black bg-indigo-50 text-indigo px-3 py-1 rounded-full border border-indigo-100">
                  Avg: {growthData?.summary.avg_weekly_attendance || 0} / Sunday
                </span>
              </div>

              {/* Attendance Visual Bars */}
              {growthData?.attendance_trends && growthData.attendance_trends.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <div className="h-44 flex items-end gap-2 sm:gap-3 overflow-x-auto pb-2 pt-4 px-1">
                    {growthData.attendance_trends.map((att, idx) => {
                      const barHeight = Math.max(10, Math.round((att.total / maxAttendance) * 100));
                      return (
                        <div
                          key={idx}
                          className="flex-1 min-w-[36px] max-w-[56px] flex flex-col items-center gap-1 group h-full justify-end"
                        >
                          {/* Value on Hover */}
                          <span className="text-[10px] font-black text-indigo opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {att.total}
                          </span>
                          
                          {/* Bar */}
                          <div className="w-full bg-gray-100 rounded-t-xl h-32 flex items-end p-0.5 overflow-hidden">
                            <div
                              className="w-full bg-gradient-to-t from-indigo-700 via-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:from-indigo-800 group-hover:to-amber-400 shadow-2xs"
                              style={{ height: `${barHeight}%` }}
                            ></div>
                          </div>

                          {/* Date Label */}
                          <span className="text-[9px] font-bold text-charcoal/60 group-hover:text-charcoal whitespace-nowrap mt-1">
                            {att.date_label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-charcoal/60 pt-2 border-t border-gray-100 font-semibold">
                    <span>Showing {growthData.attendance_trends.length} Sunday service dates</span>
                    <span className="text-indigo font-bold">Peak Service: {growthData.summary.peak_attendance} attendees</span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-ivory-light rounded-2xl border border-dashed border-gray-300 space-y-1">
                  <BarChart3 className="w-6 h-6 text-charcoal/40 mx-auto" />
                  <p className="text-xs font-bold text-charcoal/60">No Attendance Check-in Logs in this Window</p>
                </div>
              )}
            </div>

            {/* Right 1 Col: New Member Assimilation & Retention Funnel */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-charcoal flex items-center gap-2">
                  <Compass className="w-5 h-5 text-emerald-700" />
                  <span>Assimilation Funnel</span>
                </h3>
                <p className="text-xs text-charcoal/60 mt-0.5">
                  Conversion of new members into active disciples.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Funnel Step 1: New Disciples Joined */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-charcoal/70">1. Newly Enrolled</span>
                    <span className="text-indigo font-black">{growthData?.summary.total_new_members || 0} Members (100%)</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo w-full rounded-full"></div>
                  </div>
                </div>

                {/* Funnel Step 2: Attended Sunday Service */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-charcoal/70">2. Attended Service</span>
                    <span className="text-emerald-800 font-black">
                      {growthData?.summary.new_members_attended || 0} ({
                        growthData?.summary.total_new_members
                          ? Math.round(((growthData.summary.new_members_attended) / growthData.summary.total_new_members) * 100)
                          : 0
                      }%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          growthData?.summary.total_new_members
                            ? Math.round(((growthData.summary.new_members_attended) / growthData.summary.total_new_members) * 100)
                            : 0
                        }%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Funnel Step 3: Joined Small Group */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-charcoal/70">3. In Bible Study</span>
                    <span className="text-amber-900 font-black">
                      {growthData?.summary.new_members_in_groups || 0} ({
                        growthData?.summary.total_new_members
                          ? Math.round(((growthData.summary.new_members_in_groups) / growthData.summary.total_new_members) * 100)
                          : 0
                      }%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          growthData?.summary.total_new_members
                            ? Math.round(((growthData.summary.new_members_in_groups) / growthData.summary.total_new_members) * 100)
                            : 0
                        }%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Funnel Step 4: Water Baptized */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-charcoal/70">4. Water Baptized</span>
                    <span className="text-sky-900 font-black">
                      {growthData?.summary.new_members_baptized || 0} ({
                        growthData?.summary.total_new_members
                          ? Math.round(((growthData.summary.new_members_baptized) / growthData.summary.total_new_members) * 100)
                          : 0
                      }%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          growthData?.summary.total_new_members
                            ? Math.round(((growthData.summary.new_members_baptized) / growthData.summary.total_new_members) * 100)
                            : 0
                        }%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Small Groups & Discipleship Capacity Grid */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo" />
                  <span>Small Groups Health & Capacity Utilization</span>
                </h2>
                <p className="text-xs text-charcoal/60 mt-0.5">
                  Roster health, curriculum pacing, and capacity metrics for weekly discipleship groups.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo font-black border border-indigo-100">
                  {growthData?.summary.total_groups || 0} Active Groups
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 font-black border border-emerald-200">
                  {growthData?.summary.capacity_utilization || 0}% Capacity Filled
                </span>
              </div>
            </div>

            {/* Groups Grid */}
            {growthData?.groups_list && growthData.groups_list.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {growthData.groups_list.map((g) => {
                  const util = g.utilization_rate;
                  return (
                    <div
                      key={g.id}
                      className="p-4 rounded-2xl bg-ivory-light border border-gray-200/90 space-y-3 hover:border-indigo-300 transition-all shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-charcoal leading-snug">{g.name}</h4>
                          <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">
                            📖 {g.curriculum || "Scripture Study"}
                          </span>
                        </div>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo border border-indigo-200 uppercase whitespace-nowrap">
                          {g.current_chapter || "Chapter 1"}
                        </span>
                      </div>

                      {/* Capacity Bar with user color rule: Green when full, yellow when mid, red when low */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-charcoal/70 mb-1">
                          <span>Roster: {g.enrolled_count} of {g.max_capacity} Enrolled</span>
                          <span>{util}% Full</span>
                        </div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              util >= 80 ? "bg-emerald-500" : util >= 40 ? "bg-amber" : "bg-rose"
                            }`}
                            style={{ width: `${util}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px] text-charcoal/60 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo" />
                          {g.meeting_day} ({g.meeting_time})
                        </span>
                        <span className="font-bold text-charcoal/80">{g.progress_stage || "Active"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-ivory-light rounded-2xl border border-dashed border-gray-300">
                <BookOpen className="w-6 h-6 text-charcoal/40 mx-auto mb-1" />
                <p className="text-xs font-bold text-charcoal/60">No Active Small Groups Logged</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEMOGRAPHICS & ANNUAL BIRTHDAYS */}
      {/* ========================================================================= */}
      {activeTab === "demographics" && (
        <div className="space-y-6">
          {/* Ministry Distribution Breakdown Bar Graphic */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo" />
                  <span>
                    {coordinatorMinistryId 
                      ? `${coordinatorMinistryName} Ministry Demographic & Capacity` 
                      : "Ministry Demographic & Capacity Distribution"}
                  </span>
                </h2>
                <p className="text-xs text-charcoal/60 mt-0.5">
                  {coordinatorMinistryId 
                    ? `Active disciples and capacity strictly for ${coordinatorMinistryName} Ministry`
                    : "Relative distribution of active disciples across the 7 age bracket ministries"}
                </p>
              </div>
              {coordinatorMinistryId && (
                <span className="text-[10px] bg-indigo-50 text-indigo border border-indigo-200 px-2.5 py-1 rounded-full font-black">
                  Designated Scope
                </span>
              )}
            </div>

            <div className="space-y-4 pt-2">
              {displayedBreakdown.map((m) => {
                const total = coordinatorMinistryId 
                  ? (m.member_count || 1) 
                  : (metrics?.metrics.total_active_members || 1);
                const pct = coordinatorMinistryId ? 100 : Math.round((m.member_count / total) * 100);

                return (
                  <div key={m.id} className="space-y-1.5 p-3 rounded-2xl hover:bg-indigo-50/30 transition-colors">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full shadow-2xs" style={{ backgroundColor: m.color }}></span>
                        <span className="text-charcoal font-black">{m.name} Ministry</span>
                      </div>
                      <span className="text-indigo font-black">{m.member_count} Members ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-2xs"
                        style={{ width: `${Math.max(5, pct)}%`, backgroundColor: m.color }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Birthday Distribution & Pastoral Calendar */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                  <Cake className="w-5 h-5 text-rose-500" />
                  <span>Annual Birthday & Milestone Distribution</span>
                </h2>
                <p className="text-xs text-charcoal/60 mt-0.5">
                  Monthly breakdown of member birthdays for pastoral care and celebratory events.
                </p>
              </div>
              {birthdaySummary && (
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-950 font-black px-3 py-1.5 rounded-2xl border border-amber-200 shadow-2xs">
                    <Cake className="w-3.5 h-3.5 text-amber-700" />
                    <span>{birthdaySummary.counts.this_month} This Month</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-950 font-black px-3 py-1.5 rounded-2xl border border-emerald-200 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{birthdaySummary.counts.next_30_days} Next 30 Days</span>
                  </span>
                </div>
              )}
            </div>

            {/* 12-Month Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {birthdaySummary?.monthly_distribution.map((m) => {
                const isCurrentMonth = new Date().getMonth() + 1 === m.month;
                const isSelected = selectedMonth === m.month;

                return (
                  <div
                    key={m.month}
                    onClick={() => setSelectedMonth(isSelected ? null : m.month)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 border-amber-500 shadow-md ring-2 ring-amber-400/40"
                        : isCurrentMonth
                        ? "bg-amber-50/80 border-amber-200 hover:border-amber-300 shadow-2xs"
                        : "bg-indigo-50/30 border-indigo-100/70 hover:border-indigo-200 hover:bg-indigo-50/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          isSelected ? "text-indigo-950/80" : isCurrentMonth ? "text-amber-800" : "text-charcoal/50"
                        }`}>
                          Month {m.month}
                        </span>
                        {isCurrentMonth && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            isSelected ? "bg-indigo-950 text-white" : "bg-amber-500 text-white"
                          }`}>
                            CURRENT
                          </span>
                        )}
                      </div>
                      <h4 className={`text-xs font-black ${isSelected ? "text-indigo-950" : "text-charcoal"}`}>
                        {m.month_name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                      <span className={`font-bold ${isSelected ? "text-indigo-950/80" : "text-charcoal/60"}`}>Birthdays:</span>
                      <span className={`font-black text-sm px-2.5 py-0.5 rounded-full ${
                        isSelected ? "bg-indigo-950/15 text-indigo-950" : "bg-indigo-50 text-indigo border border-indigo-100"
                      }`}>
                        {m.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Month Celebrants List Drawer/Panel */}
            {selectedMonth !== null && (
              <div className="mt-4 p-5 rounded-3xl bg-amber-50/40 border border-amber-200/80 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="w-4 h-4 text-amber-600" />
                    <h4 className="font-black text-xs text-charcoal">
                      Celebrants in {birthdaySummary?.monthly_distribution.find(m => m.month === selectedMonth)?.month_name} ({
                        birthdaySummary?.monthly_distribution.find(m => m.month === selectedMonth)?.count
                      } Members)
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedMonth(null)}
                    className="text-[11px] text-charcoal/60 hover:text-charcoal underline font-bold cursor-pointer"
                  >
                    Close list
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {birthdaySummary?.monthly_distribution
                    .find(m => m.month === selectedMonth)
                    ?.celebrants.map(c => (
                      <div key={c.id} className="bg-white p-3 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-charcoal block">{c.first_name} {c.last_name}</span>
                          <span className="text-[10px] text-charcoal/50 font-medium">{c.ministry_name || "General"}</span>
                        </div>
                        <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-xl border border-amber-200">
                          Day {c.birth_day}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

