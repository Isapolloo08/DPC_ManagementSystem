import React, { useState, useEffect } from "react";
import {
  Cloud, CloudRain, RefreshCw, ArrowUpCircle, ArrowDownCircle, CheckCircle2,
  AlertCircle, ShieldCheck, Database, Server, Clock, Lock, Key, ExternalLink,
  ChevronDown, ChevronUp, Check, X, Sparkles, Layers, FileText
} from "lucide-react";
import { api } from "../../api";
import { socket } from "../../socket";
import { CloudSyncStatusResponse, CloudSyncProgressEvent } from "../../types";

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete
}) => {
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatusResponse | null>(null);
  const [cloudUrlInput, setCloudUrlInput] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [configTestResult, setConfigTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<"push" | "pull" | null>(null);
  const [syncProgress, setSyncProgress] = useState<CloudSyncProgressEvent | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Confirmation modals
  const [confirmAction, setConfirmAction] = useState<"push" | "pull" | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleProgress = (data: CloudSyncProgressEvent) => {
      setSyncProgress(data);
    };

    const handleCompleted = () => {
      setIsSyncing(false);
      loadStatus();
      if (onSyncComplete) onSyncComplete();
    };

    const handleFailed = (data: { error: string }) => {
      setIsSyncing(false);
      setSyncErrorMessage(data.error || "Sync operation failed");
    };

    socket.on("cloudSync:progress", handleProgress);
    socket.on("cloudSync:completed", handleCompleted);
    socket.on("cloudSync:failed", handleFailed);

    return () => {
      socket.off("cloudSync:progress", handleProgress);
      socket.off("cloudSync:completed", handleCompleted);
      socket.off("cloudSync:failed", handleFailed);
    };
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    setSyncErrorMessage(null);
    try {
      const res = await api.getCloudSyncStatus();
      setSyncStatus(res);
      if (!res.configured) {
        setShowConfig(true);
      }
    } catch (err: any) {
      setSyncErrorMessage(err.message || "Failed to load Cloud Sync status");
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!cloudUrlInput.trim()) return;
    setTestingConfig(true);
    setConfigTestResult(null);
    try {
      const res = await api.testCloudSyncConnection(cloudUrlInput.trim());
      setConfigTestResult({
        success: res.success,
        message: res.message
      });
    } catch (err: any) {
      setConfigTestResult({
        success: false,
        message: err.message || "Failed to connect to Cloud Database"
      });
    } finally {
      setTestingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!cloudUrlInput.trim()) return;
    setSavingConfig(true);
    setConfigTestResult(null);
    try {
      const res = await api.saveCloudSyncConfig(cloudUrlInput.trim());
      setConfigTestResult({
        success: true,
        message: res.message
      });
      await loadStatus();
      setShowConfig(false);
    } catch (err: any) {
      setConfigTestResult({
        success: false,
        message: err.message || "Failed to save configuration"
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const executePush = async () => {
    setConfirmAction(null);
    setIsSyncing(true);
    setSyncDirection("push");
    setSyncProgress({
      step: "init",
      current: 0,
      total: 22,
      percentage: 0,
      message: "Connecting to Supabase Cloud Database..."
    });
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);

    try {
      const res = await api.pushToCloud();
      setSyncSuccessMessage(res.message);
      await loadStatus();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setSyncErrorMessage(err.message || "Push to cloud failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const executePull = async () => {
    setConfirmAction(null);
    setIsSyncing(true);
    setSyncDirection("pull");
    setSyncProgress({
      step: "init",
      current: 0,
      total: 22,
      percentage: 0,
      message: "Downloading data from Supabase Cloud..."
    });
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);

    try {
      const res = await api.pullFromCloud();
      setSyncSuccessMessage(res.message);
      await loadStatus();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setSyncErrorMessage(err.message || "Pull from cloud failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-inner">
              <Cloud className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">Supabase Cloud Sync & Backup</h2>
                {syncStatus?.connected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Cloud Live
                  </span>
                ) : syncStatus?.configured ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    Cloud Offline
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-500/20 text-slate-300 border border-slate-400/30">
                    Not Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                LAN-First church speed with secure offsite Supabase Cloud replication
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSyncing}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Active Progress Banner */}
          {isSyncing && syncProgress && (
            <div className="bg-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-indigo-800 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-2 text-indigo-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  {syncDirection === "push" ? "Pushing Local Data to Supabase..." : "Pulling Data from Supabase..."}
                </span>
                <span className="font-mono font-black text-indigo-200">
                  {syncProgress.percentage}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.max(syncProgress.percentage, 5)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-indigo-200/70 pt-1">
                <span>{syncProgress.message}</span>
                <span className="font-mono">Step {syncProgress.current} of {syncProgress.total}</span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {syncSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-sm text-emerald-950">Synchronization Successful!</div>
                <div className="text-xs text-emerald-800">{syncSuccessMessage}</div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {syncErrorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-sm text-rose-950">Cloud Sync Error</div>
                <div className="text-xs text-rose-800 leading-relaxed font-mono text-[11px]">{syncErrorMessage}</div>
              </div>
            </div>
          )}

          {/* Cloud Info & Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-wider uppercase text-charcoal/50">Cloud Host</div>
                <div className="text-xs font-bold text-charcoal truncate">
                  {syncStatus?.cloudHost || "Not Configured"}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-wider uppercase text-charcoal/50">Last Cloud Sync</div>
                <div className="text-xs font-bold text-charcoal truncate">
                  {syncStatus?.lastSyncedAt
                    ? new Date(syncStatus.lastSyncedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })
                    : "Never Synced"}
                </div>
              </div>
            </div>
          </div>

          {/* Sync Comparison Table */}
          {syncStatus && syncStatus.comparison.length > 0 && (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-charcoal/70 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  Database Record Comparison
                </span>
                <button
                  onClick={loadStatus}
                  disabled={loading || isSyncing}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {syncStatus.comparison.map((row) => {
                  const isMatch = row.localCount === row.cloudCount;
                  const diff = row.localCount - row.cloudCount;
                  return (
                    <div key={row.table} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50">
                      <span className="font-medium text-charcoal">{row.label}</span>
                      <div className="flex items-center gap-4 font-mono text-[11px]">
                        <span className="text-charcoal/70">Local: <strong className="text-charcoal font-bold">{row.localCount}</strong></span>
                        <span className="text-charcoal/70">Cloud: <strong className="text-charcoal font-bold">{row.cloudCount}</strong></span>
                        {isMatch ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                            Synced ✓
                          </span>
                        ) : diff > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                            +{diff} Local Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                            Cloud Ahead
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Cards: Push vs Pull */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Push to Cloud Card */}
            <div className="border-2 border-indigo-200/80 hover:border-indigo-400 bg-gradient-to-b from-indigo-50/40 to-white rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all shadow-2xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                  <ArrowUpCircle className="w-5 h-5 text-indigo-600" />
                  Push Local ➔ Supabase
                </div>
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  Uploads all new and edited members, attendance, events, and records from this computer up to Supabase Cloud.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmAction("push")}
                disabled={isSyncing || !syncStatus?.configured}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs shadow-md shadow-indigo-950/20 transition-all cursor-pointer disabled:opacity-50 active:scale-98 flex items-center justify-center gap-2"
              >
                <ArrowUpCircle className="w-4 h-4 text-indigo-300" />
                <span>Push to Supabase Cloud</span>
              </button>
            </div>

            {/* Pull from Cloud Card */}
            <div className="border border-slate-200 bg-slate-50/50 hover:bg-white rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all shadow-2xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-charcoal font-black text-sm">
                  <ArrowDownCircle className="w-5 h-5 text-slate-600" />
                  Pull Supabase ➔ Local
                </div>
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  Downloads all records from Supabase Cloud to this local machine. Ideal when setting up a new Master PC.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmAction("pull")}
                disabled={isSyncing || !syncStatus?.configured}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-charcoal border border-slate-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-50 active:scale-98 flex items-center justify-center gap-2 shadow-2xs"
              >
                <ArrowDownCircle className="w-4 h-4 text-charcoal/60" />
                <span>Pull from Cloud</span>
              </button>
            </div>

          </div>

          {/* Collapsible Supabase Connection Configuration */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-black text-charcoal/80 uppercase tracking-wider">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Supabase Cloud Connection String</span>
              </div>
              {showConfig ? <ChevronUp className="w-4 h-4 text-charcoal/50" /> : <ChevronDown className="w-4 h-4 text-charcoal/50" />}
            </button>

            {showConfig && (
              <div className="p-5 bg-white space-y-4 border-t border-slate-200/80 animate-fade-in">
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  Enter your Supabase PostgreSQL <strong>Pooler Connection String (Port 6543)</strong>:
                </p>

                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="postgresql://postgres.xxxx:[PASSWORD]@aws-0-xxxx.pooler.supabase.com:6543/postgres"
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <div className="text-[11px] text-charcoal/50 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>The connection string is encrypted and securely stored in your Master Database.</span>
                  </div>
                </div>

                {configTestResult && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    configTestResult.success ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-rose-50 text-rose-900 border border-rose-200"
                  }`}>
                    {configTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{configTestResult.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConfig || !cloudUrlInput.trim()}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-charcoal text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                  >
                    {testingConfig ? "Testing..." : "Test Connection"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingConfig || !cloudUrlInput.trim()}
                    className="px-5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-40 shadow-sm"
                  >
                    {savingConfig ? "Saving..." : "Save Connection"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-charcoal/60 shrink-0">
          <span className="text-[11px]">Daet Presbyterian Church • Cloud Replication Module</span>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-charcoal font-bold transition-colors cursor-pointer disabled:opacity-40"
          >
            Close
          </button>
        </div>

      </div>

      {/* Confirmation Dialog for Push / Pull */}
      {confirmAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-charcoal/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                confirmAction === "push" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
              }`}>
                {confirmAction === "push" ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-charcoal">
                  {confirmAction === "push" ? "Push Local Data to Supabase Cloud?" : "Pull Data from Supabase Cloud?"}
                </h3>
                <p className="text-xs text-charcoal/60">
                  {confirmAction === "push" ? "Replicates all local changes to cloud" : "Replaces local data with cloud records"}
                </p>
              </div>
            </div>

            <p className="text-xs text-charcoal/70 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {confirmAction === "push"
                ? "This will safely upload and update all Members, Attendance records, Donations, and Events to your Supabase Cloud Database. No existing data will be lost."
                : "This will import records from Supabase Cloud into your local computer database. Are you sure you want to proceed?"}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-charcoal font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction === "push" ? executePush : executePull}
                className={`px-5 py-2 rounded-xl text-white font-black text-xs shadow-md cursor-pointer ${
                  confirmAction === "push" ? "bg-indigo-900 hover:bg-indigo-950" : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {confirmAction === "push" ? "Yes, Push to Cloud" : "Yes, Pull from Cloud"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
