import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Download, ShieldCheck, Lock, Database, CheckCircle2,
  AlertCircle, Calendar, Clock, Users, MessageSquare,
  Eye, RefreshCw, Layers, ChevronLeft, ChevronRight
} from "lucide-react";
import { api } from "../../api";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  year?: number | "all";
  recordCount?: number;
  onSuccess: (message: string) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  year = "all",
  recordCount,
  onSuccess
}) => {
  if (!isOpen) return null;

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Data Preview State
  const [previewTables, setPreviewTables] = useState<Record<string, any[]>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<string>("attendance");

  // Drag and Scroll State for Tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  const isFull = !year || year === "all";

  const checkScroll = () => {
    const el = tabsContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 5);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = tabsContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [previewTables]);

  const scrollTabs = (direction: "left" | "right") => {
    const el = tabsContainerRef.current;
    if (el) {
      const scrollAmount = direction === "left" ? -180 : 180;
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setIsDragging(true);
    setDragStartX(e.pageX - el.offsetLeft);
    setDragScrollLeft(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const el = tabsContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    el.scrollLeft = dragScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    loadDataPreview();
  }, [year]);

  const loadDataPreview = async () => {
    setLoadingPreview(true);
    try {
      if (typeof year === "number") {
        const details = await api.getBackupYearDetails(year);
        setPreviewTables(details.tables || {});
        const keys = Object.keys(details.tables || {});
        if (keys.length > 0) setActivePreviewTab(keys[0]);
      } else {
        const currentY = new Date().getFullYear();
        const details = await api.getBackupYearDetails(currentY);
        setPreviewTables(details.tables || {});
        const keys = Object.keys(details.tables || {});
        if (keys.length > 0) setActivePreviewTab(keys[0]);
      }
    } catch (err) {
      console.warn("Could not load preview details for backup modal:", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your account password to verify authorization.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.exportBackup(year, password);
      
      // Trigger browser file download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dpc_backup_${!isFull ? `year_${year}` : 'full'}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onSuccess(`Backup export for ${!isFull ? `year ${year}` : 'full database'} downloaded successfully!`);
      setPassword("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to generate backup export. Verify your password.");
    } finally {
      setLoading(false);
    }
  };

  const getTableIcon = (name: string) => {
    switch (name) {
      case "attendance": return <Clock className="w-3.5 h-3.5 text-emerald-600" />;
      case "events": return <Calendar className="w-3.5 h-3.5 text-indigo-600" />;
      case "duty_schedules":
      case "dishwashing_roster": return <Users className="w-3.5 h-3.5 text-blue-600" />;
      case "announcements": return <MessageSquare className="w-3.5 h-3.5 text-purple-600" />;
      default: return <Database className="w-3.5 h-3.5 text-muted" />;
    }
  };

  const formatTableName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const availableKeys = Object.keys(previewTables).filter(k => Array.isArray(previewTables[k]));
  const currentTabRecords = previewTables[activePreviewTab] || [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div data-modal-panel className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-indigo-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div data-modal-header className="p-6 border-b border-indigo-100 flex items-center justify-between gap-4 bg-amber-50/60">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-400 text-indigo-950 shadow-md">
              <Download className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-indigo tracking-tight">
                  {isFull ? "Generate Full Database Backup" : `Generate Backup — Year ${year}`}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium">
                  {isFull ? "All Tables" : `Year ${year}`}
                </span>
              </div>
              <p className="text-xs text-muted font-medium">
                Review data preview below and enter password to authorize download.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-muted hover:text-charcoal transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Scope Card */}
          <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-4 text-xs space-y-2 text-charcoal/80">
            <div className="flex items-center justify-between font-medium">
              <span className="text-muted">Backup Target:</span>
              <span className="font-medium text-indigo">
                {isFull ? "Entire Database Snapshot" : `Historical Records for Year ${year}`}
              </span>
            </div>
            {recordCount !== undefined && (
              <div className="flex items-center justify-between font-medium pt-1 border-t border-indigo-50">
                <span className="text-muted">Total Estimated Records:</span>
                <span className="font-medium text-emerald-700">{recordCount.toLocaleString()} rows</span>
              </div>
            )}
          </div>

          {/* Data Breakdown & Live Inspection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-indigo flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo" />
                <span>Year Data Breakdown ({availableKeys.length} Tables)</span>
              </label>
              {loadingPreview && (
                <span className="text-[12px] text-indigo font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading data...
                </span>
              )}
            </div>

            {/* Table Tabs Strip with Left/Right Buttons and Drag-to-Scroll */}
            <div className="relative flex items-center gap-1.5 group/tabstrip">
              {/* Scroll Left Button */}
              <button
                type="button"
                onClick={() => scrollTabs("left")}
                disabled={!canScrollLeft}
                title="Scroll Left"
                aria-label="Scroll tabs left"
                className={`shrink-0 z-10 w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                  canScrollLeft
                    ? "bg-white hover:bg-indigo-50 text-indigo border-indigo-200 shadow-sm active:scale-95 opacity-100"
                    : "bg-slate-100/60 text-charcoal/20 border-transparent cursor-not-allowed opacity-30"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Scrollable & Draggable Tabs Container */}
              <div data-guide="backup-preview-tabs"
                ref={tabsContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className={`flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 select-none ${
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {availableKeys.map(k => {
                  const count = previewTables[k]?.length || 0;
                  const isSelected = activePreviewTab === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => !isDragging && setActivePreviewTab(k)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-indigo text-white shadow-sm ring-2 ring-indigo-300/40"
                          : "bg-slate-100 hover:bg-indigo-50/70 text-charcoal/80 border border-slate-200/80 hover:border-indigo-200"
                      }`}
                    >
                      <span>{getTableIcon(k)}</span>
                      <span>{formatTableName(k)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${
                        isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo border border-indigo-100/60"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Scroll Right Button */}
              <button
                type="button"
                onClick={() => scrollTabs("right")}
                disabled={!canScrollRight}
                title="Scroll Right"
                aria-label="Scroll tabs right"
                className={`shrink-0 z-10 w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                  canScrollRight
                    ? "bg-white hover:bg-indigo-50 text-indigo border-indigo-200 shadow-sm active:scale-95 opacity-100"
                    : "bg-slate-100/60 text-charcoal/20 border-transparent cursor-not-allowed opacity-30"
                }`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Table Sample Preview Box */}
            <div className="border border-indigo-100 rounded-2xl bg-slate-50/50 p-3 max-h-40 overflow-y-auto text-xs">
              {currentTabRecords.length === 0 ? (
                <p className="text-muted text-center py-4 font-medium text-[12px]">
                  No records found in this table for the selected year.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentTabRecords.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-xl border border-indigo-50 text-[12px] flex items-center justify-between gap-2 shadow-2xs">
                      <span className="font-medium text-charcoal truncate">
                        {row.title || row.member_name || row.assigned_name || row.team_name || row.first_name || `Record #${row.id}`}
                      </span>
                      <span className="text-[12px] font-mono text-muted shrink-0">
                        {row.start_time || row.checked_in_at || row.donated_at || row.duty_date || row.created_at || ""}
                      </span>
                    </div>
                  ))}
                  {currentTabRecords.length > 5 && (
                    <p className="text-[12px] text-muted text-center font-medium pt-1">
                      + {currentTabRecords.length - 5} more records will be exported
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form with Password input */}
          <form data-guide="backup-auth" id="backup-auth-form" onSubmit={handleExecuteBackup} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo" />
                <span>Enter Account Password to Authorize Backup:</span>
              </label>
              <input
                type="password"
                placeholder="Enter your current account password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo text-xs text-charcoal"
              />
            </div>
          </form>

        </div>

        {/* Footer */}
        <div data-modal-footer className="p-4 border-t border-indigo-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-charcoal/70 hover:bg-white transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button data-guide="backup-download"
            type="submit"
            form="backup-auth-form"
            disabled={loading || !password.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-indigo-950 text-xs font-medium shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Generating Backup..." : "Generate & Download Backup"}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
