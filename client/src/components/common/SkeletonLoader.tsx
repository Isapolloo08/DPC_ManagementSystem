import React from "react";

export const PageHeaderSkeleton: React.FC = () => (
  <div aria-hidden="true" className="page-header">
    <div className="page-header-row">
      <div className="page-header-main">
        <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
      </div>
      <div className="page-header-actions">
        <Skeleton className="h-11 w-32 rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ count?: number; label?: string }> = ({ count = 5, label = "Loading records..." }) => (
  <div role="status" aria-busy="true" aria-label={label} className="divide-y divide-stone-100 bg-white rounded-2xl border border-stone-200 overflow-hidden">
    {Array.from({ length: count }, (_, i) => <div key={i} aria-hidden="true" className="flex items-start gap-3 p-4 sm:p-5">
      <Skeleton variant="circular" className="h-9 w-9 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-32 max-w-full" />
      </div>
    </div>)}
  </div>
);

export const CalendarSkeleton: React.FC = () => (
  <div role="status" aria-busy="true" aria-label="Loading calendar..." className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
    <div aria-hidden="true" className="flex justify-between gap-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-9 w-28" /></div>
    <div aria-hidden="true" className="grid grid-cols-7 gap-1 sm:gap-2">
      {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      {Array.from({ length: 35 }, (_, i) => <Skeleton key={i + 7} className="h-16 sm:h-24 w-full rounded-lg" />)}
    </div>
  </div>
);

export const GroupPortalSkeleton: React.FC = () => (
  <div role="status" aria-busy="true" aria-label="Loading your Bible study group..." className="page-skeleton space-y-6">
    <PageHeaderSkeleton />
    <div aria-hidden="true" className="flex gap-2 overflow-hidden">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-32 shrink-0" />)}</div>
    <StatCardSkeleton />
    <CardGridSkeleton count={4} columns={2} />
  </div>
);

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
      aria-hidden="true"
      className={`skeleton-box ${getVariantClass()} ${className}`}
      style={style}
    />
  );
};

