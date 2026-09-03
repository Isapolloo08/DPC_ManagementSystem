import React, { useEffect, useState } from "react";
import { api } from "../api";
import { AuditLog } from "../types";
import { ShieldAlert, Clock, User, CheckCircle2, RefreshCw } from "lucide-react";

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
        return <span className="bg-sage-100 text-sage-800 font-bold px-2 py-0.5 rounded text-[10px]">CREATE</span>;
      case "UPDATE":
        return <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">UPDATE</span>;
      case "CHECK_IN":
        return <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">CHECK_IN</span>;
      case "CHECK_OUT":
        return <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px]">CHECK_OUT</span>;
      case "DONATION":
        return <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">DONATION</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded text-[10px]">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo" />
            <span>Security & Compliance Audit Trail</span>
          </h1>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Immutable log of staff and coordinator actions, check-ins, record mutations, and stewardship changes.
          </p>
        </div>

        <button
          onClick={loadAudit}
          className="flex items-center gap-1.5 bg-white hover:bg-ivory border border-indigo-200 text-charcoal font-semibold px-3 py-1.5 rounded-xl text-xs shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-2xl border border-indigo-100/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory text-charcoal/70 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target Entity</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-ivory-light/60">
                  <td className="p-3.5 text-charcoal/60 whitespace-nowrap flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-charcoal/40" />
                    <span>{new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
                  </td>
                  <td className="p-3.5 font-semibold text-charcoal">
                    {log.user_name || "System Admin"} <span className="text-[10px] text-charcoal/40 font-normal">({log.role_name || "System"})</span>
                  </td>
                  <td className="p-3.5">{getActionBadge(log.action)}</td>
                  <td className="p-3.5 font-mono text-xs text-indigo uppercase font-semibold">
                    {log.target_table} #{log.target_id || "—"}
                  </td>
                  <td className="p-3.5 text-charcoal/80">{log.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
