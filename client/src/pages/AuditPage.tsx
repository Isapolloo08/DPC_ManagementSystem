import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { usePageControls, useDebouncedValue } from "../hooks/useListPagination";
import { StatCard } from "../components/common/StatCard";
import { Button } from "../components/common/Button";
import { ViewportOverlay } from "../components/common/ViewportOverlay";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { AuditLog } from "../types";
import { AuditPageSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import { useSocketEvent } from "../socket";
import {
  ShieldAlert, ShieldCheck, Clock, User, CheckCircle2, RefreshCw,
  Search, Download, ArrowUpDown, Eye, Calendar,
  Layers, Activity, FileSpreadsheet, ChevronLeft, ChevronRight, X,
  PlusCircle, Edit3, Trash2, UserCheck, LogOut, Database,
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
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Pagination States
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { page: currentPage, pageSize, setPage: setCurrentPage, setPageSize } = usePageControls(JSON.stringify([debouncedSearch, selectedAction, selectedEntity, selectedTimeframe, selectedOperator, selectedRole, fromDate, toDate, sortOrder]));
  const [serverPaged, setServerPaged] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverSummary, setServerSummary] = useState<Record<string, number> | null>(null);
  const [options, setOptions] = useState<{ actions: string[]; entities: string[]; operators: string[]; roles: string[] } | null>(null);
  const requestSequence = useRef(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const listParams = { page: currentPage, limit: pageSize, search: debouncedSearch, action: selectedAction, target_table: selectedEntity, operator: selectedOperator, role: selectedRole, period: selectedTimeframe, from: fromDate, to: toDate, sort: sortOrder };

  // Selected Log for Inspection Modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadAudit(true);
  }, [currentPage, pageSize, debouncedSearch, selectedAction, selectedEntity, selectedTimeframe, selectedOperator, selectedRole, fromDate, toDate, sortOrder]);
  useEffect(() => () => { requestSequence.current++; }, []);

  // Real-time synchronization
  useSocketEvent("audit:changed", () => loadAudit(false));

 const loadAudit = async (isInitial = false) => {
    const sequence = ++requestSequence.current;
    guideData.clearError();
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const res = await api.getAuditPage(listParams);
      if (sequence !== requestSequence.current) return;
      if (Array.isArray(res)) {
        setLogs(res); setServerPaged(false); setServerSummary(null); setOptions(null);
      } else {
        setLogs(res.data || []); setServerPaged(true); setServerTotal(res.pagination.total);
        setServerSummary(res.summary || null); setOptions(res.options || null);
        if (res.pagination.page !== currentPage) setCurrentPage(res.pagination.page);
      }
      setLastSynced(new Date());
    } catch (err) {
      console.error("Audit log error:", err);
      guideData.reportError(err);
    } finally {
      if (sequence !== requestSequence.current) return;
      if (isInitial) {
        setHasLoaded(true);
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  // Extract unique target entities dynamically
  const uniqueEntities = useMemo(() => {
    if (options) return [...options.entities].sort();
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.target_table) set.add(l.target_table.toUpperCase());
    });
    return Array.from(set).sort();
  }, [logs, options]);

  const uniqueActions = options ? [...options.actions].sort() : [...new Set(logs.map(log => log.action?.toUpperCase()).filter(Boolean))].sort();
  const uniqueOperators = options ? [...options.operators].sort() : [...new Set(logs.map(log => log.user_name || "System"))].sort();
  const uniqueRoles = options ? [...options.roles].sort() : [...new Set(logs.map(log => log.role_name || "System"))].sort();
  const manilaDay = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

  // Statistics KPI calculations
  const stats = useMemo(() => {
    if (serverSummary) return { total: serverSummary.total, creates: serverSummary.creates, updates: serverSummary.updates, deletes: serverSummary.deletes, others: serverSummary.total - serverSummary.creates - serverSummary.updates - serverSummary.deletes, uniqueOperators: serverSummary.uniqueOperators };
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
  }, [logs, serverSummary]);

  // Filtered & Sorted Audit Logs
  const filteredLogs = useMemo(() => {
    if (serverPaged) return logs;
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

        if (selectedOperator && (log.user_name || "System") !== selectedOperator) return false;
        if (selectedRole && (log.role_name || "System") !== selectedRole) return false;
        const calendarDate = manilaDay(log.created_at);
        if (fromDate && calendarDate < fromDate) return false;
        if (toDate && calendarDate > toDate) return false;

        // Timeframe filter
        if (selectedTimeframe !== "ALL") {
          const logTime = new Date(log.created_at).getTime();
          const diff = now - logTime;
          if (selectedTimeframe === "TODAY" && calendarDate !== manilaDay(new Date())) return false;
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
  }, [logs, serverPaged, searchQuery, selectedAction, selectedEntity, selectedTimeframe, sortOrder, selectedOperator, selectedRole, fromDate, toDate]);

  // Pagination calculations
  const resultTotal = serverPaged ? serverTotal : filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(resultTotal / pageSize));
  const paginatedLogs = useMemo(() => {
    if (serverPaged) return filteredLogs;
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize, serverPaged]);

  // CSV Export utility
  const exportToCSV = async () => {
    if (serverPaged) {
      try {
        const blob = await api.exportAuditCsv(listParams);
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href = url; link.download = "DPC_Audit_Trail.csv"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { guideData.reportError(error); }
      return;
    }
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

  const hasActiveFilters = searchQuery !== "" || selectedAction !== "ALL" || selectedEntity !== "ALL" || selectedTimeframe !== "ALL" || Boolean(selectedOperator || selectedRole || fromDate || toDate);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedAction("ALL");
    setSelectedEntity("ALL");
    setSelectedTimeframe("ALL");
    setSelectedOperator(""); setSelectedRole(""); setFromDate(""); setToDate("");
  };

  const getActionBadge = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("CREATE")) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-300 font-medium px-2.5 py-0.5 rounded-full text-[12px] shadow-2xs">
          <PlusCircle className="w-3 h-3 text-emerald-600" />
          <span>CREATE</span>
        </span>
      );
    }
    if (act.includes("UPDATE")) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-950 border border-amber-300 font-medium px-2.5 py-0.5 rounded-full text-[12px] shadow-2xs">
          <Edit3 className="w-3 h-3 text-amber-600" />
          <span>UPDATE</span>
        </span>
      );
    }
    if (act.includes("DELETE")) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-950 border border-rose-300 font-medium px-2.5 py-0.5 rounded-full text-[12px] shadow-2xs">
          <Trash2 className="w-3 h-3 text-rose-600" />
          <span>DELETE</span>
        </span>
      );
    }
    if (act.includes("CHECK_IN") || act.includes("CHECKIN")) {
      return (
        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-950 border border-indigo-300 font-medium px-2.5 py-0.5 rounded-full text-[12px] shadow-2xs">
          <UserCheck className="w-3 h-3 text-indigo-600" />
          <span>CHECK IN</span>
        </span>
      );
    }
    if (act.includes("CHECK_OUT") || act.includes("CHECKOUT")) {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-950 border border-purple-300 font-medium px-2.5 py-0.5 rounded-full text-[12px] shadow-2xs">
          <LogOut className="w-3 h-3 text-purple-600" />
          <span>CHECK OUT</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-300 font-medium px-2.5 py-0.5 rounded-full text-[12px] shadow-2xs">
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
      <span className={`inline-flex items-center gap-1 font-mono text-[12px] font-medium px-2 py-0.5 rounded-md border shadow-2xs uppercase ${style}`}>
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

  const guideData = useGuideDataState("audit", { loading, count: filteredLogs.length, filtered: hasActiveFilters, retry: () => loadAudit(true) });

  if (loading && !hasLoaded) {
    return <AuditPageSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO COMMAND BAR & STATS HEADER */}
      <section data-page-header className="rounded-3xl bg-indigo-950 text-white border-t-2 border-amber-400 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-3 min-w-0">
            <span className="rounded-2xl bg-white/10 p-3 text-amber-300"><Shield className="w-6 h-6" /></span>
            <div><p className="text-[11px] uppercase tracking-widest text-amber-300 mb-1">System oversight</p>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">Security & Audit Trail</h1>
              <p className="text-xs text-indigo-200 mt-2 leading-relaxed">Review who changed a record, what happened, and when.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button data-guide="audit-export" onClick={exportToCSV} disabled={filteredLogs.length === 0} title="Export filtered records to CSV" variant="secondary"><FileSpreadsheet className="w-4 h-4" />Export CSV</Button>
            <button type="button" onClick={() => loadAudit(false)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing…" : "Refresh Ledger"}</button>
          </div>
        </div>
        <p className="mt-5 pt-3 border-t border-white/10 text-[11px] text-indigo-200 flex items-center gap-1.5"><Clock className="w-3 h-3" />Last refreshed {lastSynced.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })} · Philippine time</p>
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard label="Total Audit Events" value={stats.total.toLocaleString()} icon={<Activity />} description="Recorded system activity" />
        <StatCard label="Create / Insert" value={stats.creates.toLocaleString()} icon={<PlusCircle />} tone="emerald" description={((stats.creates / (stats.total || 1)) * 100).toFixed(0) + "% of total mutations"} />
        <StatCard label="Record Modifications" value={stats.updates.toLocaleString()} icon={<Edit3 />} tone="amber" description={((stats.updates / (stats.total || 1)) * 100).toFixed(0) + "% record modifications"} />
        <StatCard label="Active Operators" value={stats.uniqueOperators} icon={<User />} tone="sky" description="Distinct staff & admins recorded" />
      </div>

      <FilterPanel title="Audit filters" summary={[searchQuery, selectedAction !== "ALL" && selectedAction, selectedEntity !== "ALL" && selectedEntity, selectedTimeframe !== "ALL" && selectedTimeframe, selectedOperator, selectedRole, fromDate, toDate].filter(Boolean).join(" · ") || "All audit events"} aria-label="Audit filters" onReset={clearAllFilters}>