// Generic KPI / Stat Card Skeleton
export const StatCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${count === 3 ? "lg:grid-cols-3" : count === 2 ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
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
    <div className="bg-white/95 rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Table Head */}
      <div className="bg-indigo-50/70 px-6 py-4 border-b border-indigo-100 flex items-center justify-between gap-4">
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
        <div key={i} className="bg-white/95 rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
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
// 1. DASHBOARD PAGE LOADING SKELETON
// =========================================================================
export const DashboardSkeleton: React.FC<{ variant?: "overview" | "service" }> = ({ variant = "overview" }) => {
  if (variant === "overview") return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard..." className="page-skeleton space-y-6">
      <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3 md:self-center"><Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-52" /><Skeleton className="h-5 w-60" /></div>
        <div className="space-y-4"><Skeleton className="h-56 w-full" /><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-3 w-full" /></div>)}</div></div>
      </div>
      <CardGridSkeleton count={3} columns={3} />
      <div aria-hidden="true" className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
    </div>
  );
  return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard..." className="page-skeleton space-y-6">
      {/* Welcome Banner Shadow */}
      <PageHeaderSkeleton />

      {/* 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
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
          <div className="bg-white/95 rounded-2xl p-6 border border-rose-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>

          {/* Today's Small Groups */}
          <div className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
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
            <div className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
            <div className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Birthdays Celebrants Widget */}
          <div className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
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
          <div className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
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
// 2. MEMBERS PAGE LOADING SKELETON
// =========================================================================
export const MembersPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading members..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* 4 Summary Stats Cards */}


      {/* Tabs & Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/95 p-4 rounded-2xl border border-stone-200 shadow-sm">
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
// Attendance loading follows the same cards and table spacing as the loaded pages.
// =========================================================================
export const AttendanceSummarySkeleton: React.FC = () => (
  <div role="status" aria-busy="true" className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
    <span className="sr-only">Loading attendance summary...</span>
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} aria-hidden="true" className="stat-card">
        <div className="stat-card-heading">
          <Skeleton className="h-4 w-24 max-w-full" />
          <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl" />
        </div>
        <Skeleton className="h-8 sm:h-9 w-16 mt-2" />
        <Skeleton className="h-[18px] w-28 max-w-full mt-3" />
      </div>
    ))}
  </div>
);

export const AttendanceTableSkeleton: React.FC<{ rows?: number; columns?: number; showAvatar?: boolean; showDirectoryHeader?: boolean }> = ({
  rows = 8, columns = 6, showAvatar = true, showDirectoryHeader = true,
}) => (
  <div role="status" aria-busy="true" className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
    <span className="sr-only">Loading attendance records...</span>
    <div aria-hidden="true">
      {showDirectoryHeader && (
        <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="space-y-2 min-w-0">
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>{Array.from({ length: columns }, (_, i) => <th key={i} className="px-4 py-3.5"><Skeleton className="h-4 w-24 max-w-full" /></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }, (_, c) => (
                  <td key={c} className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-h-6">
                      {c === 0 && showAvatar && <Skeleton variant="circular" className="w-9 h-9 shrink-0" />}
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const CheckInPageSkeleton: React.FC = () => (
  <div role="status" aria-busy="true" className="space-y-6 pb-12">
    <span className="sr-only">Loading attendance...</span>
    <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4 pb-1">
      <div className="flex flex-wrap gap-2 min-w-0">
        <Skeleton className="h-11 w-56 max-w-full rounded-xl" />
        <Skeleton className="h-11 w-52 max-w-full rounded-xl" />
      </div>
      <Skeleton className="h-8 w-64 max-w-full rounded-xl" />
    </div>
    <div aria-hidden="true" className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-stone-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="flex items-start gap-2.5 min-w-0">
        <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
        <div className="space-y-2 min-w-0">
          <Skeleton className="h-14 sm:h-8 w-80 max-w-full" />
          <Skeleton className="h-24 sm:h-10 w-96 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 xl:shrink-0">
        <Skeleton className="h-11 w-64 max-w-full rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
    <AttendanceSummarySkeleton />
    <div aria-hidden="true" className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm space-y-3">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-8 w-28 rounded-xl shrink-0" />)}
      </div>
      <div className="flex flex-wrap justify-between gap-3 pt-3 border-t border-stone-100">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-24 rounded-xl" />)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-52 max-w-full rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>
    </div>
    <AttendanceTableSkeleton />
  </div>
);

// =========================================================================
// 4. EVENTS & MASTER CALENDAR LOADING SKELETON
// =========================================================================
export const EventsPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading events..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* Toolbar & Filters */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-44 rounded-2xl" />
          <Skeleton className="h-9 w-44 rounded-2xl" />
        </div>
        <Skeleton className="h-9 w-full md:w-72 rounded-2xl" />
      </div>

      {/* 2-Column Grid: Calendar on Left (8 cols) + Inspector on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Monthly Calendar Box */}
        <div className="lg:col-span-8 bg-white/95 rounded-2xl border border-stone-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-5 bg-white text-charcoal flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-2xl bg-stone-50" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36 bg-stone-50" />
                <Skeleton className="h-3 w-56 bg-stone-50" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-xl bg-stone-50" />
              <Skeleton className="w-8 h-8 rounded-xl bg-stone-50" />
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
        <div className="lg:col-span-4 bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
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
// 5. BIBLE STUDY GROUPS PAGE LOADING SKELETON
// =========================================================================
export const BibleStudyPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading bible study..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* 3 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm flex items-center justify-between">
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
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
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
// 6. TOPICS & BOOKS CURRICULUM LOADING SKELETON
// =========================================================================
export const CurriculumPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading curriculum..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm flex items-center justify-between">
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
      <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
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
              <div key={i} className="bg-white/95 rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
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
        <div className="lg:col-span-5 bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
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
// 7. SATURDAY DUTY ROSTER LOADING SKELETON
// =========================================================================
export const DutyPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading duty..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* THIS SATURDAY ON-DUTY HERO CARD */}
      <div className="rounded-2xl bg-white p-7 sm:p-8 text-charcoal shadow-sm border border-stone-200 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded-full bg-amber-400/30" />
          <Skeleton className="h-5 w-32 rounded-full bg-stone-50" />
        </div>
        <Skeleton className="h-8 w-56 bg-stone-50" />
        <Skeleton className="h-4 w-72 bg-stone-50" />
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
          <Skeleton className="h-3.5 w-32 bg-stone-50" />
          <Skeleton className="h-3 w-64 bg-stone-50" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white/95 p-1.5 rounded-2xl border border-indigo-100 w-fit max-w-full overflow-hidden">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* 3-Column Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
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
// 8. DISHWASHING ROSTER LOADING SKELETON
// =========================================================================
export const DishwashingPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading dishwashing..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* 2-Column Hero: This Sunday (7 cols) + Next Sunday (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-white p-6 sm:p-7 text-charcoal shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded-full bg-amber-400/30" />
            <Skeleton className="h-5 w-24 rounded-full bg-stone-50" />
          </div>
          <Skeleton className="h-8 w-56 bg-stone-50" />
          <Skeleton className="h-4 w-72 bg-stone-50" />
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <Skeleton className="h-4 w-40 bg-stone-50" />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white/95 rounded-2xl p-6 sm:p-7 border border-stone-200 shadow-sm space-y-4">
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
// 10. COMMUNICATIONS PAGE LOADING SKELETON
// =========================================================================
export const CommunicationsPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading communications..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 bg-white/95 p-4 rounded-2xl border border-indigo-100 shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-32 rounded-2xl" />
      </div>

      {/* Announcement Cards List */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
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
// 11. USERS & ROLES PAGE LOADING SKELETON
// =========================================================================
export const UsersPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading users..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* 5 Role Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-5 border border-indigo-100 shadow-sm space-y-1.5">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/95 p-4 rounded-2xl border border-indigo-100 shadow-sm">
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
// 12. SETTINGS & LOOKUPS PAGE LOADING SKELETON
// =========================================================================
export const SettingsPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading settings..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto p-2 bg-white/95 rounded-2xl border border-stone-200 shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-2xl shrink-0" />
        ))}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm">
        <Skeleton className="h-9 w-full sm:w-72 rounded-2xl" />
        <Skeleton className="h-9 w-36 rounded-2xl" />
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
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
// 13. REPORTS & ANALYTICS PAGE LOADING SKELETON
// =========================================================================
export const ReportsPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading reports..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* 4 Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
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
      <div className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>

      {/* Ministry Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
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
// 14. AUDIT TRAIL PAGE LOADING SKELETON
// =========================================================================
export const AuditPageSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" aria-label="Loading audit..." className="page-skeleton space-y-6">
      {/* Header Banner */}
      <PageHeaderSkeleton />

      {/* Audit Log Table */}
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
};
