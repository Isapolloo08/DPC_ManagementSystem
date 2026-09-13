import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, UploadCloud, FileText, CheckCircle2, AlertTriangle,
  RotateCcw, Sparkles, Layers, Database, ShieldAlert
} from "lucide-react";
import { api } from "../../api";
import { BackupPreviewResponse } from "../../types";

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess
}) => {
  if (!isOpen) return null;

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [previewInfo, setPreviewInfo] = useState<BackupPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [password, setPassword] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);
    setLoadingPreview(true);

    try {
      const text = await selectedFile.text();
      const json = JSON.parse(text);
      setParsedData(json);

      // Request backend preview
      const preview = await api.previewBackup(json);
      setPreviewInfo(preview);
    } catch (err: any) {
      setError(err.message || "Invalid JSON backup file format.");
      setParsedData(null);
      setPreviewInfo(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedData) return;
    if (!password.trim()) {
      setError("Please enter your account password to authorize restore.");
      return;
    }
    if (restoreMode === "replace" && confirmText.trim().toUpperCase() !== "RESTORE") {
      setError("Please type 'RESTORE' to confirm replace mode.");
      return;
    }

    setIsRestoring(true);
    setError(null);
    try {
      await api.restoreBackup(parsedData, restoreMode, password);
      onRestoreSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to restore database backup. Verify your password.");
    } finally {
      setIsRestoring(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-indigo-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-indigo-100 flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/70 to-white">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo text-white shadow-md shadow-indigo-950/20">
              <RotateCcw className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-black text-indigo tracking-tight">
                Restore Database from Backup
              </h2>
              <p className="text-xs text-charcoal/60 font-medium">
                Upload a verified .json backup file to restore church records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-indigo-100/70 text-charcoal/60 hover:text-charcoal transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* File Upload Box */}
          <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-all bg-indigo-50/30 relative">
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <UploadCloud className="w-10 h-10 text-indigo/60" />
              <div className="text-xs font-black text-indigo">
                {file ? file.name : "Click or drag your backup (.json) file here"}
              </div>
              <p className="text-[11px] text-charcoal/50">
                Supports full backups or year-specific snapshots
              </p>
            </div>
          </div>

          {loadingPreview && (
            <div className="flex items-center justify-center p-6 gap-2 text-xs font-bold text-indigo animate-pulse">
              <Database className="w-4 h-4 animate-spin" />
              <span>Analyzing backup payload & table records...</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Backup Preview Section */}
          {previewInfo && (
            <div className="space-y-4 border border-indigo-100 rounded-2xl p-5 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-black text-indigo">
                    Backup Validated ({previewInfo.backupType})
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-black">
                  {previewInfo.totalRows} Total Records
                </span>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(previewInfo.tableCounts).map(([tbl, count]) => (
                  <div key={tbl} className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-2xs flex items-center justify-between">
                    <span className="text-[11px] font-bold text-charcoal/70 capitalize truncate">
                      {tbl.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs font-black text-indigo ml-1">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Restore Mode Option */}
              <div className="space-y-2 pt-2 border-t border-indigo-100">
                <label className="text-xs font-black text-charcoal">Select Restore Mode:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRestoreMode("replace")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      restoreMode === "replace"
                        ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-white border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    <div className="text-xs font-black text-indigo">Replace Mode (Clean)</div>
                    <p className="text-[10px] text-charcoal/60 mt-0.5">
                      Clears current transactional tables and restores clean backup snapshot.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreMode("merge")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      restoreMode === "merge"
                        ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-white border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    <div className="text-xs font-black text-indigo">Merge Mode (Append)</div>
                    <p className="text-[10px] text-charcoal/60 mt-0.5">
                      Inserts missing records without deleting existing records.
                    </p>
                  </button>
                </div>
              </div>

              {/* Confirmation input for replace mode */}
              {restoreMode === "replace" && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] font-bold text-charcoal">
                    Type <span className="font-black text-indigo uppercase">RESTORE</span> to confirm database replacement:
                  </label>
                  <input
                    type="text"
                    placeholder="Type RESTORE here"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs font-bold text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo/20"
                  />
                </div>
              )}

              {/* Password Verification */}
              <div className="space-y-1.5 pt-2 border-t border-indigo-100">
                <label className="text-[11px] font-black text-charcoal">
                  Enter Account Password to Authorize:
                </label>
                <input
                  type="password"
                  placeholder="Enter your current password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-indigo-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-charcoal/70 hover:bg-white transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteRestore}
            disabled={!previewInfo || isRestoring || (restoreMode === "replace" && confirmText.trim().toUpperCase() !== "RESTORE")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-950 disabled:opacity-40 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className={`w-4 h-4 ${isRestoring ? "animate-spin" : ""}`} />
            <span>{isRestoring ? "Restoring Database..." : "Execute Restore"}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