<section className="filter-panel-layout bg-white rounded-2xl border border-indigo-100 p-4 sm:p-5 space-y-4 shadow-sm" aria-label="Audit filters">

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0"><Search className="w-4 h-4 text-muted absolute left-3 top-3" />
            <input data-guide="audit-search" aria-label="Search audit logs" placeholder="Search names, records, or activity…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="ui-input pl-9" /></div>
          <button data-guide="audit-sort" onClick={() => setSortOrder(value => value === "desc" ? "asc" : "desc")} className="ui-button ui-button--secondary"><ArrowUpDown className="w-4 h-4" />{sortOrder === "desc" ? "Newest First" : "Oldest First"}</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1 min-w-0"><span className="ui-field">Action</span><select data-guide="audit-actions" aria-label="Audit action" value={selectedAction} onChange={event => setSelectedAction(event.target.value)} className="ui-input"><option value="ALL">All actions</option>{uniqueActions.map(value => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label>
          <label className="space-y-1 min-w-0"><span className="ui-field">Target entity</span><select aria-label="Audit entity" value={selectedEntity} onChange={event => setSelectedEntity(event.target.value)} className="ui-input"><option value="ALL">All entities</option>{uniqueEntities.map(value => <option key={value} value={value}>{value.toLowerCase().replace(/_/g, " ")}</option>)}</select></label>
          <label className="space-y-1 min-w-0"><span className="ui-field">Operator</span><select aria-label="Audit operator" value={selectedOperator} onChange={event => setSelectedOperator(event.target.value)} className="ui-input"><option value="">All operators</option>{uniqueOperators.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="space-y-1 min-w-0"><span className="ui-field">Role</span><select aria-label="Audit role" value={selectedRole} onChange={event => setSelectedRole(event.target.value)} className="ui-input"><option value="">All roles</option>{uniqueRoles.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
          <label className="space-y-1 min-w-0"><span className="ui-field">Time period</span><select data-guide="audit-time" aria-label="Audit time period" value={selectedTimeframe} onChange={event => setSelectedTimeframe(event.target.value)} className="ui-input"><option value="ALL">All dates</option><option value="TODAY">Today</option><option value="7DAYS">Last 7 days</option><option value="30DAYS">Last 30 days</option></select></label>
          <label className="space-y-1 min-w-0"><span className="ui-field">From date</span><input aria-label="Audit from date" type="date" max={toDate || undefined} value={fromDate} onChange={event => setFromDate(event.target.value)} className="ui-input min-w-0" /></label>
          <label className="space-y-1 min-w-0"><span className="ui-field">To date</span><input aria-label="Audit to date" type="date" min={fromDate || undefined} value={toDate} onChange={event => setToDate(event.target.value)} className="ui-input min-w-0" /></label>
          <p className="self-end text-xs text-muted pb-3"><strong className="text-indigo">{resultTotal.toLocaleString()}</strong> matching events</p>
        </div>
        {fromDate && toDate && fromDate > toDate && <p role="alert" className="text-xs text-red-700">From date must be on or before the to date.</p>}
      </section>
      </FilterPanel>

      {/* 4. HIGH-END AUDIT LEDGER TABLE */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-indigo" />Activity ledger</h2><span className="text-xs text-muted">Click an event to inspect</span></div>
        {loading && logs.length === 0 ? (
          <TableSkeleton rows={8} columns={5} />
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <ShieldAlert className="w-12 h-12 text-charcoal/20 mx-auto" />
            <h3 className="text-base font-semibold text-charcoal">No matching audit records found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {hasActiveFilters
                ? "Try adjusting your search query, action filters, or timeframe selection."
                : "No administrative operations have been recorded in the database yet."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3.5 py-1.5 bg-indigo-50 text-indigo font-medium rounded-xl text-xs hover:bg-indigo-100 transition-colors cursor-pointer"
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
                  <tr className="border-b border-indigo-100/80 bg-indigo-50 text-indigo font-medium uppercase tracking-wider text-[12px]">
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
                      <tr data-guide="audit-inspect"
                        key={log.id}
                        onClick={() => setInspectLog(log)}
                        className="hover:bg-indigo-50/40 odd:bg-ivory-light/30 transition-colors cursor-pointer group"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-5 text-charcoal/80 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-charcoal text-[12px]">
                              {logDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                            <span className="text-[12px] text-muted font-medium">
                              {logDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </td>

                        {/* Operator User */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo/10 text-indigo font-medium text-[12px] flex items-center justify-center shrink-0 border border-indigo/20 shadow-2xs">
                              {getInitials(log.user_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-charcoal truncate text-xs">{log.user_name || "System Admin"}</p>
                              <span
                                className={`text-[12px] font-medium uppercase px-1.5 py-0.2 rounded border shadow-2xs inline-block ${getRoleBadgeStyle(
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
                          <button data-guide="audit-inspect"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectLog(log);
                            }}
                            className="p-1.5 rounded-lg text-muted group-hover:text-indigo group-hover:bg-indigo-50 transition-all cursor-pointer"
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

          </div>
        )}
        <Pagination label="audit events" page={currentPage} pageSize={pageSize} total={resultTotal} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} loading={loading || refreshing} />
      </div>

      {/* 6. INSPECT AUDIT DETAIL MODAL */}
      {inspectLog && (
        <ViewportOverlay className="z-[100] flex items-center justify-center p-4 sm:p-6 bg-indigo-950/70 backdrop-blur-md overflow-y-auto animate-fade-in">
          <ModalPanel className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-indigo-100 p-6 sm:p-8 space-y-5 animate-scale-up my-auto">
            {/* Close Button */}
            <div data-modal-header className="space-y-5"><button
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
                  <h3 data-guide="audit-details" className="text-lg font-semibold text-charcoal">Audit Transaction #{inspectLog.id}</h3>
                  <p className="text-[12px] text-muted">Immutable Security Ledger Verification</p>
                </div>
              </div>
            </div></div>

            {/* Info Grid */}
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200/80 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-200/60">
                <div>
                  <span className="text-[12px] font-medium uppercase text-muted block mb-0.5">Action Executed</span>
                  {getActionBadge(inspectLog.action)}
                </div>
                <div>
                  <span className="text-[12px] font-medium uppercase text-muted block mb-0.5">Target Entity</span>
                  {getEntityBadge(inspectLog.target_table, inspectLog.target_id)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-200/60">
                <div>
                  <span className="text-[12px] font-medium uppercase text-muted block mb-0.5">Operator Name</span>
                  <p className="font-medium text-charcoal">{inspectLog.user_name || "System"}</p>
                  <span
                    className={`text-[12px] font-medium uppercase px-1.5 py-0.2 rounded border shadow-2xs inline-block mt-1 ${getRoleBadgeStyle(
                      inspectLog.role_name
                    )}`}
                  >
                    {inspectLog.role_name || "System"}
                  </span>
                </div>
                <div>
                  <span className="text-[12px] font-medium uppercase text-muted block mb-0.5">Operator Email</span>
                  <p className="font-medium text-charcoal/80 truncate">{inspectLog.user_email || "N/A"}</p>
                </div>
              </div>

              <div>
                <span className="text-[12px] font-medium uppercase text-muted block mb-0.5">Exact Timestamp</span>
                <p className="font-mono text-[12px] text-indigo font-medium">
                  {new Date(inspectLog.created_at).toLocaleString([], { dateStyle: "full", timeStyle: "medium" })}
                </p>
                <p className="text-[12px] text-muted font-mono mt-0.5">
                  ISO: {new Date(inspectLog.created_at).toISOString()}
                </p>
              </div>

              <div>
                <span className="text-[12px] font-medium uppercase text-muted block mb-1">Details & Description</span>
                <div className="bg-white p-3 rounded-xl border border-gray-200 font-sans text-xs text-charcoal leading-relaxed shadow-2xs">
                  {inspectLog.details || "No additional description metadata was provided for this event."}
                </div>
              </div>
            </div>

            <div data-modal-footer className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-5 py-2.5 bg-indigo hover:bg-indigo-700 text-white font-medium rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </ModalPanel>
        </ViewportOverlay>
      )}
    </div>
  );
};
