import React, { useEffect, useState } from "react";
import {
  Database, Download, UploadCloud, RotateCcw, Trash2, Eye,
  Calendar, Clock, DollarSign, Users, AlertTriangle, ShieldCheck,
  CheckCircle2, RefreshCw, FileText, Sparkles, Layers, ShieldAlert,
  ArrowRight, Lock
} from "lucide-react";
import { api } from "../../api";
import { BackupSummaryResponse, BackupYearStats } from "../../types";
import { DataInspectionModal } from "./DataInspectionModal";
import { PurgeYearModal } from "./PurgeYearModal";
import { RestoreModal } from "./RestoreModal";
import { BackupModal } from "./BackupModal";

interface BackupManagementSectionProps {
  onShowToast: (message: string, type?: "success" | "error") => void;
}

export const BackupManagementSection: React.FC<BackupManagementSectionProps> = ({ onShowToast }) => {
  const [summary, setSummary] = useState<BackupSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Inspector Modal State
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectData, setInspectData] = useState<any>({});
  const [inspectYear, setInspectYear] = useState<number | undefined>(undefined);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // Backup Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [selectedBackupYear, setSelectedBackupYear] = useState<number | "all">("all");
  const [selectedBackupCount, setSelectedBackupCount] = useState<number | undefined>(undefined);

  // Purge Modal State
  const [purgeYear, setPurgeYear] = useState<number | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

  // Restore Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Container Selection state
  const [containerBackupYear, setContainerBackupYear] = useState<string>("all");
  const [containerPurgeYear, setContainerPurgeYear] = useState<string>("");

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await api.getBackupSummary();
      setSummary(res);
      if (res.yearlyBreakdown.length > 0 && !containerPurgeYear) {
        setContainerPurgeYear(String(res.yearlyBreakdown[0].year));
      }
    } catch (err: any) {
      console.error("Failed to load backup summary:", err);
      onShowToast(err.message || "Failed to load backup summary", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBackupModal = (year: number | "all" = "all", count?: number) => {
    setSelectedBackupYear(year);
    if (count !== undefined) {
      setSelectedBackupCount(count);
    } else if (year === "all" && summary) {
      const total = Object.values(summary.totalStats).reduce((a, b) => a + b, 0);
      setSelectedBackupCount(total);
    } else if (typeof year === "number" && summary) {
      const match = summary.yearlyBreakdown.find(y => y.year === year);
      setSelectedBackupCount(match?.totalRecords);
    }
    setIsBackupModalOpen(true);
  };

  const handleInspectYear = async (year: number) => {
    try {
      setLoadingInspect(true);
      setInspectYear(year);
      const res = await api.getBackupYearDetails(year);
      setInspectData(res.tables);
      setIsInspectModalOpen(true);
    } catch (err: any) {
      onShowToast(err.message || "Failed to load year details for inspection", "error");
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleInspectFullLive = async () => {
    try {
      setLoadingInspect(true);
      setInspectYear(undefined);
      const details = await api.getBackupYearDetails(new Date().getFullYear());
      setInspectData(details.tables || {});
      setIsInspectModalOpen(true);
    } catch (err: any) {
      onShowToast(err.message || "Failed to load live records for inspection", "error");
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleOpenPurgeModal = (year: number) => {
    setPurgeYear(year);
    setIsPurgeModalOpen(true);
  };

  const handleConfirmPurge = async (year: number, password: string) => {
    try {
      const res = await api.deleteByYear(year, year, password);
      onShowToast(res.message || `Successfully purged records for year ${year}!`);
      loadSummary();
    } catch (err: any) {
      throw err;
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-indigo-100 shadow-xs flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center space-y-3 text-indigo">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-xs font-bold text-charcoal/60">Loading backup and storage analytics...</p>
        </div>
      </div>
    );
  }

  const yearlyList = summary?.yearlyBreakdown || [];

  return (
    <div className="space-y-8">
      
      {/* 1. Header Overview Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-amber-400/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2.5 rounded-2xl bg-white/10 text-amber-300 border border-white/10">
                <Database className="w-6 h-6" />
              </span>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight">
                Database Backup, Restore & Data Management
              </h2>
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider">
                Password Protected
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-100/75 leading-relaxed font-medium">
              Secure snapshots, full and year-filtered exports, JSON restoration, and annual transactional data archiving with password authorization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleInspectFullLive}
              disabled={loadingInspect}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-300" />
              <span>Inspect Live Data</span>
            </button>
            <button
              onClick={loadSummary}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global DB Stats Cards */}
        {summary?.totalStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-white/10 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Members</div>
              <div className="text-lg font-black text-white">{summary.totalStats.members?.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Attendance Logs</div>
              <div className="text-lg font-black text-white">{summary.totalStats.attendance?.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Events & RSVPs</div>
              <div className="text-lg font-black text-white">{summary.totalStats.events?.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Donations Logged</div>
              <div className="text-lg font-black text-white">{summary.totalStats.donations?.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Duty Schedules</div>
              <div className="text-lg font-black text-white">{((summary.totalStats.duty_schedules || 0) + (summary.totalStats.dishwashing_roster || 0)).toLocaleString()}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Audit History</div>
              <div className="text-lg font-black text-white">{summary.totalStats.audit_logs?.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. THREE PRIMARY ACTION CONTAINERS (BACKUP, RESTORE, DELETE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CONTAINER 1: BACKUP HUB */}
        <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                <Download className="w-6 h-6" />
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100/70 text-amber-900 text-[10px] font-black uppercase">
                Export Hub
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-indigo">1. Backup Database</h3>
              <p className="text-xs text-charcoal/60 leading-relaxed mt-1">
                Export complete system snapshot or select a specific year to generate a standardized JSON archive file.
              </p>
            </div>

            {/* Year Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-charcoal">Select Backup Scope:</label>
              <select
                value={containerBackupYear}
                onChange={(e) => setContainerBackupYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-indigo-100 text-xs font-bold text-charcoal focus:outline-none focus:ring-2 focus:ring-indigo/20 bg-slate-50"
              >
                <option value="all">Full Database (All Years & Tables)</option>
                {yearlyList.map(y => (
                  <option key={y.year} value={String(y.year)}>
                    Year {y.year} ({y.totalRecords.toLocaleString()} records)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => handleOpenBackupModal(containerBackupYear === "all" ? "all" : Number(containerBackupYear))}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Generate Backup</span>
          </button>
        </div>

        {/* CONTAINER 2: RESTORE HUB */}
        <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-3 rounded-2xl bg-indigo-50 text-indigo border border-indigo-100">
                <RotateCcw className="w-6 h-6" />
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100/70 text-indigo-900 text-[10px] font-black uppercase">
                Import Hub
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-indigo">2. Restore from Backup</h3>
              <p className="text-xs text-charcoal/60 leading-relaxed mt-1">
                Upload a verified .json backup file. Preview table counts, choose replace or merge mode, and verify password to restore.
              </p>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100/80 rounded-2xl p-3 text-[11px] text-indigo-950 font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-black text-indigo">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo shrink-0" />
                <span>Supports:</span>
              </div>
              <p>• Clean Database Replacement</p>
              <p>• Safe Conflict-Free Merging</p>
            </div>
          </div>

          <button
            onClick={() => setIsRestoreModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo hover:bg-indigo-950 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-amber-300" />
            <span>Upload & Restore (.json)</span>
          </button>
        </div>

        {/* CONTAINER 3: DELETE / PURGE HUB */}
        <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 text-[10px] font-black uppercase">
                Purge Hub
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950">3. Delete Records by Year</h3>
              <p className="text-xs text-charcoal/60 leading-relaxed mt-1">
                Permanently purge transactional data for an entire year (attendance, giving logs, events, rosters) with double password authorization.
              </p>
            </div>

            {/* Purge Year Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-charcoal">Select Year to Purge:</label>
              <select
                value={containerPurgeYear}
                onChange={(e) => setContainerPurgeYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-rose-50/40"
              >
                {yearlyList.map(y => (
                  <option key={y.year} value={String(y.year)}>
                    Year {y.year} ({y.totalRecords.toLocaleString()} records)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => containerPurgeYear && handleOpenPurgeModal(Number(containerPurgeYear))}
            disabled={!containerPurgeYear}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Preview & Delete Data</span>
          </button>
        </div>

      </div>

      {/* 3. Year-by-Year Management Table & Live Data Inspector */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-indigo-100 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-indigo flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo" />
              <span>Year-by-Year Data Registry ({yearlyList.length} Years Found)</span>
            </h3>
            <p className="text-xs text-charcoal/60">
              Inspect individual tables, download targeted annual backups, or purge historical records.
            </p>
          </div>
          <button
            onClick={loadSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-50 text-xs font-bold text-charcoal/70 transition-all cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo" />
            <span>Refresh Analytics</span>
          </button>
        </div>

        {/* Years Table */}
        <div className="overflow-x-auto border border-indigo-100/80 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-charcoal font-black border-b border-indigo-100">
              <tr>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70">Year</th>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70">Attendance</th>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70">Events</th>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70">Donations & Tithes</th>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70">Duty Rosters</th>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70">Total Activity</th>
                <th className="px-5 py-3 font-bold uppercase text-[10px] tracking-wider text-charcoal/70 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50 bg-white">
              {yearlyList.map((row: BackupYearStats) => {
                const isCurrentYear = row.year === new Date().getFullYear();
                return (
                  <tr key={row.year} className="hover:bg-indigo-50/30 transition-colors">
                    
                    {/* Year Badge */}
                    <td className="px-5 py-4 font-black text-indigo">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black">{row.year}</span>
                        {isCurrentYear && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                            Current Year
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Attendance */}
                    <td className="px-5 py-4 text-charcoal/80">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{row.attendance.toLocaleString()} logs</span>
                      </div>
                    </td>

                    {/* Events */}
                    <td className="px-5 py-4 text-charcoal/80">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{row.events.toLocaleString()} events</span>
                      </div>
                    </td>

                    {/* Donations */}
                    <td className="px-5 py-4 text-charcoal/80">
                      <div>
                        <div className="font-black text-emerald-700">
                          ₱{row.donationsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-charcoal/50">
                          {row.donationsCount} gifts recorded
                        </div>
                      </div>
                    </td>

                    {/* Duty Rosters */}
                    <td className="px-5 py-4 text-charcoal/80">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{(row.dutySchedules + row.dishwashingRoster).toLocaleString()} shifts</span>
                      </div>
                    </td>

                    {/* Total Records */}
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-100 font-black text-xs">
                        {row.totalRecords.toLocaleString()} records
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Inspect Modal Trigger */}
                        <button
                          onClick={() => handleInspectYear(row.year)}
                          disabled={loadingInspect}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo text-xs font-bold transition-all cursor-pointer"
                          title={`Inspect ${row.year} records in modal`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>

                        {/* Backup Year */}
                        <button
                          onClick={() => handleOpenBackupModal(row.year, row.totalRecords)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-bold transition-all cursor-pointer"
                          title={`Download ${row.year} backup file`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Backup</span>
                        </button>

                        {/* Delete / Purge Year */}
                        <button
                          onClick={() => handleOpenPurgeModal(row.year)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-bold transition-all cursor-pointer"
                          title={`Purge/Delete ${row.year} data`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Purge</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* 1. Password Verification Backup Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        year={selectedBackupYear}
        recordCount={selectedBackupCount}
        onSuccess={(msg) => onShowToast(msg)}
      />

      {/* 2. Data Inspection Modal */}
      <DataInspectionModal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        year={inspectYear}
        data={inspectData}
        onExportYear={(y) => handleOpenBackupModal(y)}
        onDeleteYear={(y) => handleOpenPurgeModal(y)}
      />

      {/* 3. Safety Purge Year Modal */}
      <PurgeYearModal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        year={purgeYear}
        onConfirmPurge={handleConfirmPurge}
      />

      {/* 4. Restore Modal */}
      <RestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onRestoreSuccess={() => {
          onShowToast("Database successfully restored from backup!");
          loadSummary();
        }}
      />

    </div>
  );
};
