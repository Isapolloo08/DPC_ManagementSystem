import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Database, Calendar, Users, DollarSign, Clock, MessageSquare,
  Search, Download, Eye, FileText, CheckCircle2, ShieldAlert, Sparkles, Filter, ChevronRight
} from "lucide-react";

interface DataInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  year?: number;
  title?: string;
  data: {
    attendance?: any[];
    donations?: any[];
    events?: any[];
    duty_schedules?: any[];
    dishwashing_roster?: any[];
    announcements?: any[];
    members_created?: any[];
    [key: string]: any[] | undefined;
  };
  onExportYear?: (year: number) => void;
  onDeleteYear?: (year: number) => void;
}

export const DataInspectionModal: React.FC<DataInspectionModalProps> = ({
  isOpen,
  onClose,
  year,
  title,
  data,
  onExportYear,
  onDeleteYear
}) => {
  if (!isOpen) return null;

  // Available table keys with non-empty or registered tables
  const tableKeys = Object.keys(data).filter(k => Array.isArray(data[k]));
  const [activeTable, setActiveTable] = useState<string>(tableKeys[0] || "attendance");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  React.useEffect(() => {
    if (tableKeys.length > 0 && !tableKeys.includes(activeTable)) {
      setActiveTable(tableKeys[0]);
    }
  }, [data]);

  const currentRecords = Array.isArray(data[activeTable]) ? data[activeTable]! : [];

  const filteredRecords = currentRecords.filter((row: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(val => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(q);
    });
  });

  const getTableIcon = (name: string) => {
    switch (name) {
      case "attendance": return <Clock className="w-4 h-4 text-emerald-600" />;
      case "donations": return <DollarSign className="w-4 h-4 text-amber-600" />;
      case "events": return <Calendar className="w-4 h-4 text-indigo-600" />;
      case "duty_schedules":
      case "dishwashing_roster": return <Users className="w-4 h-4 text-blue-600" />;
      case "announcements": return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case "members_created":
      case "members": return <Users className="w-4 h-4 text-rose-600" />;
      default: return <Database className="w-4 h-4 text-charcoal/60" />;
    }
  };

  const formatTableName = (name: string) => {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleDownloadTableJson = () => {
    const blob = new Blob([JSON.stringify(currentRecords, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable}_${year ? `year_${year}` : 'export'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-indigo-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-indigo-100 flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/50">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo text-white shadow-md shadow-indigo-950/20">
              <Database className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-indigo tracking-tight">
                  {title || (year ? `Data Inspector — Year ${year}` : "Data Inspector & Backup Preview")}
                </h2>
                {year && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black">
                    Year {year}
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal/60 font-medium">
                Live inspection of database entities, counts, and field contents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {year && onExportYear && (
              <button
                onClick={() => onExportYear(year)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo text-xs font-bold transition-all cursor-pointer"
                title="Backup this year"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Backup Year</span>
              </button>
            )}
            {year && onDeleteYear && (
              <button
                onClick={() => onDeleteYear(year)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                title="Delete this year's data"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Purge Year</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-indigo-100/70 text-charcoal/60 hover:text-charcoal transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body with Left Sidebar (Tables) and Right Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Table Selector */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-indigo-100 bg-slate-50/50 p-4 space-y-1.5 overflow-y-auto shrink-0">
            <div className="text-[11px] font-black uppercase tracking-wider text-charcoal/40 px-2 py-1">
              Tables & Modules ({tableKeys.length})
            </div>
            {tableKeys.map((tbl) => {
              const count = Array.isArray(data[tbl]) ? data[tbl]!.length : 0;
              const isSelected = activeTable === tbl;
              return (
                <button
                  key={tbl}
                  onClick={() => {
                    setActiveTable(tbl);
                    setSearchQuery("");
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                    isSelected
                      ? "bg-indigo text-white shadow-sm"
                      : "hover:bg-white text-charcoal/80 hover:text-indigo border border-transparent hover:border-indigo-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={isSelected ? "text-amber-300" : ""}>
                      {getTableIcon(tbl)}
                    </span>
                    <span className="truncate">{formatTableName(tbl)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-indigo-100/60 text-indigo-900"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Records Workspace */}
          <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden p-6 space-y-4">
            
            {/* Table Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-indigo flex items-center gap-2">
                  {getTableIcon(activeTable)}
                  <span>{formatTableName(activeTable)}</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo text-xs font-bold border border-indigo-100">
                  {filteredRecords.length} / {currentRecords.length} records
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-indigo-100 text-xs text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-indigo/20 w-44"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      viewMode === "table" ? "bg-white text-indigo shadow-xs" : "text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode("json")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      viewMode === "json" ? "bg-white text-indigo shadow-xs" : "text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    JSON
                  </button>
                </div>

                {/* Export single table */}
                <button
                  onClick={handleDownloadTableJson}
                  disabled={currentRecords.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-charcoal/80 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                  title="Download this table as JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto border border-indigo-100/80 rounded-2xl bg-slate-50/30">
              {filteredRecords.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-charcoal/50 space-y-2">
                  <Database className="w-8 h-8 text-indigo/30" />
                  <p className="text-xs font-bold">No records found in this table for the selected filter.</p>
                </div>
              ) : viewMode === "json" ? (
                <pre className="p-4 text-[11px] font-mono text-charcoal/80 leading-relaxed bg-slate-900 text-emerald-400 overflow-auto h-full rounded-2xl">
                  {JSON.stringify(filteredRecords, null, 2)}
                </pre>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-charcoal font-black border-b border-indigo-100 sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      {Object.keys(filteredRecords[0] || {}).map((col) => (
                        <th key={col} className="px-4 py-2.5 font-bold uppercase text-[10px] tracking-wider text-charcoal/70 whitespace-nowrap">
                          {col.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50 bg-white">
                    {filteredRecords.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                        {Object.keys(filteredRecords[0] || {}).map((col) => {
                          const val = row[col];
                          let formattedVal = String(val ?? "—");
                          if (typeof val === "boolean") formattedVal = val ? "True" : "False";
                          if (typeof val === "object" && val !== null) formattedVal = JSON.stringify(val);

                          return (
                            <td key={col} className="px-4 py-2.5 text-charcoal/80 whitespace-nowrap max-w-xs truncate" title={formattedVal}>
                              {col.includes("color") && typeof val === "string" && val.startsWith("#") ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: val }} />
                                  <span>{val}</span>
                                </div>
                              ) : col.includes("amount") && typeof val === "number" ? (
                                <span className="font-bold text-emerald-700">₱{val.toLocaleString()}</span>
                              ) : (
                                formattedVal
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-indigo-100 bg-slate-50 flex items-center justify-between text-xs text-charcoal/60">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Active inspection session ready</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo text-white font-bold hover:bg-indigo-950 transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
