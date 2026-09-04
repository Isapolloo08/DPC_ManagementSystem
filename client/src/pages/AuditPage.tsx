import React, { useEffect, useState } from "react";
import { api } from "../api";
import { AuditLog } from "../types";
import { ShieldAlert, Clock, User, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs();
      setLogs(res);
    } catch (err) {
      console.error("Audit log error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <span className="bg-emerald-100 text-emerald-950 border border-emerald-300 font-black px-2.5 py-0.5 rounded-full text-[10px]">CREATE</span>;
      case "UPDATE":
        return <span className="bg-amber-100 text-amber-950 border border-amber-300 font-black px-2.5 py-0.5 rounded-full text-[10px]">UPDATE</span>;
      case "CHECK_IN":
        return <span className="bg-indigo-100 text-indigo-950 border border-indigo-300 font-black px-2.5 py-0.5 rounded-full text-[10px]">CHECK_IN</span>;
      case "CHECK_OUT":
        return <span className="bg-rose-100 text-rose-950 border border-rose-300 font-black px-2.5 py-0.5 rounded-full text-[10px]">CHECK_OUT</span>;
      case "DONATION":
        return <span className="bg-amber-200 text-amber-950 border border-amber-400 font-black px-2.5 py-0.5 rounded-full text-[10px]">DONATION</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 border border-gray-200 font-black px-2.5 py-0.5 rounded-full text-[10px]">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-indigo-500/5 via-sky-500/5 to-transparent rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-2xl lg:text-3xl font-black text-indigo tracking-tight">
              Security & Audit Trail
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/80 text-xs font-black uppercase tracking-wider shadow-2xs">
              System Logs & Compliance
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed font-medium">
            Immutable log of staff and coordinator actions, check-ins, record mutations, and stewardship changes.
          </p>
        </div>

        <button
          onClick={loadAudit}
          disabled={loading}
          className="flex items-center gap-2 bg-white hover:bg-indigo-50/60 border border-indigo-200/80 text-charcoal font-bold px-4 py-2.5 rounded-2xl text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer relative z-10"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Audit Table */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 space-x-2 text-indigo">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold">Loading audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ShieldAlert className="w-10 h-10 text-charcoal/30 mx-auto" />
            <p className="text-sm font-bold text-charcoal/70">No audit logs recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-indigo-100/80 bg-indigo-50/40 text-charcoal/80 font-black">
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-3.5 px-5 text-charcoal/70 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-charcoal/40" />
                        <span>{new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-charcoal">
                      <span>{log.user_name || "System Admin"}</span>
                      <span className="text-[10px] text-charcoal/50 font-normal ml-1.5">({log.role_name || "System"})</span>
                    </td>
                    <td className="py-3.5 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-indigo uppercase font-bold">
                      {log.target_table} #{log.target_id || "—"}
                    </td>
                    <td className="py-3.5 px-5 text-charcoal/80 font-medium">{log.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

