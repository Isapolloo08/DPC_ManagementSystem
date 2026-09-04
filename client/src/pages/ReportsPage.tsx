import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { DashboardMetrics, BirthdaySummary } from "../types";
import { BarChart3, TrendingUp, Users, Heart, UserCheck, Calendar, Cake, Gift, PartyPopper, BookOpen } from "lucide-react";

export const ReportsPage: React.FC = () => {
  const { user, selectedMinistryId } = useAuth();
  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0 
    ? user.ministries[0].id 
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);
  const coordinatorMinistryName = user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth";
  const activeScope = coordinatorMinistryId ?? selectedMinistryId ?? undefined;

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [birthdaySummary, setBirthdaySummary] = useState<BirthdaySummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [selectedMinistryId, coordinatorMinistryId]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [m, t, b] = await Promise.all([
        api.getDashboardMetrics(activeScope),
        api.getAttendanceTrends({ ministry_id: activeScope }),
        api.getBirthdays({ ministry_id: activeScope, timeframe: "all" })
      ]);
      setMetrics(m);
      setTrends(t);
      setBirthdaySummary(b);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayedBreakdown = coordinatorMinistryId 
    ? (metrics?.ministry_breakdown?.filter(m => m.id === coordinatorMinistryId) || [])
    : (metrics?.ministry_breakdown || []);

  const scopedMemberCount = coordinatorMinistryId 
    ? (metrics?.ministry_breakdown?.find(m => m.id === coordinatorMinistryId)?.member_count ?? metrics?.metrics.total_active_members ?? "...")
    : (metrics?.metrics.total_active_members ?? "...");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-indigo-500/5 via-sky-500/5 to-transparent rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl lg:text-3xl font-black text-indigo tracking-tight">
              Reporting & Growth Analytics
            </h1>
            {coordinatorMinistryId && (
              <span className="text-xs bg-indigo-50 text-indigo border border-indigo-200 px-3 py-1 rounded-full font-black">
                {coordinatorMinistryName} Scope
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed font-medium">
            {coordinatorMinistryId 
              ? `Sunday attendance trends, demographic distribution, and growth indicators for ${coordinatorMinistryName} Ministry.`
              : "Consolidated Sunday attendance trends, ministry demographic distribution, and discipleship growth indicators."}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-charcoal/70">
              {coordinatorMinistryId ? `${coordinatorMinistryName} Disciples` : "Total Active Disciples"}
            </span>
            <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo border border-indigo-100/80"><Users className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-indigo tracking-tight">{scopedMemberCount}</div>
          <div className="text-[11px] text-emerald-700 font-bold mt-1">
            {coordinatorMinistryId ? `${coordinatorMinistryName} Ministry (Designated Scope)` : "Across 7 Core Ministries"}
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-charcoal/70">Discipleship Engagement</span>
            <span className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100/80"><Users className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-emerald-900 tracking-tight">94.2%</div>
          <div className="text-[11px] text-emerald-700 font-bold mt-1">Active ministry participation</div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-charcoal/70">Households Enrolled</span>
            <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100/80"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-amber-950 tracking-tight">{metrics?.metrics.total_households ?? "..."}</div>
          <div className="text-[11px] text-amber-800 font-bold mt-1">Active family networks</div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-charcoal/70">Discipleship Life Groups</span>
            <span className="p-2.5 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100/80"><BookOpen className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-sky-950 tracking-tight">
            {coordinatorMinistryId ? "Scoped" : "10 Groups"}
          </div>
          <div className="text-[11px] text-sky-800 font-bold mt-1">Weekly Small Groups</div>
        </div>
      </div>

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
  );
};
