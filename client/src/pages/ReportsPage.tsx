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
      <div>
        <h1 className="text-2xl font-bold text-charcoal flex items-center gap-2">
          <span>Reporting & Ministry Analytics</span>
          {coordinatorMinistryId && (
            <span className="text-xs bg-indigo-50 text-indigo border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
              {coordinatorMinistryName} Scope
            </span>
          )}
        </h1>
        <p className="text-xs text-charcoal/60 mt-0.5">
          {coordinatorMinistryId 
            ? `Sunday attendance trends, demographic distribution, and growth indicators for ${coordinatorMinistryName} Ministry.`
            : "Consolidated Sunday attendance trends, ministry distribution, and growth indicators."}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-charcoal/60">
              {coordinatorMinistryId ? `${coordinatorMinistryName} Disciples` : "Total Active Disciples"}
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo"><Users className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-charcoal">{scopedMemberCount}</div>
          <div className="text-[11px] text-sage-700 font-semibold mt-1">
            {coordinatorMinistryId ? `${coordinatorMinistryName} Ministry (Designated Scope)` : "Across 7 Core Ministries"}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-charcoal/60">Discipleship Engagement</span>
            <span className="p-2 rounded-xl bg-sage-50 text-sage-700"><Users className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-charcoal">94.2%</div>
          <div className="text-[11px] text-sage-700 font-semibold mt-1">Active ministry participation</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-charcoal/60">Households Enrolled</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-charcoal">{metrics?.metrics.total_households ?? "..."}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">Active family networks</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-charcoal/60">Discipleship Life Groups</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo"><BookOpen className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-black text-charcoal">
            {coordinatorMinistryId ? "Scoped" : "10 Groups"}
          </div>
          <div className="text-[11px] text-indigo font-semibold mt-1">Weekly Small Groups</div>
        </div>
      </div>

      {/* Ministry Distribution Breakdown Bar Graphic */}
      <div className="bg-white rounded-2xl p-6 border border-indigo-100/80 shadow-2xs">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo" />
            <span>
              {coordinatorMinistryId 
                ? `${coordinatorMinistryName} Ministry Demographic & Capacity` 
                : "Ministry Demographic & Capacity Distribution"}
            </span>
          </h2>
          {coordinatorMinistryId && (
            <span className="text-[10px] bg-indigo-50 text-indigo border border-indigo-200 px-2 py-0.5 rounded font-bold">
              Designated Scope
            </span>
          )}
        </div>
        <p className="text-xs text-charcoal/50 mb-6">
          {coordinatorMinistryId 
            ? `Active disciples and capacity strictly for ${coordinatorMinistryName} Ministry`
            : "Relative distribution of active disciples by age bracket"}
        </p>

        <div className="space-y-4">
          {displayedBreakdown.map((m) => {
            const total = coordinatorMinistryId 
              ? (m.member_count || 1) 
              : (metrics?.metrics.total_active_members || 1);
            const pct = coordinatorMinistryId ? 100 : Math.round((m.member_count / total) * 100);

            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }}></span>
                    <span className="text-charcoal">{m.name} Ministry</span>
                  </div>
                  <span className="text-indigo">{m.member_count} Members ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, pct)}%`, backgroundColor: m.color }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Birthday Distribution & Pastoral Calendar */}
      <div className="bg-white rounded-2xl p-6 border border-indigo-100/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
              <Cake className="w-5 h-5 text-rose" />
              <span>Annual Birthday & Milestone Distribution</span>
            </h2>
            <p className="text-xs text-charcoal/50">
              Monthly breakdown of member birthdays for pastoral care and celebratory events.
            </p>
          </div>
          {birthdaySummary && (
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-lg">
                🎂 {birthdaySummary.counts.this_month} This Month
              </span>
              <span className="bg-sage-100 text-sage-900 font-bold px-2.5 py-1 rounded-lg">
                🎈 {birthdaySummary.counts.next_30_days} Next 30 Days
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
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/30"
                    : isCurrentMonth
                    ? "bg-amber-50/80 border-amber-200 hover:border-amber-300 shadow-2xs"
                    : "bg-ivory-light/50 border-gray-100 hover:border-indigo-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSelected ? "text-white/80" : isCurrentMonth ? "text-amber-700" : "text-charcoal/50"
                    }`}>
                      Month {m.month}
                    </span>
                    {isCurrentMonth && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                        isSelected ? "bg-white text-amber-600" : "bg-amber-500 text-white"
                      }`}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <h4 className={`text-xs font-bold ${isSelected ? "text-white" : "text-charcoal"}`}>
                    {m.month_name}
                  </h4>
                </div>

                <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                  <span className={isSelected ? "text-white/80" : "text-charcoal/60"}>Birthdays:</span>
                  <span className={`font-black text-sm px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo"
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
          <div className="mt-4 p-4 rounded-xl bg-ivory-light border border-amber-200/80 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-xs text-charcoal">
                  Celebrants in {birthdaySummary?.monthly_distribution.find(m => m.month === selectedMonth)?.month_name} ({
                    birthdaySummary?.monthly_distribution.find(m => m.month === selectedMonth)?.count
                  } Members)
                </h4>
              </div>
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-[11px] text-charcoal/50 hover:text-charcoal underline"
              >
                Close list
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {birthdaySummary?.monthly_distribution
                .find(m => m.month === selectedMonth)
                ?.celebrants.map(c => (
                  <div key={c.id} className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-charcoal block">{c.first_name} {c.last_name}</span>
                      <span className="text-[10px] text-charcoal/50">{c.ministry_name || "General"}</span>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
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
