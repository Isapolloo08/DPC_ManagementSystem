import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { ServiceItem, CreateServicePayload, UpdateServicePayload } from "../types";
import { useSocketEvent } from "../socket";
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Sun,
  Layers,
  FileText,
  AlertTriangle,
  RotateCcw,
  List,
  CalendarDays,
  UserCheck
} from "lucide-react";

export const ServiceCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrCoordinator = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "month">("list");

  // Date Range (default: 8 weeks back to 12 weeks ahead)
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 56);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 84);
    return d.toISOString().split("T")[0];
  });

  // Filters
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Data
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Month Calendar Navigation State
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [formDate, setFormDate] = useState<string>("");
  const [formType, setFormType] = useState<"sunday_service" | "special_service">("sunday_service");
  const [formTitle, setFormTitle] = useState<string>("Sunday Worship Service");
  const [formStatus, setFormStatus] = useState<"held" | "cancelled">("held");
  const [formNotes, setFormNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch Services
  const loadServices = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await api.getServices({
        from: fromDate,
        to: toDate,
        type: filterType || undefined,
        status: filterStatus || undefined
      });
      setServices(res.services || []);
    } catch (err: any) {
      console.error("Failed to load services:", err);
      setError(err.message || "Failed to load service calendar.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, filterType, filterStatus]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Real-time synchronization
  useSocketEvent("services:changed", () => loadServices(true));
  useSocketEvent("attendance:changed", () => loadServices(true));

  // Summary counts
  const summary = useMemo(() => {
    let total = services.length;
    let heldRecorded = 0;
    let heldUnrecorded = 0;
    let cancelled = 0;

    for (const s of services) {
      if (s.status === "cancelled") {
        cancelled++;
      } else if (s.is_recorded) {
        heldRecorded++;
      } else {
        heldUnrecorded++;
      }
    }
    return { total, heldRecorded, heldUnrecorded, cancelled };
  }, [services]);

  // Generate Upcoming Sundays
  const handleGenerateSundays = async () => {
    setIsGenerating(true);
    try {
      await api.generateUpcomingSundays();
      await loadServices(true);
    } catch (err: any) {
      alert(`Generation failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingService(null);
    const todayStr = new Date().toISOString().split("T")[0];
    setFormDate(todayStr);
    setFormType("special_service");
    setFormTitle("Special Thanksgiving Service");
    setFormStatus("held");
    setFormNotes("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setFormDate(service.service_date);
    setFormType(service.service_type);
    setFormTitle(service.title);
    setFormStatus(service.status);
    setFormNotes(service.notes || "");
    setIsModalOpen(true);
  };

  // Quick Toggle Cancel / Held
  const handleQuickToggleStatus = async (service: ServiceItem) => {
    const nextStatus = service.status === "held" ? "cancelled" : "held";
    const promptReason = nextStatus === "cancelled" 
      ? prompt("Reason for cancelling this service (e.g. Typhoon, Emergency, Facility Maintenance):", service.notes || "")
      : "";
    if (nextStatus === "cancelled" && promptReason === null) return; // User cancelled prompt

    try {
      await api.updateService(service.id, {
        status: nextStatus,
        notes: nextStatus === "cancelled" ? (promptReason || "Cancelled service") : (service.notes || "")
      });
      loadServices(true);
    } catch (err: any) {
      alert(`Update failed: ${err.message || "Unknown error"}`);
    }
  };

  // Save Service Form
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formTitle.trim()) {
      alert("Please provide service date and title.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingService) {
        await api.updateService(editingService.id, {
          title: formTitle.trim(),
          status: formStatus,
          notes: formNotes
        });
      } else {
        await api.createService({
          service_date: formDate,
          service_type: formType,
          title: formTitle.trim(),
          status: formStatus,
          notes: formNotes
        });
      }
      setIsModalOpen(false);
      loadServices(true);
    } catch (err: any) {
      alert(`Failed to save service: ${err.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Month Grid Calculation
  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const daysArray: { dayNumber: number | null; dateStr: string | null }[] = [];

    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push({ dayNumber: null, dateStr: null });
    }

    // Month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      daysArray.push({ dayNumber: d, dateStr: `${year}-${mm}-${dd}` });
    }

    return daysArray;
  }, [calendarMonth]);

  // Map services by date string for quick calendar lookup
  const servicesByDate = useMemo(() => {
    const map = new Map<string, ServiceItem[]>();
    for (const s of services) {
      if (!map.has(s.service_date)) map.set(s.service_date, []);
      map.get(s.service_date)!.push(s);
    }
    return map;
  }, [services]);

  if (!isAdminOrCoordinator) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-stone-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-charcoal">Access Restricted</h2>
        <p className="text-xs text-stone-500 mt-1">The Service Calendar is restricted to Church Administrators and Ministry Coordinators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-stone-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo/10 rounded-xl text-indigo border border-indigo/20">
            <CalendarIcon className="w-6 h-6 text-indigo" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-charcoal">Service Calendar</h1>
            <p className="text-xs sm:text-sm font-medium text-stone-500">
              Official registry of held, unrecorded, and cancelled worship services for reliable attendance and absence analytics.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-stone-100 p-1 rounded-xl flex items-center border border-stone-200">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "list" ? "bg-white text-indigo shadow-sm" : "text-stone-500 hover:text-charcoal"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "month" ? "bg-white text-indigo shadow-sm" : "text-stone-500 hover:text-charcoal"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
          </div>

          <button
            onClick={handleGenerateSundays}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-charcoal rounded-xl text-xs font-bold transition border border-stone-200 disabled:opacity-50"
            title="Auto-generate upcoming Sunday worship services"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin text-indigo" : "text-stone-600"}`} />
            <span>Generate Sundays</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo hover:bg-indigo-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Special Service</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total Services</div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-black text-charcoal">{summary.total}</div>
          <div className="text-[11px] text-stone-400 font-semibold mt-0.5">In selected range</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Held & Recorded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-black text-emerald-700">{summary.heldRecorded}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Active check-in logs</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Unrecorded</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-black text-amber-700">{summary.heldUnrecorded}</div>
          <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Zero check-ins logged</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Cancelled</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-black text-rose-700">{summary.cancelled}</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Excluded from absences</div>
        </div>
      </div>

      {/* Explanatory Policy Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-indigo-950 font-medium">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span>
            <strong>Attendance Recording Rule:</strong> A Sunday service only counts as recorded when marked <em>Held</em> AND at least 1 check-in was scanned.
            Services with zero check-ins are flagged <em>Unrecorded</em> (e.g. kiosk offline) and excluded from member absence calculations.
          </span>
        </div>
      </div>

      {/* Main Content Area: List View vs Month View */}
      {viewMode === "list" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-stone-100 bg-stone-50/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                <Filter className="w-3.5 h-3.5 text-indigo" />
                <span>Filters:</span>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-charcoal outline-none focus:border-indigo"
              >
                <option value="">All Service Types</option>
                <option value="sunday_service">Sunday Worship Service</option>
                <option value="special_service">Special Service</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-charcoal outline-none focus:border-indigo"
              >
                <option value="">All Statuses</option>
                <option value="held">Held Services</option>
                <option value="cancelled">Cancelled Services</option>
              </select>
            </div>

            <div className="text-xs text-stone-500 font-semibold">
              Showing {services.length} services
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-stone-500">Loading service calendar...</div>
          ) : error ? (
            <div className="p-8 text-center text-xs font-bold text-rose-600">{error}</div>
          ) : services.length === 0 ? (
            <div className="p-12 text-center text-xs font-bold text-stone-400">No services found in this timeframe.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
                    <th className="py-3 px-4 sm:px-6">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Title / Purpose</th>
                    <th className="py-3 px-4 text-center">Service Status</th>
                    <th className="py-3 px-4 text-center">Check-Ins</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {services.map((srv) => {
                    const isSunday = srv.service_type === "sunday_service";
                    const isHeld = srv.status === "held";
                    const dayName = new Date(srv.service_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

                    return (
                      <tr key={srv.id} className="hover:bg-stone-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-4 sm:px-6 whitespace-nowrap">
                          <span className="font-black text-charcoal">{srv.service_date}</span>
                          <span className="ml-1.5 text-[11px] font-bold text-stone-400 uppercase">({dayName})</span>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isSunday ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo font-bold text-[11px] border border-indigo-100">
                              <Sun className="w-3 h-3 text-amber-500" />
                              <span>Sunday Service</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold text-[11px] border border-amber-200">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Special Service</span>
                            </span>
                          )}
                        </td>

                        {/* Title */}
                        <td className="py-3 px-4 font-bold text-charcoal">
                          {srv.title}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isHeld ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Held</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Cancelled</span>
                            </span>
                          )}
                        </td>

                        {/* Check-ins & Recorded Tag */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isHeld ? (
                            srv.is_recorded ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-black text-xs">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{srv.check_in_count} logged</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-200/60" title="Zero check-ins logged (unrecorded)">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Unrecorded (0)</span>
                              </span>
                            )
                          ) : (
                            <span className="text-stone-300">-</span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-4 text-stone-500 font-medium max-w-xs truncate">
                          {srv.notes || <span className="text-stone-300">-</span>}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleQuickToggleStatus(srv)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                                isHeld
                                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                              }`}
                              title={isHeld ? "Cancel this service" : "Mark as Held"}
                            >
                              {isHeld ? "Mark Cancelled" : "Mark Held"}
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(srv)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                              title="Edit service details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Month Calendar View */
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
          {/* Calendar Month Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h2 className="text-lg font-black text-charcoal">
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const d = new Date(calendarMonth);
                  d.setMonth(d.getMonth() - 1);
                  setCalendarMonth(d);
                }}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarMonth(new Date())}
                className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 transition"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date(calendarMonth);
                  d.setMonth(d.getMonth() + 1);
                  setCalendarMonth(d);
                }}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((item, idx) => {
              if (!item.dateStr) {
                return <div key={`empty-${idx}`} className="h-24 bg-stone-50/50 rounded-xl border border-dashed border-stone-100" />;
              }

              const servicesOnDay = servicesByDate.get(item.dateStr) || [];
              const isToday = item.dateStr === new Date().toISOString().split("T")[0];

              return (
                <div
                  key={item.dateStr}
                  className={`h-24 p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    isToday ? "bg-indigo-50/30 border-indigo-300 ring-2 ring-indigo-200" : "bg-white border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black ${isToday ? "text-indigo" : "text-charcoal"}`}>
                      {item.dayNumber}
                    </span>
                    {servicesOnDay.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo" />
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto no-scrollbar max-h-14">
                    {servicesOnDay.map((srv) => (
                      <div
                        key={srv.id}
                        onClick={() => handleOpenEditModal(srv)}
                        className={`p-1 rounded-md text-[10px] font-bold cursor-pointer transition truncate border ${
                          srv.status === "cancelled"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : srv.is_recorded
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                            : "bg-amber-50 text-amber-900 border-amber-200"
                        }`}
                        title={`${srv.title} (${srv.status}) - ${srv.check_in_count} check-ins`}
                      >
                        {srv.status === "cancelled" ? "Cancelled: " : ""}
                        {srv.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-stone-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-lg font-black text-charcoal">
                {editingService ? "Edit Service" : "Add Service Entry"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Service Date</label>
                <input
                  type="date"
                  value={formDate}
                  disabled={!!editingService} // Keep date immutable on edit
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-charcoal outline-none focus:border-indigo disabled:opacity-60"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Service Type</label>
                <select
                  value={formType}
                  disabled={!!editingService}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-charcoal outline-none focus:border-indigo disabled:opacity-60"
                >
                  <option value="sunday_service">Sunday Worship Service</option>
                  <option value="special_service">Special Service (Midweek / Thanksgiving / Holiday)</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Service Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Sunday Worship Service, Christmas Eve Service"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal outline-none focus:border-indigo"
                  required
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-charcoal outline-none focus:border-indigo"
                >
                  <option value="held">Held (Normal Service)</option>
                  <option value="cancelled">Cancelled (Typhoon, Emergency, Holiday)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Notes / Cancellation Reason</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes or cancellation reason..."
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-charcoal outline-none focus:border-indigo resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo hover:bg-indigo-900 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCalendarPage;
