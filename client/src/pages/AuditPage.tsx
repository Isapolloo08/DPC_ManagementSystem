import React, { useEffect, useState, useMemo } from "react";
import { api } from "../api";
import { AuditLog } from "../types";
import { AuditPageSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import { useSocketEvent } from "../socket";
import {
  ShieldAlert, ShieldCheck, Clock, User, CheckCircle2, RefreshCw,
  Search, Filter, Download, ArrowUpDown, Eye, Calendar, Sparkles,
  Layers, Activity, FileSpreadsheet, ChevronLeft, ChevronRight, X,
  PlusCircle, Edit3, Trash2, UserCheck, LogOut, DollarSign, Database,
  ArrowRight, Shield
} from "lucide-react";

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Selected Log for Inspection Modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadAudit(true);
  }, []);

  // Real-time synchronization
  useSocketEvent("audit:changed", () => loadAudit(false));

  const loadAudit = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const res = await api.getAuditLogs();
      setLogs(res || []);
      setLastSynced(new Date());
    } catch (err) {
      console.error("Audit log error:", err);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  // Extract unique target entities dynamically
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.target_table) set.add(l.target_table.toUpperCase());
    });
    return Array.from(set).sort();
  }, [logs]);

  // Statistics KPI calculations
  const stats = useMemo(() => {
    const total = logs.length;
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    let others = 0;
    const operatorSet = new Set<string>();

    logs.forEach((l) => {
      const act = l.action?.toUpperCase() || "";
      if (act.includes("CREATE")) creates++;
      else if (act.includes("UPDATE")) updates++;
      else if (act.includes("DELETE")) deletes++;
      else others++;

      if (l.user_name) operatorSet.add(l.user_name);
    });

    return {
      total,
      creates,
      updates,
      deletes,
      others,
      uniqueOperators: operatorSet.size || (total > 0 ? 1 : 0)
    };
  }, [logs]);

  // Filtered & Sorted Audit Logs
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    return logs
      .filter((log) => {
        // Search match
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesUser = log.user_name?.toLowerCase().includes(q);
          const matchesEmail = log.user_email?.toLowerCase().includes(q);
          const matchesRole = log.role_name?.toLowerCase().includes(q);
          const matchesAction = log.action?.toLowerCase().includes(q);
          const matchesEntity = log.target_table?.toLowerCase().includes(q);
          const matchesDetails = log.details?.toLowerCase().includes(q);
          const matchesId = String(log.target_id || "").includes(q);

          if (!matchesUser && !matchesEmail && !matchesRole && !matchesAction && !matchesEntity && !matchesDetails && !matchesId) {
            return false;
          }
        }

        // Action filter
        if (selectedAction !== "ALL" && log.action?.toUpperCase() !== selectedAction) {
          return false;
        }

        // Entity filter
        if (selectedEntity !== "ALL" && log.target_table?.toUpperCase() !== selectedEntity) {
          return false;
        }

        // Timeframe filter
        if (selectedTimeframe !== "ALL") {
          const logTime = new Date(log.created_at).getTime();
          const diff = now - logTime;
          if (selectedTimeframe === "TODAY" && diff > oneDay) return false;
          if (selectedTimeframe === "7DAYS" && diff > sevenDays) return false;
          if (selectedTimeframe === "30DAYS" && diff > thirtyDays) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [logs, searchQuery, selectedAction, selectedEntity, selectedTimeframe, sortOrder]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAction, selectedEntity, selectedTimeframe, pageSize]);

  // CSV Export utility
  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["ID", "Timestamp", "Operator Name", "Operator Email", "Role", "Action", "Target Entity", "Target ID", "Details"];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${new Date(l.created_at).toISOString()}"`,
      `"${l.user_name || "System"}"`,
      `"${l.user_email || ""}"`,
      `"${l.role_name || "System"}"`,
      `"${l.action}"`,
      `"${l.target_table}"`,
      l.target_id || "",
      `"${(l.details || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DPC_Audit_Trail_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = searchQuery !== "" || selectedAction !== "ALL" || selectedEntity !== "ALL" || selectedTimeframe !== "ALL";

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedAction("ALL");
    setSelectedEntity("ALL");
    setSelectedTimeframe("ALL");
  };

  const getActionBadge = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("CREATE")) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
          <PlusCircle className="w-3 h-3 text-emerald-600" />
          <span>CREATE</span>
        </span>
      );
    }
    if (act.includes("UPDATE")) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-950 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
          <Edit3 className="w-3 h-3 text-amber-600" />
          <span>UPDATE</span>
        </span>
      );
    }
    if (act.includes("DELETE")) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-950 border border-rose-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
          <Trash2 className="w-3 h-3 text-rose-600" />
          <span>DELETE</span>
        </span>
      );
    }
    if (act.includes("CHECK_IN") || act.includes("CHECKIN")) {
      return (
        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-950 border border-indigo-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
          <UserCheck className="w-3 h-3 text-indigo-600" />
          <span>CHECK IN</span>
        </span>
      );
    }
    if (act.includes("CHECK_OUT") || act.includes("CHECKOUT")) {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-950 border border-purple-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
          <LogOut className="w-3 h-3 text-purple-600" />
          <span>CHECK OUT</span>
        </span>
      );
    }
    if (act.includes("DONATION") || act.includes("FUND")) {
      return (
        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-950 border border-teal-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
          <DollarSign className="w-3 h-3 text-teal-600" />
          <span>DONATION</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-2xs">
        <Activity className="w-3 h-3 text-slate-600" />
        <span>{action}</span>
      </span>
    );
  };

  const getEntityBadge = (table: string, id: number | null) => {
    const tbl = (table || "").toUpperCase();
    let style = "bg-slate-50 text-slate-800 border-slate-200";
    if (tbl.includes("MEMBER")) style = "bg-emerald-50 text-emerald-950 border-emerald-200";
    else if (tbl.includes("USER")) style = "bg-purple-50 text-purple-950 border-purple-200";
    else if (tbl.includes("MINISTR")) style = "bg-amber-50 text-amber-950 border-amber-200";
    else if (tbl.includes("GROUP") || tbl.includes("BIBLE")) style = "bg-teal-50 text-teal-950 border-teal-200";
    else if (tbl.includes("HOUSEHOLD")) style = "bg-blue-50 text-blue-950 border-blue-200";
    else if (tbl.includes("DUTY")) style = "bg-indigo-50 text-indigo-950 border-indigo-200";

    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border shadow-2xs uppercase ${style}`}>
        <Database className="w-3 h-3 opacity-60" />
        <span>{table || "SYSTEM"}</span>
        {id && <span className="opacity-80">#{id}</span>}
      </span>
    );
  };

  const getInitials = (name: string | null) => {
    if (!name) return "SY";
    return name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getRoleBadgeStyle = (role: string | null) => {
    const r = (role || "").toLowerCase();
    if (r.includes("admin")) return "bg-amber-100 text-amber-900 border-amber-300";
    if (r.includes("coordinator")) return "bg-indigo-100 text-indigo-900 border-indigo-300";
    if (r.includes("volunteer")) return "bg-emerald-100 text-emerald-900 border-emerald-300";
    return "bg-slate-100 text-slate-800 border-slate-300";
  };

  if (loading && logs.length === 0) {
    return <AuditPageSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO COMMAND BAR & STATS HEADER */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-indigo-100/90 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-amber-400/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="p-3 rounded-2xl bg-gradient-to-br from-indigo to-indigo-900 text-white shadow-md ring-4 ring-indigo-50">
                <Shield className="w-6 h-6 text-amber-300" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl lg:text-3xl font-black text-indigo tracking-tight">
                    Security & Audit Trail
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Sync Active
                  </span>
                </div>
                <p className="text-xs text-charcoal/60 font-medium mt-0.5">
                  Immutable administrative ledger capturing security events, staff actions, and database mutations.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-charcoal font-bold px-3.5 py-2 rounded-xl text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Export filtered records to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => loadAudit(false)}
              disabled={refreshing}
              className="flex items-center gap-1.5 bg-indigo hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Syncing..." : "Refresh Ledger"}</span>
            </button>
          </div>
        </div>

        {/* 2. STATS KPI GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 pt-6 border-t border-indigo-50/80 mt-6">
          {/* Total Events */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/60 to-white border border-indigo-100/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-indigo-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">Total Audit Events</span>
              <Activity className="w-4 h-4 text-indigo" />
            </div>
            <p className="text-2xl font-black text-indigo tracking-tight">{stats.total.toLocaleString()}</p>
            <p className="text-[10px] text-charcoal/50">Comprehensive system events</p>
          </div>

          {/* Operations Breakdown */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/60 to-white border border-emerald-100/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-emerald-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">Create / Insert</span>
              <PlusCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700 tracking-tight">{stats.creates.toLocaleString()}</p>
            <p className="text-[10px] text-charcoal/50">{((stats.creates / (stats.total || 1)) * 100).toFixed(0)}% of total mutations</p>
          </div>

          {/* Record Modifications */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/60 to-white border border-amber-100/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-amber-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">Updates & Edits</span>
              <Edit3 className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-700 tracking-tight">{stats.updates.toLocaleString()}</p>
            <p className="text-[10px] text-charcoal/50">{((stats.updates / (stats.total || 1)) * 100).toFixed(0)}% record modifications</p>
          </div>

          {/* Active Operators */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/60 to-white border border-purple-100/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-purple-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">Active Operators</span>
              <User className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-700 tracking-tight">{stats.uniqueOperators}</p>
            <p className="text-[10px] text-charcoal/50">Distinct staff & admins recorded</p>
          </div>
        </div>
      </div>

      {/* 3. SEARCH, FILTERS & ACTION CONTROLS */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-indigo-100/90 shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by operator, action, table, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50/60 focus:bg-white pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-charcoal shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Timeframe Quick Filter */}
          <div className="flex items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200 text-xs font-bold shrink-0">
            <span className="text-[10px] uppercase text-charcoal/50 px-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Time:
            </span>
            {[
              { label: "All", value: "ALL" },
              { label: "Today", value: "TODAY" },
              { label: "7 Days", value: "7DAYS" },
              { label: "30 Days", value: "30DAYS" }
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedTimeframe(t.value)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedTimeframe === t.value ? "bg-white text-indigo shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-charcoal font-bold px-3 py-2 rounded-xl text-xs shadow-2xs cursor-pointer shrink-0"
            title={`Sort by Date: ${sortOrder === "desc" ? "Newest First" : "Oldest First"}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo" />
            <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
          </button>
        </div>

        {/* Secondary Filter Row: Action & Entity Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100 text-xs">
          {/* Action Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-charcoal/50 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Action:
            </span>
            {["ALL", "CREATE", "UPDATE", "DELETE", "CHECK_IN", "DONATION"].map((act) => (
              <button
                key={act}
                onClick={() => setSelectedAction(act)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                  selectedAction === act
                    ? "bg-indigo text-white border-indigo shadow-xs"
                    : "bg-white text-charcoal/70 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Entity Dropdown Filter */}
          {uniqueEntities.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-charcoal/50">Entity:</span>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-charcoal focus:outline-none focus:border-indigo shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Entities ({uniqueEntities.length})</option>
                {uniqueEntities.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-bold text-rose hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer ml-auto"
            >
              <X className="w-3 h-3" />
              <span>Clear Filters ({filteredLogs.length} matching)</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. HIGH-END AUDIT LEDGER TABLE */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <TableSkeleton rows={8} columns={5} />
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <ShieldAlert className="w-12 h-12 text-charcoal/20 mx-auto" />
            <h3 className="text-base font-bold text-charcoal">No matching audit records found</h3>
            <p className="text-xs text-charcoal/50 max-w-sm mx-auto">
              {hasActiveFilters
                ? "Try adjusting your search query, action filters, or timeframe selection."
                : "No administrative operations have been recorded in the database yet."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3.5 py-1.5 bg-indigo-50 text-indigo font-bold rounded-xl text-xs hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-indigo-100/80 bg-indigo-50/50 text-charcoal font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-5">Timestamp</th>
                    <th className="py-3.5 px-4">Operator</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Target Entity</th>
                    <th className="py-3.5 px-5">Details</th>
                    <th className="py-3.5 px-4 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/80">
                  {paginatedLogs.map((log) => {
                    const logDate = new Date(log.created_at);
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setInspectLog(log)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-5 text-charcoal/80 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-charcoal text-[11px]">
                              {logDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                            <span className="text-[10px] text-charcoal/50 font-medium">
                              {logDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </td>

                        {/* Operator User */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo/10 text-indigo font-black text-[11px] flex items-center justify-center shrink-0 border border-indigo/20 shadow-2xs">
                              {getInitials(log.user_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-charcoal truncate text-xs">{log.user_name || "System Admin"}</p>
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border shadow-2xs inline-block ${getRoleBadgeStyle(
                                  log.role_name
                                )}`}
                              >
                                {log.role_name || "System"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3.5 px-4">{getActionBadge(log.action)}</td>

                        {/* Target Entity */}
                        <td className="py-3.5 px-4">{getEntityBadge(log.target_table, log.target_id)}</td>

                        {/* Details */}
                        <td className="py-3.5 px-5 text-charcoal/80 font-medium max-w-md">
                          <p className="line-clamp-2 leading-relaxed text-xs">{log.details || "—"}</p>
                        </td>

                        {/* Inspect Button */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectLog(log);
                            }}
                            className="p-1.5 rounded-lg text-charcoal/40 group-hover:text-indigo group-hover:bg-indigo-50 transition-all cursor-pointer"
                            title="Inspect log details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 5. TABLE FOOTER WITH PAGINATION & ROW CONTROLS */}
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-charcoal/70 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                  <strong>{Math.min(currentPage * pageSize, filteredLogs.length)}</strong> of{" "}
                  <strong>{filteredLogs.length}</strong> events
                </span>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-charcoal/50 text-[11px]">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-xs font-bold text-charcoal focus:outline-none focus:border-indigo"
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Pagination Page Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-charcoal/70 hover:text-charcoal hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 font-bold text-xs text-indigo">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-charcoal/70 hover:text-charcoal hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. INSPECT AUDIT DETAIL MODAL */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-indigo-950/70 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-indigo-100 p-6 sm:p-8 space-y-5 animate-scale-up my-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setInspectLog(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo border border-indigo-200">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-charcoal">Audit Transaction #{inspectLog.id}</h3>
                  <p className="text-[11px] text-charcoal/60">Immutable Security Ledger Verification</p>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200/80 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-200/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-charcoal/50 block mb-0.5">Action Executed</span>
                  {getActionBadge(inspectLog.action)}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-charcoal/50 block mb-0.5">Target Entity</span>
                  {getEntityBadge(inspectLog.target_table, inspectLog.target_id)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-200/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-charcoal/50 block mb-0.5">Operator Name</span>
                  <p className="font-bold text-charcoal">{inspectLog.user_name || "System"}</p>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border shadow-2xs inline-block mt-1 ${getRoleBadgeStyle(
                      inspectLog.role_name
                    )}`}
                  >
                    {inspectLog.role_name || "System"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-charcoal/50 block mb-0.5">Operator Email</span>
                  <p className="font-medium text-charcoal/80 truncate">{inspectLog.user_email || "N/A"}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-charcoal/50 block mb-0.5">Exact Timestamp</span>
                <p className="font-mono text-[11px] text-indigo font-bold">
                  {new Date(inspectLog.created_at).toLocaleString([], { dateStyle: "full", timeStyle: "medium" })}
                </p>
                <p className="text-[10px] text-charcoal/40 font-mono mt-0.5">
                  ISO: {new Date(inspectLog.created_at).toISOString()}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-charcoal/50 block mb-1">Details & Description</span>
                <div className="bg-white p-3 rounded-xl border border-gray-200 font-sans text-xs text-charcoal leading-relaxed shadow-2xs">
                  {inspectLog.details || "No additional description metadata was provided for this event."}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-5 py-2.5 bg-indigo hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
