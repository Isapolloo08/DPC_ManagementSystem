import React, { useEffect, useState } from "react";
import { Database, Download, UploadCloud, RotateCcw, Trash2, Eye, Calendar, AlertTriangle, ShieldCheck, RefreshCw, FileJson, ArrowRight, Cloud, Lock } from "lucide-react";
import { api } from "../../api";
import { BackupSummaryResponse, CloudSyncStatusResponse } from "../../types";
import { Button } from "../common/Button";
import { DataInspectionModal } from "./DataInspectionModal";
import { PurgeYearModal } from "./PurgeYearModal";
import { RestoreModal } from "./RestoreModal";
import { BackupModal } from "./BackupModal";
import { CloudSyncModal } from "../cloud/CloudSyncModal";
import { useAuth } from "../../context/AuthContext";

interface BackupManagementSectionProps {
  onShowToast: (message: string, type?: "success" | "error") => void;
}

export const BackupManagementSection: React.FC<BackupManagementSectionProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role_name === "Admin" || user?.role_name === "IT Admin";
  const [summary, setSummary] = useState<BackupSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectData, setInspectData] = useState<Record<string, any[]>>({});
  const [inspectYear, setInspectYear] = useState<number>();
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [selectedBackupYear, setSelectedBackupYear] = useState<number | "all">("all");
  const [selectedBackupCount, setSelectedBackupCount] = useState<number>();
  const [purgeYear, setPurgeYear] = useState<number | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatusResponse | null>(null);
  const [containerBackupYear, setContainerBackupYear] = useState("all");
  const [containerPurgeYear, setContainerPurgeYear] = useState("");

  useEffect(() => { void loadSummary(); }, []);

  const loadSummary = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [res, cloudRes] = await Promise.all([api.getBackupSummary(), api.getCloudSyncStatus().catch(() => null)]);
      setSummary(res);
      setCloudSyncStatus(cloudRes);
      if (containerBackupYear !== "all" && !res.yearlyBreakdown.some(row => String(row.year) === containerBackupYear)) setContainerBackupYear("all");
      if (!res.yearlyBreakdown.some(row => String(row.year) === containerPurgeYear)) setContainerPurgeYear("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load database overview.";
      setLoadError(message);
      onShowToast(message, "error");
    } finally { setLoading(false); }
  };

  const handleOpenBackupModal = (year: number | "all" = "all") => {
    setSelectedBackupYear(year);
    setSelectedBackupCount(year === "all"
      ? summary ? Object.values(summary.totalStats).reduce((a, b) => a + b, 0) : undefined
      : summary?.yearlyBreakdown.find(row => row.year === year)?.totalRecords);
    setIsBackupModalOpen(true);
  };

  const handleInspectYear = async (year: number) => {
    setLoadingInspect(true);
    try {
      const res = await api.getBackupYearDetails(year);
      setInspectYear(year);
      setInspectData(res.tables);
      setIsInspectModalOpen(true);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : "Unable to load records for inspection.", "error");
    } finally { setLoadingInspect(false); }
  };

  const handleOpenPurgeModal = (year: number) => {
    if (!isSuperAdmin) { onShowToast("Deleting records requires administrator authorization.", "error"); return; }
    setPurgeYear(year);
    setIsPurgeModalOpen(true);
  };

  const handleConfirmPurge = async (year: number, password: string) => {
    const res = await api.deleteByYear(year, year, password);
    onShowToast(res.message || `Records for ${year} deleted successfully.`);
    await loadSummary();
  };

  if (loading && !summary) return (
    <div role="status" className="bg-white rounded-2xl p-8 border border-indigo-100 flex items-center justify-center gap-3 min-h-[240px] text-muted">
      <RefreshCw aria-hidden="true" className="w-5 h-5 animate-spin text-indigo" /> Loading database overview…
    </div>
  );

  const yearlyList = summary?.yearlyBreakdown || [];
  const total = summary?.totalStats;
  const scopeYear = containerBackupYear === "all" ? "all" : Number(containerBackupYear);
  const scopeCount = scopeYear === "all" ? total && Object.values(total).reduce((a, b) => a + b, 0)
    : yearlyList.find(row => row.year === scopeYear)?.totalRecords;
  const currentYear = new Date().getFullYear();
  const cloudStatus = !cloudSyncStatus ? "Status unavailable" : cloudSyncStatus.connected ? "Connected" : cloudSyncStatus.configured ? "Offline" : "Setup required";
  const cloudStatusClass = cloudSyncStatus?.connected ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : cloudSyncStatus?.configured ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-muted border-slate-200";

  return (
    <section aria-label="Backup and data workspace" className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold text-indigo-950">Backup & recovery</h2>
          <p className="text-xs text-muted mt-1">Keep a local copy of your data, or recover from a saved backup.</p></div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Lock aria-hidden="true" className="w-3.5 h-3.5" /> Password authorization</span>
          <Button size="sm" pending={loading} onClick={() => void loadSummary()} aria-label="Refresh database overview">
            {!loading && <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />} Refresh
          </Button>
        </div>
      </div>
      {loadError && <div role="alert" className="ui-error flex items-start gap-2"><AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" /><span>{loadError} {summary ? "Showing the previous overview. Refresh to try again." : "Refresh to try again."}</span></div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-indigo-100 bg-white overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 flex-1 space-y-5">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-xl bg-amber-50 text-amber-700"><Download aria-hidden="true" className="w-5 h-5" /></span>
              <div><h3 data-guide="backup-create" className="text-base font-semibold text-indigo-950">Create a backup</h3><p className="text-xs text-muted mt-1">Download a JSON file to keep in a secure location.</p></div>
            </div>
            <div className="space-y-2">
              <label htmlFor="backup-scope" className="ui-field">What would you like to back up?</label>
              <select id="backup-scope" data-guide="backup-scope" className="ui-input" value={containerBackupYear} disabled={!summary || loading} onChange={event => setContainerBackupYear(event.target.value)}>
                <option value="all">Full database · all years & tables</option>
                {yearlyList.map(row => <option key={row.year} value={row.year}>{row.year} · {row.totalRecords.toLocaleString()} activity records</option>)}
              </select>
              <p className="text-xs text-muted" aria-live="polite">{scopeYear === "all" ? "Includes all system tables and settings." : `Includes activity records for ${scopeYear}.`} {scopeCount !== undefined && <span className="text-charcoal font-medium tabular-nums">{scopeCount.toLocaleString()} records</span>}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted"><FileJson aria-hidden="true" className="w-4 h-4" /> JSON backup file</span>
              <Button data-guide="backup-open" variant="primary" disabled={!summary || loading} onClick={() => handleOpenBackupModal(scopeYear)}><Download aria-hidden="true" className="w-4 h-4" /> Create backup <ArrowRight aria-hidden="true" className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="px-5 sm:px-6 py-3 border-t border-indigo-100 bg-slate-50 flex items-center gap-2 text-xs text-muted"><ShieldCheck aria-hidden="true" className="w-4 h-4 text-sage-600 shrink-0" /> Your account password is required before downloading.</div>
        </div>
        <div className="lg:col-span-2 bg-white border border-indigo-100 rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex items-start gap-3"><span className="p-2.5 rounded-xl bg-indigo-50 text-indigo"><RotateCcw aria-hidden="true" className="w-5 h-5" /></span>
            <div><h3 data-guide="backup-restore" className="text-base font-semibold text-indigo-950">Restore from a backup</h3><p className="text-xs text-muted mt-1">Recover records from a previously downloaded JSON file.</p></div>
          </div>
          <ul className="text-xs text-muted space-y-2 flex-1">
            <li className="flex items-center gap-2"><Eye aria-hidden="true" className="w-4 h-4 text-indigo shrink-0" /> Preview the file before making changes</li>
            <li className="flex items-center gap-2"><Database aria-hidden="true" className="w-4 h-4 text-indigo shrink-0" /> Choose to merge or replace existing data</li>
            <li className="flex items-center gap-2"><Lock aria-hidden="true" className="w-4 h-4 text-indigo shrink-0" /> Confirm with your administrator password</li>
          </ul>
          <Button data-guide="restore-open" disabled={!isSuperAdmin} onClick={() => setIsRestoreModalOpen(true)} className="w-full"><UploadCloud aria-hidden="true" className="w-4 h-4" /> {isSuperAdmin ? "Choose backup file" : "Restore · administrators only"}</Button>
        </div>
      </div>

      <div className="bg-white border border-indigo-100 rounded-2xl p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="hidden sm:flex p-2.5 rounded-xl bg-indigo-50 text-indigo shrink-0"><Cloud aria-hidden="true" className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-sm font-semibold text-indigo-950">Cloud sync</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] ${cloudStatusClass}`}><span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />{cloudStatus}</span></div>
          <p className="text-xs text-muted mt-1 break-words">{cloudSyncStatus?.lastSyncedAt
            ? `Last synced ${new Date(cloudSyncStatus.lastSyncedAt).toLocaleString()}${cloudSyncStatus.lastSyncedBy ? ` by ${cloudSyncStatus.lastSyncedBy}` : ""}`
            : cloudSyncStatus ? "Sync your local records with the church’s cloud database." : "Cloud status could not be loaded. Open the manager to check the connection."}</p>
        </div>
        <Button data-guide="backup-cloud" onClick={() => setIsCloudSyncModalOpen(true)} className="shrink-0">Manage cloud sync <ArrowRight aria-hidden="true" className="w-4 h-4" /></Button>
      </div>

      <div className="bg-white border border-indigo-100 rounded-2xl overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-indigo-950">Database overview</h3><p className="text-xs text-muted mt-1">Live record counts and annual activity available to inspect or back up.</p></div>
          <Button size="sm" disabled={loadingInspect || !summary} onClick={() => void handleInspectYear(currentYear)}><Eye aria-hidden="true" className="w-4 h-4" /> {loadingInspect ? "Loading records…" : `Inspect ${currentYear} data`}</Button>
        </div>
        {total && <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-4 px-5 pb-5">
          {[["Members", total.members], ["Attendance", total.attendance], ["Events", total.events], ["Duty schedules", (total.duty_schedules || 0) + (total.dishwashing_roster || 0)], ["Audit logs", total.audit_logs]].map(([label, count]) => <div key={label} className="border-l-2 border-indigo-100 pl-3"><dt className="text-xs text-muted">{label}</dt><dd className="text-xl font-semibold text-indigo-950 tabular-nums">{Number(count || 0).toLocaleString()}</dd></div>)}
        </dl>}
        <div className="px-5 py-3 border-y border-indigo-100 bg-slate-50 flex items-center justify-between gap-3"><h4 className="flex items-center gap-2 text-xs font-medium text-charcoal"><Calendar aria-hidden="true" className="w-4 h-4 text-indigo" /> Records by year</h4><span className="text-xs text-muted">{yearlyList.length} {yearlyList.length === 1 ? "year" : "years"}</span></div>
        {yearlyList.length > 0 ? <div className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:-outline-offset-2" role="region" aria-label="Annual activity records" tabIndex={0}>
          <table className="w-full min-w-[680px] text-left text-xs"><caption className="sr-only">Annual attendance, events, schedules, and total activity records</caption>
            <thead className="text-muted border-b border-indigo-100"><tr>{["Year", "Attendance", "Events", "Schedules", "Total activity", "Actions"].map(label => <th key={label} scope="col" className={`px-5 py-3 font-medium whitespace-nowrap ${label === "Actions" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-indigo-100">{yearlyList.map(row => <tr key={row.year} className="hover:bg-slate-50">
              <th scope="row" className="px-5 py-4 text-indigo-950 font-medium"><div className="flex items-center gap-2 whitespace-nowrap">{row.year}{row.year === currentYear && <span className="text-[12px] text-sage-700 bg-sage-50 px-2 py-0.5 rounded-full">Current</span>}</div></th>
              <td className="px-5 py-4 text-charcoal tabular-nums">{row.attendance.toLocaleString()}</td><td className="px-5 py-4 text-charcoal tabular-nums">{row.events.toLocaleString()}</td><td className="px-5 py-4 text-charcoal tabular-nums">{(row.dutySchedules + row.dishwashingRoster).toLocaleString()}</td><td className="px-5 py-4 text-indigo-950 font-medium tabular-nums">{row.totalRecords.toLocaleString()}</td>
              <td className="px-5 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" aria-label={`Inspect ${row.year} records`} disabled={loadingInspect} onClick={() => void handleInspectYear(row.year)}><Eye aria-hidden="true" className="w-3.5 h-3.5" /> Inspect</Button><Button size="sm" aria-label={`Back up ${row.year} records`} onClick={() => handleOpenBackupModal(row.year)}><Download aria-hidden="true" className="w-3.5 h-3.5" /> Backup</Button></div></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="px-5 py-8 text-center text-muted text-xs"><Calendar aria-hidden="true" className="w-6 h-6 mx-auto mb-2" />{summary ? "No annual activity records yet. You can still create a full database backup." : "Annual records are unavailable until the overview loads."}</div>}
      </div>

      <details className="bg-white rounded-2xl border border-rose-200 group">
        <summary data-guide="backup-purge" className="p-5 cursor-pointer flex items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2"><AlertTriangle aria-hidden="true" className="w-5 h-5 text-rose-600 shrink-0" /><div className="flex-1"><h3 className="text-sm font-semibold text-rose-700">Delete historical records</h3><p className="text-xs text-muted mt-1">Permanent deletion by year. Download a backup before continuing.</p></div><span className="text-xs text-rose-700 group-open:hidden">Expand</span><span className="hidden text-xs text-rose-700 group-open:inline">Collapse</span></summary>
        <div className="border-t border-rose-100 p-5 space-y-4"><p className="text-xs text-muted">Deletes annual activity such as attendance, events, notifications, and rosters. Review the affected records and confirm your password in the next step.</p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3"><div className="flex-1 space-y-2"><label htmlFor="purge-year" className="ui-field">Year to delete</label><select id="purge-year" data-guide="purge-year" className="ui-input" value={containerPurgeYear} disabled={!isSuperAdmin || !yearlyList.length} onChange={event => setContainerPurgeYear(event.target.value)}><option value="">Choose a year…</option>{yearlyList.map(row => <option key={row.year} value={row.year}>{row.year} · {row.totalRecords.toLocaleString()} activity records</option>)}</select></div>
            <Button data-guide="purge-open" disabled={!containerPurgeYear || !isSuperAdmin || loading} className="!text-rose-700 !border-rose-200 hover:!bg-rose-50" onClick={() => handleOpenPurgeModal(Number(containerPurgeYear))}><Trash2 aria-hidden="true" className="w-4 h-4" /> Preview deletion</Button>
          </div>{!isSuperAdmin && <p className="text-xs text-rose-700">Only administrators can delete records.</p>}
        </div>
      </details>

      {/* Mount only open dialogs so each task starts with a fresh draft. */}
      {isBackupModalOpen && <BackupModal isOpen onClose={() => setIsBackupModalOpen(false)} year={selectedBackupYear} recordCount={selectedBackupCount} onSuccess={msg => onShowToast(msg)} />}
      {isInspectModalOpen && <DataInspectionModal isOpen onClose={() => setIsInspectModalOpen(false)} year={inspectYear} data={inspectData} onExportYear={year => { setIsInspectModalOpen(false); handleOpenBackupModal(year); }} onDeleteYear={year => { setIsInspectModalOpen(false); handleOpenPurgeModal(year); }} />}
      {isPurgeModalOpen && <PurgeYearModal isOpen onClose={() => setIsPurgeModalOpen(false)} year={purgeYear} onConfirmPurge={handleConfirmPurge} />}
      {isRestoreModalOpen && <RestoreModal isOpen onClose={() => setIsRestoreModalOpen(false)} onRestoreSuccess={() => { onShowToast("Database successfully restored from backup!"); void loadSummary(); }} />}
      {isCloudSyncModalOpen && <CloudSyncModal isOpen onClose={() => setIsCloudSyncModalOpen(false)} onSyncComplete={() => { onShowToast("Cloud synchronization complete!"); void loadSummary(); }} />}
    </section>
  );
};
