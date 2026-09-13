import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "rectangular" | "circular" | "rounded" | "text";
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "rounded",
  width,
  height
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case "circular":
        return "rounded-full";
      case "text":
        return "rounded-md h-4 my-1";
      case "rectangular":
        return "rounded-none";
      case "rounded":
      default:
        return "rounded-2xl";
    }
  };

  const style: React.CSSProperties = {
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined
  };

  return (
    <div
      className={`skeleton-box ${getVariantClass()} ${className}`}
      style={style}
    />
  );
};

// Generic KPI / Stat Card Skeleton
export const StatCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-10 rounded-2xl" />
          </div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
};

// Generic Data Table Skeleton
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 6,
  columns = 5
}) => {
  return (
    <div className="bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
      {/* Table Head */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-ivory-light to-amber-50/40 px-6 py-4 border-b border-indigo-100 flex items-center justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 max-w-[140px]" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-indigo-50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-[220px]">
              <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
            {Array.from({ length: columns - 1 }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1 max-w-[130px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Generic Card Grid Skeleton
export const CardGridSkeleton: React.FC<{ count?: number; columns?: number }> = ({
  count = 6,
  columns = 3
}) => {
  const colClass = columns === 4 ? "lg:grid-cols-4" : columns === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${colClass} gap-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/95 rounded-3xl border border-indigo-100/90 p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-5 w-44" />
            </div>
            <Skeleton variant="circular" className="w-10 h-10 shrink-0" />
          </div>

          <Skeleton className="h-10 w-full rounded-2xl" />

          <div className="space-y-2 pt-2 border-t border-indigo-50">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-7 w-20 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

// =========================================================================
// 1. DASHBOARD PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner Shadow */}
      <div className="rounded-3xl bg-indigo-950/80 p-7 sm:p-8 border border-indigo-900 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <Skeleton className="w-14 h-14 rounded-2xl bg-white/15 shrink-0" />
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full bg-white/20" />
              <Skeleton className="h-5 w-36 rounded-full bg-white/10" />
            </div>
            <Skeleton className="h-8 w-64 sm:w-96 bg-white/20" />
            <Skeleton className="h-4 w-80 sm:w-120 bg-white/10" />
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Skeleton className="h-10 w-32 rounded-2xl bg-amber-400/30" />
          <Skeleton className="h-10 w-28 rounded-2xl bg-white/15" />
          <Skeleton className="h-10 w-28 rounded-2xl bg-white/15" />
        </div>
      </div>

      {/* 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-2xl" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Aging out banner card */}
          <div className="bg-white/95 rounded-3xl p-6 border border-rose-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>

          {/* Today's Small Groups */}
          <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </div>

          {/* Duty & Dishwashing preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
            <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Birthdays Celebrants Widget */}
          <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-indigo-50/40 rounded-2xl">
                  <Skeleton variant="circular" className="w-10 h-10 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-7 w-14 rounded-xl" />
                </div>
              ))}
            </div>
          </div>

          {/* Announcements Widget */}
          <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. MEMBERS PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const MembersPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-5 border border-indigo-100/90 shadow-sm space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/95 p-4 rounded-3xl border border-indigo-100/90 shadow-sm">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Skeleton className="h-9 w-full md:w-64 rounded-2xl" />
            <Skeleton className="h-9 w-36 rounded-2xl" />
          </div>
        </div>

        {/* Milestone filter pills */}
        <div className="flex items-center gap-2 bg-white/80 p-3 rounded-2xl border border-indigo-100 shadow-2xs">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-24 rounded-xl" />
          <Skeleton className="h-7 w-28 rounded-xl" />
          <Skeleton className="h-7 w-28 rounded-xl" />
          <Skeleton className="h-7 w-36 rounded-xl" />
        </div>
      </div>

      {/* Members Directory Table */}
      <TableSkeleton rows={8} columns={7} />
    </div>
  );
};

// =========================================================================
// 3. SUNDAY CHECK-IN PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const CheckInPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 p-4 sm:p-5 rounded-3xl border border-indigo-100/90 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-2xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Dark Navy Attendance Status Hero Banner */}
      <div className="rounded-3xl bg-indigo-950/90 p-6 sm:p-7 text-white shadow-xl border border-indigo-800 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-32 rounded-full bg-white/20" />
              <Skeleton className="h-5 w-44 rounded-full bg-white/10" />
            </div>
            <Skeleton className="h-8 w-72 sm:w-96 bg-white/20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl bg-white/15" />
            <Skeleton className="h-9 w-28 rounded-xl bg-white/15" />
          </div>
        </div>

        {/* 4 Counter Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/10 rounded-2xl p-3.5 border border-white/10 space-y-1.5">
              <Skeleton className="h-3.5 w-20 bg-white/20" />
              <Skeleton className="h-7 w-12 bg-white/30" />
              <Skeleton className="h-3 w-28 bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      {/* Ministry Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 p-4 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
      </div>

      {/* Roster Table */}
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
};

// =========================================================================
// 4. EVENTS & MASTER CALENDAR SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const EventsPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-56 sm:w-72" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-3xl border border-indigo-100/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-44 rounded-2xl" />
          <Skeleton className="h-9 w-44 rounded-2xl" />
        </div>
        <Skeleton className="h-9 w-full md:w-72 rounded-2xl" />
      </div>

      {/* 2-Column Grid: Calendar on Left (8 cols) + Inspector on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Monthly Calendar Box */}
        <div className="lg:col-span-8 bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden space-y-4">
          <div className="p-5 bg-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-2xl bg-white/20" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36 bg-white/20" />
                <Skeleton className="h-3 w-56 bg-white/10" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-xl bg-white/15" />
              <Skeleton className="w-8 h-8 rounded-xl bg-white/15" />
            </div>
          </div>

          {/* 7x5 Day Grid Shadow */}
          <div className="p-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 sm:h-24 p-2 rounded-2xl border border-indigo-50/80 bg-slate-50/50 space-y-1.5">
                <Skeleton className="h-3.5 w-6" />
                {i % 4 === 0 && <Skeleton className="h-5 w-full rounded-lg" />}
                {i % 7 === 1 && <Skeleton className="h-4 w-3/4 rounded-lg" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right Event Inspector Box */}
        <div className="lg:col-span-4 bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="space-y-2 pt-2 border-t border-indigo-50">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 5. BIBLE STUDY GROUPS PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const BibleStudyPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-2xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-3.5 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 3 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="w-12 h-12 rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Multi-Level Filter Toolbar */}
      <div className="bg-white/95 p-4 rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-24 rounded-xl" />
          <Skeleton className="h-7 w-24 rounded-xl" />
          <Skeleton className="h-7 w-24 rounded-xl" />
          <Skeleton className="h-7 w-24 rounded-xl" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-36 rounded-xl" />
            <Skeleton className="h-8 w-36 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-64 rounded-xl" />
        </div>
      </div>

      {/* 3-Column Small Groups Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-50">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-36" />
            <div className="bg-indigo-50/50 p-3 rounded-2xl space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================================
// 6. TOPICS & BOOKS CURRICULUM SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const CurriculumPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="w-11 h-11 rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="bg-white/95 rounded-3xl p-4 sm:p-5 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-9 w-28 rounded-2xl" />
          <Skeleton className="h-9 w-32 rounded-2xl" />
          <Skeleton className="h-9 w-28 rounded-2xl" />
          <Skeleton className="h-9 w-28 rounded-2xl" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-2xl" />
      </div>

      {/* 2-Column Grid: Topics Cards on Left (7 cols) + Right Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white/95 rounded-3xl border border-indigo-100/90 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex items-center justify-between pt-2 border-t border-indigo-50">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Topic Detail Inspector Shadow */}
        <div className="lg:col-span-5 bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="space-y-2 pt-2 border-t border-indigo-50">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 7. SATURDAY DUTY ROSTER SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const DutyPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 p-6 rounded-3xl border border-indigo-100/90 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-60" />
          </div>
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-10 w-36 rounded-2xl" />
      </div>

      {/* THIS SATURDAY ON-DUTY HERO CARD */}
      <div className="rounded-3xl bg-indigo-950 p-7 sm:p-8 text-white shadow-xl border border-indigo-800 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded-full bg-amber-400/30" />
          <Skeleton className="h-5 w-32 rounded-full bg-white/10" />
        </div>
        <Skeleton className="h-8 w-56 bg-white/20" />
        <Skeleton className="h-4 w-72 bg-white/10" />
        <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-2">
          <Skeleton className="h-3.5 w-32 bg-white/20" />
          <Skeleton className="h-3 w-64 bg-white/10" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white/95 p-1.5 rounded-2xl border border-indigo-100 w-fit">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* 3-Column Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl border border-indigo-100/90 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
              <div className="flex items-center gap-2.5">
                <Skeleton variant="circular" className="w-4 h-4" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-4 w-36" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
            <div className="pt-2 border-t border-indigo-50 flex items-center justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================================
