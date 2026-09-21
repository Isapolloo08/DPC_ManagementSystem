import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import {
  AttendanceLogItem,
  AttendanceLogSummary,
  AttendanceLogType,
  AttendanceLogStatus,
  Ministry,
  BibleStudyGroup
} from "../types";
import {
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  Layers,
  HeartHandshake,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Sparkles,
  Info,
  Loader2,
  UserCheck,
  PartyPopper
} from "lucide-react";

// Helper to get default last 90 days in YYYY-MM-DD
function getDefaultDateRange(): { fromDate: string; toDate: string } {
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const now = new Date(today);
    const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(past90);
    return { fromDate: from, toDate: today };
  } catch {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { fromDate: past90, toDate: today };
  }
}

export const AttendanceLogPage: React.FC = () => {
  const { user } = useAuth();
  const defaultDates = getDefaultDateRange();

  // Filters State
  const [fromDate, setFromDate] = useState<string>(defaultDates.fromDate);
  const [toDate, setToDate] = useState<string>(defaultDates.toDate);
  const [logType, setLogType] = useState<AttendanceLogType | "">("");
  const [status, setStatus] = useState<AttendanceLogStatus | "">("");
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");
  const pageSize = 50;

  // Data State
  const [rows, setRows] = useState<AttendanceLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [summary, setSummary] = useState<AttendanceLogSummary>({
    total: 0,
    present: 0,
    absent: 0,
    excused: 0
  });

  // Reference Options
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [groups, setGroups] = useState<BibleStudyGroup[]>([]);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // In-flight request cancellation reference
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Reference Ministries & Groups for dropdowns
  useEffect(() => {
    let isMounted = true;
    async function loadMetadata() {
      try {
        const [minsData, groupsData] = await Promise.all([
          api.getMinistries().catch(() => []),
          api.getGroups().catch(() => [])
        ]);
        if (isMounted) {
          setMinistries(minsData || []);
          setGroups(groupsData || []);
        }
      } catch (err) {
        console.error("Failed to load reference dropdown data:", err);
      }
    }
    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Attendance Log Data
  const fetchAttendanceLog = useCallback(async () => {
    // Abort previous in-flight request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await api.getAttendanceLog(
        {
          from: fromDate,
          to: toDate,
          type: logType,
          status: status,
          ministryId: selectedMinistryId,
          groupId: selectedGroupId,
          search: debouncedSearch,
          page,
          pageSize
        },
        controller.signal
      );

      setRows(res.rows || []);
      setTotal(res.total || 0);
      setSummary(res.summary || { total: 0, present: 0, absent: 0, excused: 0 });
    } catch (err: any) {
      if (err.name === "AbortError") {
        return; // Request was aborted by user filter update
      }
      console.error("Failed to fetch attendance log:", err);
      setError(err.message || "Failed to load attendance logs. Please check server connection.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, logType, status, selectedMinistryId, selectedGroupId, debouncedSearch, page]);

  // Trigger fetch whenever active filters or page change
  useEffect(() => {
    fetchAttendanceLog();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAttendanceLog]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    const fresh = getDefaultDateRange();
    setFromDate(fresh.fromDate);
    setToDate(fresh.toDate);
    setLogType("");
    setStatus("");
    setSelectedMinistryId("all");
    setSelectedGroupId("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setPage(1);
  };

  // CSV Export Handler
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const blob = await api.exportAttendanceLogCsv({
        from: fromDate,
        to: toDate,
        type: logType,
        status: status,
        ministryId: selectedMinistryId,
        groupId: selectedGroupId,
        search: debouncedSearch
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-log_${fromDate}_${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("CSV Export error:", err);
      alert(`CSV Export Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // PDF Export Handler (Dynamic import of jspdf and jspdf-autotable)
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      // 1. Fetch up to 5,000 records with current filters
      const dataRes = await api.getAttendanceLog({
        from: fromDate,
        to: toDate,
        type: logType,
        status: status,
        ministryId: selectedMinistryId,
        groupId: selectedGroupId,
        search: debouncedSearch,
        page: 1,
        pageSize: 5000
      });

      const exportRows = dataRes.rows || [];
      const totalCount = dataRes.total || 0;

      // 2. Dynamically load jspdf and jspdf-autotable
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = (autoTableModule.default || autoTableModule) as any;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Branding
      doc.setFillColor(44, 57, 104); // #2C3968 - Indigo
      doc.rect(0, 0, pageWidth, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("DAET PRESBYTERIAN CHURCH", 14, 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(217, 164, 65); // #D9A441 - Amber
      doc.text("Church Management System — Unified Attendance Log Report", 14, 18);

      // Period and active filter info
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      const periodText = `Period: ${fromDate} to ${toDate}`;
      const typeFilterText = logType ? ` | Type: ${logType === "sunday_service" ? "Sunday Service" : "Bible Study"}` : " | Type: All";
      const statusFilterText = status ? ` | Status: ${status.toUpperCase()}` : "";
      const searchFilterText = debouncedSearch ? ` | Search: "${debouncedSearch}"` : "";

      doc.text(`${periodText}${typeFilterText}${statusFilterText}${searchFilterText}`, 14, 31);

      // Summary totals row
      const summaryText = `Totals — Records: ${totalCount} | Present: ${dataRes.summary.present} | Absent: ${dataRes.summary.absent} | Excused: ${dataRes.summary.excused}`;
      doc.setFont("helvetica", "bold");
      doc.text(summaryText, 14, 36);

      // Warning note if total records exceed the 5000 max export limit
      let startY = 40;
      if (totalCount > exportRows.length) {
        doc.setTextColor(184, 92, 86); // Muted Rose
        doc.setFontSize(8);
        doc.text(`* Notice: Showing first ${exportRows.length.toLocaleString()} of ${totalCount.toLocaleString()} matching records. Use narrower date or category filters for exhaustive exports.`, 14, startY);
        startY += 5;
      }

      // Prepare Table Data
      const tableHeaders = [
        ["#", "Date", "Type", "Member Name", "Ministry", "Bible Study Group / Event", "Status", "Recorded At"]
      ];

      const tableBody = exportRows.map((r, idx) => {
        let typeLabel = "Sunday Service";
        let contextLabel = "-";
        if (r.logType === "bible_study") {
          typeLabel = "Bible Study";
          contextLabel = r.groupName || "-";
        } else if (r.logType === "event") {
          typeLabel = "Special Event";
          contextLabel = r.eventName || "Event";
        }

        const statusLabel = r.status.toUpperCase();
        return [
          String(idx + 1),
          r.logDate,
          typeLabel,
          r.memberName,
          r.ministryName || "Unassigned",
          contextLabel,
          statusLabel,
          r.recordedAt ? new Date(r.recordedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-"
        ];
      });

      // Render autotable with custom status colors
      autoTable(doc, {
        head: tableHeaders,
        body: tableBody,
        startY: startY,
        theme: "grid",
        headStyles: {
          fillColor: [44, 57, 104],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "left"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40]
        },
        alternateRowStyles: {
          fillColor: [248, 247, 244] // Soft Ivory
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 22 },
          2: { cellWidth: 28 },
          3: { cellWidth: 48, fontStyle: "bold" },
          4: { cellWidth: 32 },
          5: { cellWidth: 42 },
          6: { cellWidth: 22, halign: "center", fontStyle: "bold" },
          7: { cellWidth: 24, halign: "center" }
        },
        didParseCell: (data: any) => {
          // Color-code the Status cell
          if (data.section === "body" && data.column.index === 6) {
            const val = String(data.cell.raw).toUpperCase();
            if (val === "PRESENT") {
              data.cell.styles.textColor = [16, 122, 60]; // Green
            } else if (val === "ABSENT") {
              data.cell.styles.textColor = [184, 92, 86]; // Rose/Red
            } else if (val === "EXCUSED") {
              data.cell.styles.textColor = [217, 164, 65]; // Amber
            }
          }
        },
        didDrawPage: (data: any) => {
          // Footer: Generated date & Page X of Y
          const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
          const generatedDateStr = `Generated on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;

          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text(generatedDateStr, 14, doc.internal.pageSize.getHeight() - 8);
          doc.text(str, pageWidth - 14 - doc.getTextWidth(str), doc.internal.pageSize.getHeight() - 8);
        }
      });

      doc.save(`attendance-log_${fromDate}_${toDate}.pdf`);
    } catch (err: any) {
      console.error("PDF Export error:", err);
      alert(`PDF Export Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p);
      setJumpPageInput("");
    }
  };

  const isLeaderRole = user?.role_name === "Leader";
  const isCoordinatorRole = user?.role_name === "Coordinator";

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-stone-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2.5 bg-indigo/10 rounded-xl text-indigo border border-indigo/20">
              <UserCheck className="w-6 h-6 text-indigo" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-charcoal">Attendance Log</h1>
              <p className="text-xs sm:text-sm font-medium text-stone-500">
                Unified audit history of Sunday service check-ins, Bible Study attendance, and Special Events.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: CSV & PDF */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCsv}
            disabled={isExportingCsv || loading || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download UTF-8 CSV with Excel compatibility"
          >
            {isExportingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf || loading || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo hover:bg-indigo-900 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate print-ready formatted PDF report"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Records</span>
            <Layers className="w-4 h-4 text-indigo" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-indigo">
            {loading ? "..." : summary.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-600 font-semibold mt-1">Filtered timeframe</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Present</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700">
            {loading ? "..." : summary.present.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {summary.total > 0 ? `${((summary.present / summary.total) * 100).toFixed(1)}% of total` : "0%"}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Absent</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-700">
            {loading ? "..." : summary.absent.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">Bible Study records</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Excused</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-700">
            {loading ? "..." : summary.excused.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">Notice filed</div>
        </div>
      </div>

      {/* Explanatory Note Banner */}
      <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span>Sunday records reflect service check-ins (present). Absent and excused statuses apply to Bible Study and small group sessions.</span>
          {isLeaderRole && (
            <span className="ml-1 font-bold text-amber-950">Leader View: Displaying records scoped to the Bible Study groups you facilitate.</span>
          )}
          {isCoordinatorRole && (
            <span className="ml-1 font-bold text-amber-950">Coordinator View: Displaying records scoped to your assigned ministries.</span>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2 text-sm font-bold text-charcoal">
            <Filter className="w-4 h-4 text-indigo" />
            <span>Search & Filter Options</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-stone-500 hover:text-indigo inline-flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* From Date */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              From Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition"
              />
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              To Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition"
              />
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              Attendance Type
            </label>
            <select
              value={logType}
              disabled={isLeaderRole} // Leaders are automatically scoped to Bible Study
              onChange={(e) => {
                setLogType(e.target.value as AttendanceLogType | "");
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition disabled:opacity-60"
            >
              <option value="">All Types (Sunday, Bible Study & Events)</option>
              <option value="sunday_service">Sunday Worship Service</option>
              <option value="bible_study">Bible Study / Small Group</option>
              <option value="event">Special Event / Celebration</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AttendanceLogStatus | "");
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>

          {/* Ministry Filter */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              Ministry
            </label>
            <select
              value={selectedMinistryId}
              disabled={isLeaderRole}
              onChange={(e) => {
                setSelectedMinistryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition disabled:opacity-60"
            >
              <option value="all">All Ministries</option>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bible Study Group Filter */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              Bible Study Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.leader_name})
                </option>
              ))}
            </select>
          </div>

          {/* Member Name Search (2 columns on lg) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-600 mb-1">
              Search Member Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by first name or last name (e.g., Juan, Santos)..."
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-charcoal focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition placeholder:text-stone-400"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 text-xs font-bold p-0.5 rounded-full"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        {/* Table Loading Overlay or Skeleton */}
        {loading && (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo mx-auto mb-3" />
            <p className="text-xs font-bold text-stone-500">Loading attendance logs...</p>
          </div>
        )}

        {/* Error Message */}
        {!loading && error && (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <div className="text-sm font-bold text-rose-800">{error}</div>
            <button
              onClick={() => fetchAttendanceLog()}
              className="px-4 py-2 bg-indigo text-white text-xs font-bold rounded-xl hover:bg-indigo-900 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && rows.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto text-stone-400 border border-stone-200">
              <UserCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-charcoal">No attendance records found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              There are no attendance records matching your selected date range and filter criteria. Try expanding your date range or clearing search keywords.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-charcoal text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/90 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Date</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Member Name</th>
                  <th className="py-3.5 px-4">Ministry</th>
                  <th className="py-3.5 px-4">Group / Event</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Recorded Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {rows.map((row, idx) => {
                  const isSunday = row.logType === "sunday_service";
                  const isBs = row.logType === "bible_study";
                  const isEvent = row.logType === "event";

                  return (
                    <tr
                      key={`${row.logType}-${row.memberId}-${row.logDate}-${idx}`}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 sm:px-6 font-bold text-charcoal whitespace-nowrap">
                        {row.logDate}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSunday && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo rounded-lg text-[11px] font-bold border border-indigo-100">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Sunday Service</span>
                          </span>
                        )}
                        {isBs && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 rounded-lg text-[11px] font-bold border border-amber-200/60">
                            <HeartHandshake className="w-3 h-3 text-amber-600" />
                            <span>Bible Study</span>
                          </span>
                        )}
                        {isEvent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-900 rounded-lg text-[11px] font-bold border border-purple-200/60">
                            <PartyPopper className="w-3 h-3 text-purple-600" />
                            <span>Special Event</span>
                          </span>
                        )}
                      </td>

                      {/* Member Name */}
                      <td className="py-3 px-4 font-bold text-charcoal">
                        {row.memberName}
                      </td>

                      {/* Ministry */}
                      <td className="py-3 px-4 text-stone-600 font-medium">
                        {row.ministryName || "Unassigned"}
                      </td>

                      {/* Group / Event Context Name */}
                      <td className="py-3 px-4 text-stone-600 font-medium">
                        {isBs && (row.groupName || <span className="text-stone-300">-</span>)}
                        {isEvent && (
                          <span className="font-semibold text-purple-900">
                            {row.eventName || "Special Event"}
                          </span>
                        )}
                        {isSunday && <span className="text-stone-300">-</span>}
                      </td>

                      {/* Status Colored Badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {row.status === "present" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Present</span>
                          </span>
                        )}
                        {row.status === "absent" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Absent</span>
                          </span>
                        )}
                        {row.status === "excused" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Excused</span>
                          </span>
                        )}
                      </td>

                      {/* Recorded Time */}
                      <td className="py-3 px-4 sm:px-6 text-right text-stone-600 font-semibold whitespace-nowrap">
                        {row.recordedAt ? new Date(row.recordedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination Footer */}
        {!loading && !error && rows.length > 0 && (
          <div className="bg-stone-50 border-t border-stone-200 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="text-stone-500 font-medium">
              Showing <span className="font-bold text-charcoal">{((page - 1) * pageSize) + 1}</span> to{" "}
              <span className="font-bold text-charcoal">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="font-bold text-charcoal">{total.toLocaleString()}</span> records
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* First & Prev */}
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-charcoal">
                Page {page} of {totalPages}
              </span>

              {/* Next & Last */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>

              {/* Jump to page form */}
              {totalPages > 1 && (
                <form onSubmit={handleJumpPage} className="flex items-center gap-1.5 ml-2">
                  <span className="text-stone-600 font-semibold">Go:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    placeholder="#"
                    className="w-12 px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-bold text-charcoal outline-none focus:border-indigo"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-stone-200 hover:bg-stone-300 rounded-lg text-xs font-bold text-charcoal transition"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceLogPage;
