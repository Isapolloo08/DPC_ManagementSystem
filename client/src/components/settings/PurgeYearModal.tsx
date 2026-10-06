import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, ShieldAlert, AlertTriangle, Trash2, CheckCircle2,
  Calendar, Clock, Users, MessageSquare, Database, RefreshCw, Eye,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { api } from "../../api";

interface PurgeYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number | null;
  onConfirmPurge: (year: number, password: string) => Promise<void>;
}

export const PurgeYearModal: React.FC<PurgeYearModalProps> = ({
  isOpen,
  onClose,
  year,
  onConfirmPurge
}) => {
  if (!isOpen || !year) return null;

  const [inputYear, setInputYear] = useState("");
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live records preview for the year to be purged
  const [yearData, setYearData] = useState<Record<string, any[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("events");

  // Drag and Scroll State for Tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  const isMatched = inputYear.trim() === String(year);

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
  }, [yearData]);

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
    if (year) {
      loadYearData();
    }
  }, [year]);

  const loadYearData = async () => {
    if (!year) return;
    setLoadingData(true);
    try {
      const res = await api.getBackupYearDetails(year);
      setYearData(res.tables || {});
      const keys = Object.keys(res.tables || {});
      if (keys.length > 0) setActiveTab(keys[0]);
    } catch (err) {
      console.warn("Could not load year details for purge modal:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched) {
      setError(`Please type ${year} to confirm deletion.`);
      return;
    }
    if (!password.trim()) {
      setError("Please enter your account password to authorize deletion.");
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmPurge(year, password);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to purge year records. Verify your password.");
    } finally {
      setIsDeleting(false);
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

  const availableKeys = Object.keys(yearData).filter(k => Array.isArray(yearData[k]));
  const currentTabRecords = yearData[activeTab] || [];
  const totalRecordsToPurge = availableKeys.reduce((acc, k) => acc + (yearData[k]?.length || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div data-modal-panel className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-rose-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div data-modal-header className="p-6 border-b border-rose-100 flex items-center justify-between gap-4 bg-rose-50">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-charcoal">
                  Purge Data for Year {year}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-medium">
                  {totalRecordsToPurge} Records Target
                </span>
              </div>
              <p className="text-xs text-rose-600 font-medium">
                Review data to be deleted & enter password to confirm.
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
          
          {/* Warning Card */}
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-950 space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Warning: Irreversible Deletion</span>
            </div>
            <p className="text-[12px] text-rose-900/90 leading-relaxed font-medium">
              This will permanently delete all attendance logs, events, duty schedules, and announcements for <strong>Year {year}</strong>.
            </p>
          </div>

          {/* Data to be Purged Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-rose-600" />
                <span>Records in Year {year} ({availableKeys.length} Tables)</span>
              </label>
              {loadingData && (
                <span className="text-[12px] text-rose-600 font-medium flex items-center gap-1">
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
                    ? "bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-sm active:scale-95 opacity-100"
                    : "bg-slate-100/60 text-charcoal/20 border-transparent cursor-not-allowed opacity-30"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Scrollable & Draggable Tabs Container */}
              <div
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
                  const count = yearData[k]?.length || 0;
                  const isSelected = activeTab === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => !isDragging && setActiveTab(k)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-300/40"
                          : "bg-slate-100 hover:bg-rose-50/70 text-charcoal/80 border border-slate-200/80 hover:border-rose-200"
                      }`}
                    >
                      <span>{getTableIcon(k)}</span>
                      <span>{formatTableName(k)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${
                        isSelected ? "bg-white/20 text-white" : "bg-rose-100 text-rose-900"
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
                    ? "bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-sm active:scale-95 opacity-100"
                    : "bg-slate-100/60 text-charcoal/20 border-transparent cursor-not-allowed opacity-30"
                }`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Table Records Preview Box */}
            <div className="border border-slate-200 rounded-2xl bg-slate-50/50 p-3 max-h-36 overflow-y-auto text-xs">
              {currentTabRecords.length === 0 ? (
                <p className="text-muted text-center py-4 font-medium text-[12px]">
                  No records in this table for Year {year}.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentTabRecords.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 text-[12px] flex items-center justify-between gap-2 shadow-2xs">
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
                      + {currentTabRecords.length - 5} more records will be purged
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form with Verification Input & Password */}
          <form data-guide="purge-confirmation" id="purge-form" onSubmit={handleConfirm} className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-charcoal flex items-center justify-between">
                <span>To confirm, type <span className="underline text-rose-600 font-medium">{year}</span> below:</span>
              </label>
              <input
                type="text"
                placeholder={`Type ${year} here`}
                value={inputYear}
                onChange={(e) => {
                  setInputYear(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs font-medium text-center tracking-widest"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-charcoal">
                Enter Account Password:
              </label>
              <input
                type="password"
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            )}
          </form>

        </div>

        {/* Footer */}
        <div data-modal-footer className="p-4 border-t border-rose-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-charcoal/70 hover:bg-white transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button data-guide="purge-execute"
            type="submit"
            form="purge-form"
            disabled={!isMatched || !password.trim() || isDeleting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-medium shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? "Purging Records..." : `Purge Year ${year} Data`}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