// 8. DISHWASHING ROSTER SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const DishwashingPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 2-Column Hero: This Sunday (7 cols) + Next Sunday (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-3xl bg-indigo-950 p-6 sm:p-7 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded-full bg-amber-400/30" />
            <Skeleton className="h-5 w-24 rounded-full bg-white/10" />
          </div>
          <Skeleton className="h-8 w-56 bg-white/20" />
          <Skeleton className="h-4 w-72 bg-white/10" />
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
            <Skeleton className="h-4 w-40 bg-white/20" />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white/95 rounded-3xl p-6 sm:p-7 border border-indigo-100/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>

      {/* Table */}
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
};

// =========================================================================
// 9. GIVING & STEWARDSHIP SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const GivingPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 4 Fund Goal Meter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="w-9 h-9 rounded-2xl" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-full" />
            <div className="space-y-2 pt-2">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Donations Table */}
      <TableSkeleton rows={5} columns={6} />
    </div>
  );
};

// =========================================================================
// 10. COMMUNICATIONS PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const CommunicationsPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 bg-white/95 p-4 rounded-3xl border border-indigo-100 shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-32 rounded-2xl" />
      </div>

      {/* Announcement Cards List */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {i === 0 && <Skeleton className="h-5 w-16 rounded-full" />}
                <Skeleton className="h-6 w-48 sm:w-64" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-14 w-full rounded-xl" />
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================================
// 11. USERS & ROLES PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const UsersPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 5 Role Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-5 border border-indigo-100 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/95 p-4 rounded-3xl border border-indigo-100 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Skeleton className="h-8 w-20 rounded-2xl" />
          <Skeleton className="h-8 w-20 rounded-2xl" />
          <Skeleton className="h-8 w-24 rounded-2xl" />
          <Skeleton className="h-8 w-20 rounded-2xl" />
        </div>
        <Skeleton className="h-8 w-64 rounded-2xl" />
      </div>

      {/* Table */}
      <TableSkeleton rows={7} columns={5} />
    </div>
  );
};

// =========================================================================
// 12. SETTINGS & LOOKUPS PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const SettingsPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto p-2 bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-2xl shrink-0" />
        ))}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 p-4 sm:p-5 rounded-3xl border border-indigo-100/90 shadow-sm">
        <Skeleton className="h-9 w-full sm:w-72 rounded-2xl" />
        <Skeleton className="h-9 w-36 rounded-2xl" />
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl border border-indigo-100/90 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton variant="circular" className="w-4 h-4" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-2xl" />
            <div className="flex items-center justify-between pt-2 border-t border-indigo-50">
              <Skeleton className="h-4 w-20" />
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <Skeleton className="w-8 h-8 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================================
// 13. REPORTS & ANALYTICS PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const ReportsPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-2xl" />
      </div>

      {/* 4 Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-2xl" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>

      {/* Attendance Trends Graph Box */}
      <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>

      {/* Ministry Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================================
// 14. AUDIT TRAIL PAGE SHADOW SKELETON (Exact 1:1 Mirror)
// =========================================================================
export const AuditPageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28 rounded-2xl" />
      </div>

      {/* Audit Log Table */}
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
};
