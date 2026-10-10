import { FilterPanel } from "../components/common/FilterPanel";
import { StatCard } from "../components/common/StatCard";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/common/Button";
import { BookOpen as UIBookOpen, CircleCheck as UICircleCheck, Clock as UIClock, Mars as UIMars, Venus as UIVenus } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { DashboardMetrics, BirthdaySummary, GrowthInsightsData } from "../types";
import { ReportsPageSkeleton } from "../components/common/SkeletonLoader";
import { useSocketEvent } from "../socket";
import {
  BarChart3, TrendingUp, Users, Heart, UserCheck, Calendar,
  Cake, Gift, PartyPopper, BookOpen, Droplets, ArrowUpRight,
  ShieldCheck, CheckCircle2, Clock, MapPin, Printer, RefreshCw,
  Layers, Activity, ChevronRight, Award, Compass, HelpCircle
} from "lucide-react";

export const ReportsPage: React.FC = () => {
  const { user, selectedMinistryId } = useAuth();
  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0
    ? user.ministries[0].id
    : (user?.role_name !== "Admin" && user?.role_name !== "Pastor" && user?.role_name !== "IT Admin" && selectedMinistryId ? selectedMinistryId : null);
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

 const loadReports = async (isSilent = false) => {
    guideData.clearError();
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
      guideData.reportError(err);
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

  const guideData = useGuideDataState("reports", { loading, count: metrics || growthData ? 1 : 0, retry: loadReports });

  if (loading && !metrics && !growthData) {
    return <ReportsPageSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Header Banner */}
      <PageHeader icon={<TrendingUp />} title={<>Ministry Health & Growth Insights</>}
        meta={<>{coordinatorMinistryId ? `${coordinatorMinistryName} Scope` : "Church-wide insights"}{isRefreshing && <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin" /> Updating...</span>}</>}
        description={<>{coordinatorMinistryId
          ? `Water baptism trajectory, retention metrics, small group health, and Sunday attendance trends for ${coordinatorMinistryName} Ministry.`
          : "Executive analytics dashboard with month-over-month baptism counts, discipleship ratio, new member retention funnel, and Sunday service momentum."}</>}
        className="print:hidden"
        actions={<><div className="relative z-10 flex items-center gap-2 flex-wrap shrink-0">
          {/* Timeframe Selector */}
          <FilterPanel title="Report period" summary={timeframe.toUpperCase()} className="print:hidden">
            <div data-guide="reports-period" className="filter-panel-layout bg-stone-100  p-1 rounded-2xl border border-stone-200 flex items-center gap-1 text-xs font-medium">
            {[
              { id: "3m", label: "3 Mo" },
              { id: "6m", label: "6 Mo" },
              { id: "12m", label: "12 Mo" },
              { id: "ytd", label: "YTD" }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id as any)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${timeframe === t.id
                  ? "bg-amber-400 text-slate-950 font-medium shadow-sm"
                  : "text-muted hover:text-charcoal hover:bg-stone-50"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          </FilterPanel>

          {/* Print / Export Button */}
          <Button data-guide="reports-print" onClick={handlePrintReport} title="Print Executive Summary for Leadership Meeting" variant="secondary">
            <Printer className="w-3.5 h-3.5 " />
            <span className="hidden sm:inline">Print Report</span>
          </Button>
        </div></>} />

      {/* Navigation Tabs */}
      <div className="page-tabs flex items-center gap-2 border-b border-gray-200/80 pb-2 print:hidden overflow-x-auto">
        <button data-guide="reports-growth"
          onClick={() => setActiveTab("growth")}
          className={`px-4 py-2 rounded-2xl font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${activeTab === "growth"
            ? "bg-indigo text-white shadow-md shadow-indigo/20"
            : "bg-white text-charcoal/70 hover:bg-gray-100 border border-gray-200"
            }`}
         aria-pressed={activeTab === "growth"}>
          <TrendingUp className="w-4 h-4 text-amber-300" />
          <span>Growth Insights & Vitality</span>
        </button>

        <button data-guide="reports-demographics"
          onClick={() => setActiveTab("demographics")}
          className={`px-4 py-2 rounded-2xl font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${activeTab === "demographics"
            ? "bg-indigo text-white shadow-md shadow-indigo/20"
            : "bg-white text-charcoal/70 hover:bg-gray-100 border border-gray-200"
            }`}
         aria-pressed={activeTab === "demographics"}>
          <Cake className="w-4 h-4 text-rose-400" />
          <span>Demographics & Birthdays</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GROWTH INSIGHTS & VITALITY SCORECARD */}
      {/* ========================================================================= */}
      {activeTab === "growth" && (
        <div className="space-y-6">
          {/* Ministry vitality summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Discipleship Ratio" value={(growthData?.summary.discipleship_ratio ?? 0) + "%"} icon={<BookOpen />} progress={growthData?.summary.discipleship_ratio ?? 0} description={<>{growthData?.summary.disciples_in_groups || 0} of {growthData?.summary.total_active_members || 0} Disciples · Goal: ≥ 60%</>} />
            <StatCard label="New Member Retention" value={(growthData?.summary.retention_rate ?? 0) + "%"} icon={<UserCheck />} tone="emerald" progress={growthData?.summary.retention_rate ?? 0} valueHint={(growthData?.summary.retention_rate || 0) >= 80 ? "Healthy" : "Stable"} description={<>{growthData?.summary.new_members_attended || 0} of {growthData?.summary.total_new_members || 0} New Joined · Active in {timeframe.toUpperCase()}</>} />
            <StatCard label="Baptisms" value={growthData?.summary.total_baptisms_period ?? 0} icon={<Droplets />} tone="sky" description={"Across " + (growthData?.baptisms.length || 0) + " recorded months"}>
              <div className="flex flex-wrap gap-2"><span>{growthData?.baptisms.reduce((sum, b) => sum + b.male_count, 0) || 0} Brothers</span><span>{growthData?.baptisms.reduce((sum, b) => sum + b.female_count, 0) || 0} Sisters</span></div>
            </StatCard>
            <StatCard label="Avg Weekly Attendance" value={growthData?.summary.avg_weekly_attendance ?? 0} icon={<TrendingUp />} tone="amber" description="Measured across recorded check-in logs">
              Peak Sunday: <strong>{growthData?.summary.peak_attendance ?? 0}</strong> · {growthData?.attendance_trends.length || 0} Services
            </StatCard>
          </div>

      {/* 2. Month-over-Month Baptism Counts & Trajectory */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
                    <Droplets className="w-5 h-5 text-sky-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-charcoal">
                      Month-over-Month Baptism Trajectory
                    </h2>
                    <p className="text-xs text-muted">
                      Tracking public declarations of faith and baptismal growth across ministries.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-950 border border-sky-200 text-xs font-medium">
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
                          <span className="text-[12px] font-medium text-muted uppercase block">
                            {b.month_label}
                          </span>
                          <span className="text-2xl font-medium text-sky-950 mt-0.5 block">
                            {b.count}
                          </span>
                        </div>

                        {/* Bar Graphic */}
                        <div className="h-28 w-full bg-gray-100 rounded-xl flex items-end justify-center p-1 relative overflow-hidden">
                          <div
                            className="w-full bg-sky-500 rounded-lg transition-all duration-500 group-hover:bg-sky-400 shadow-2xs"
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                        </div>

                        {/* Brother / Sister Breakdown */}
                        <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[12px] font-medium text-charcoal/70">
                          <span className="text-sky-800"><UIMars aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> {b.male_count}</span>
                          <span className="text-rose-700"><UIVenus aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> {b.female_count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-ivory-light rounded-2xl border border-dashed border-gray-300 space-y-2">
                <Droplets className="w-8 h-8 text-sky-400 mx-auto" />
                <h4 className="font-semibold text-xs text-charcoal">No Baptism Records in this Timeframe</h4>
                <p className="text-[12px] text-muted max-w-sm mx-auto">
                  Baptism dates logged on member profiles will automatically populate this trajectory chart.
                </p>
              </div>
            )}
          </div>

          {/* 3. Average Weekly Sunday Attendance Trends & Ministry Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Attendance Graph */}
            <div className="lg:col-span-2 bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-semibold text-charcoal flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo" />
                    <span>Weekly Sunday Service Attendance Momentum</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Week-by-week attendee check-in trends and Sunday consistency.
                  </p>
                </div>
                <span className="text-xs font-medium bg-indigo-50 text-indigo px-3 py-1 rounded-full border border-indigo-100">
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
                          <span className="text-[12px] font-medium text-indigo opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {att.total}
                          </span>

                          {/* Bar */}
                          <div className="w-full bg-gray-100 rounded-t-xl h-32 flex items-end p-0.5 overflow-hidden">
                            <div
                              className="w-full bg-indigo-600 rounded-t-lg transition-all duration-500 group-hover:bg-indigo-700 shadow-2xs"
                              style={{ height: `${barHeight}%` }}
                            ></div>
                          </div>

                          {/* Date Label */}
                          <span className="text-[12px] font-medium text-muted group-hover:text-charcoal whitespace-nowrap mt-1">
                            {att.date_label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-muted pt-2 border-t border-gray-100 font-medium">
                    <span>Showing {growthData.attendance_trends.length} Sunday service dates</span>
                    <span className="text-indigo font-medium">Peak Service: {growthData.summary.peak_attendance} attendees</span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-ivory-light rounded-2xl border border-dashed border-gray-300 space-y-1">
                  <BarChart3 className="w-6 h-6 text-muted mx-auto" />
                  <p className="text-xs font-medium text-muted">No Attendance Check-in Logs in this Window</p>
                </div>
              )}
            </div>

            {/* Right 1 Col: New Member Assimilation & Retention Funnel */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-semibold text-charcoal flex items-center gap-2">
                  <Compass className="w-5 h-5 text-emerald-700" />
                  <span>Assimilation Funnel</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Conversion of new members into active disciples.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Funnel Step 1: New Disciples Joined */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-charcoal/70">1. Newly Enrolled</span>
                    <span className="text-indigo font-medium">{growthData?.summary.total_new_members || 0} Members (100%)</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo w-full rounded-full"></div>
                  </div>
                </div>

                {/* Funnel Step 2: Attended Sunday Service */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-charcoal/70">2. Attended Service</span>
                    <span className="text-emerald-800 font-medium">
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
                        width: `${growthData?.summary.total_new_members
                          ? Math.round(((growthData.summary.new_members_attended) / growthData.summary.total_new_members) * 100)
                          : 0
                          }%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Funnel Step 3: Joined Small Group */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-charcoal/70">3. In Bible Study</span>
                    <span className="text-amber-900 font-medium">
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
                        width: `${growthData?.summary.total_new_members
                          ? Math.round(((growthData.summary.new_members_in_groups) / growthData.summary.total_new_members) * 100)
                          : 0
                          }%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Funnel Step 4: Water Baptized */}
                <div className="p-3 bg-ivory rounded-2xl border border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-charcoal/70">4. Water Baptized</span>
                    <span className="text-sky-900 font-medium">
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
                        width: `${growthData?.summary.total_new_members
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
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-charcoal flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo" />
                  <span>Small Groups Health & Capacity Utilization</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Roster health, curriculum pacing, and capacity metrics for weekly discipleship groups.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo font-medium border border-indigo-100">
                  {growthData?.summary.total_groups || 0} Active Groups
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 font-medium border border-emerald-200">
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
                          <h4 className="text-xs font-semibold text-charcoal leading-snug">{g.name}</h4>
                          <span className="text-[12px] text-indigo-700 font-medium block mt-0.5"><UIBookOpen aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> {g.curriculum || "Scripture Study"}
                          </span>
                        </div>
                        <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo border border-indigo-200 uppercase whitespace-nowrap">
                          {g.current_chapter || "Chapter 1"}
                        </span>
                      </div>

                      {/* Capacity Bar with user color rule: Green when full, yellow when mid, red when low */}
                      <div>
                        <div className="flex items-center justify-between text-[12px] font-medium text-charcoal/70 mb-1">
                          <span>Roster: {g.enrolled_count} of {g.max_capacity} Enrolled</span>
                          <span>{util}% Full</span>
                        </div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${util >= 80 ? "bg-emerald-500" : util >= 40 ? "bg-amber" : "bg-rose"
                              }`}
                            style={{ width: `${util}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[12px] text-muted font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo" />
                          {g.meeting_day} ({g.meeting_time})
                        </span>
                        <span className="font-medium text-charcoal/80">{g.progress_stage || "Active"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-ivory-light rounded-2xl border border-dashed border-gray-300">
                <BookOpen className="w-6 h-6 text-muted mx-auto mb-1" />
                <p className="text-xs font-medium text-muted">No Active Small Groups Logged</p>
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
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-charcoal flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo" />
                  <span>
                    {coordinatorMinistryId
                      ? `${coordinatorMinistryName} Ministry Demographic & Capacity`
                      : "Ministry Demographic & Capacity Distribution"}
                  </span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {coordinatorMinistryId
                    ? `Active disciples and capacity strictly for ${coordinatorMinistryName} Ministry`
                    : "Relative distribution of active disciples across the 7 age bracket ministries"}
                </p>
              </div>
              {coordinatorMinistryId && (
                <span className="text-[12px] bg-indigo-50 text-indigo border border-indigo-200 px-2.5 py-1 rounded-full font-medium">
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
                    <div className="flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full shadow-2xs" style={{ backgroundColor: m.color }}></span>
                        <span className="text-charcoal font-medium">{m.name} Ministry</span>
                      </div>
                      <span className="text-indigo font-medium">{m.member_count} Members ({pct}%)</span>
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
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-charcoal flex items-center gap-2">
                  <Cake className="w-5 h-5 text-rose-500" />
                  <span>Annual Birthday & Milestone Distribution</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Monthly breakdown of member birthdays for pastoral care and celebratory events.
                </p>
              </div>
              {birthdaySummary && (
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-950 font-medium px-3 py-1.5 rounded-2xl border border-amber-200 shadow-2xs">
                    <Cake className="w-3.5 h-3.5 text-amber-700" />
                    <span>{birthdaySummary.counts.this_month} This Month</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-950 font-medium px-3 py-1.5 rounded-2xl border border-emerald-200 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{birthdaySummary.counts.next_30_days} Next 30 Days</span>
                  </span>
                </div>
              )}
            </div>

            {/* 12-Month Grid */}
            <div data-guide="reports-birthday-month" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {birthdaySummary?.monthly_distribution.map((m) => {
                const isCurrentMonth = new Date().getMonth() + 1 === m.month;
                const isSelected = selectedMonth === m.month;

                return (
                  <div
                    key={m.month}
                    onClick={() => setSelectedMonth(isSelected ? null : m.month)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected
                      ? "bg-amber-400 text-indigo-950 border-amber-500 shadow-md ring-2 ring-amber-400/40"
                      : isCurrentMonth
                        ? "bg-amber-50/80 border-amber-200 hover:border-amber-300 shadow-2xs"
                        : "bg-indigo-50/30 border-indigo-100/70 hover:border-indigo-200 hover:bg-indigo-50/60"
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[12px] font-medium uppercase tracking-wider ${isSelected ? "text-indigo-950/80" : isCurrentMonth ? "text-amber-800" : "text-muted"
                          }`}>
                          Month {m.month}
                        </span>
                        {isCurrentMonth && (
                          <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${isSelected ? "bg-indigo-950 text-white" : "bg-amber-500 text-white"
                            }`}>
                            CURRENT
                          </span>
                        )}
                      </div>
                      <h4 className={`text-xs font-semibold ${isSelected ? "text-indigo-950" : "text-charcoal"}`}>
                        {m.month_name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                      <span className={`font-medium ${isSelected ? "text-indigo-950/80" : "text-muted"}`}>Birthdays:</span>
                      <span className={`font-medium text-sm px-2.5 py-0.5 rounded-full ${isSelected ? "bg-indigo-950/15 text-indigo-950" : "bg-indigo-50 text-indigo border border-indigo-100"
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
                    <h4 className="font-semibold text-xs text-charcoal">
                      Celebrants in {birthdaySummary?.monthly_distribution.find(m => m.month === selectedMonth)?.month_name} ({
                        birthdaySummary?.monthly_distribution.find(m => m.month === selectedMonth)?.count
                      } Members)
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedMonth(null)}
                    className="text-[12px] text-muted hover:text-charcoal underline font-medium cursor-pointer"
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
                          <span className="font-medium text-charcoal block">{c.first_name} {c.last_name}</span>
                          <span className="text-[12px] text-muted font-medium">{c.ministry_name || "General"}</span>
                        </div>
                        <span className="bg-amber-100 text-amber-950 text-[12px] font-medium px-2.5 py-1 rounded-xl border border-amber-200">
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
