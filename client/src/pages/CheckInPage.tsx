import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { Member, AttendanceRecord, Ministry, AttendanceRosterItem } from "../types";
import { 
  UserCheck, ShieldCheck, Tag, AlertCircle, 
  Search, CheckCircle2, Clock, Printer, KeyRound, QrCode, X,
  Users, Sparkles, Church, Heart, Check, Calendar, Plus, RefreshCw,
  Home, Phone, UserPlus, Filter, ArrowRight, ShieldAlert, Award
} from "lucide-react";

export const CheckInPage: React.FC = () => {
  const { user, ministries, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const coordinatorMinistryId = isRestricted && allowedMinistries.length > 0
    ? allowedMinistries[0].id
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);
  
  // Tab view: "roll_call" | "kiosk_tags" | "trends"
  const [viewMode, setViewMode] = useState<"roll_call" | "kiosk_tags">("roll_call");
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [serviceName, setServiceName] = useState<string>("Sunday Morning Divine Worship (9:30 AM)");
  const [filterMinistry, setFilterMinistry] = useState<string>(
    coordinatorMinistryId ? String(coordinatorMinistryId) : (selectedMinistryId ? String(selectedMinistryId) : "all")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState<string>("all");

  useEffect(() => {
    if (coordinatorMinistryId) {
      setFilterMinistry(String(coordinatorMinistryId));
    }
  }, [coordinatorMinistryId]);

  // Roster & Attendance Data
  const [roster, setRoster] = useState<AttendanceRosterItem[]>([]);
  const [activeCheckins, setActiveCheckins] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Security Tag / Badge Modal
  const [issuedBadge, setIssuedBadge] = useState<{
    security_code: string | null;
    member_name: string;
    ministry_name: string;
    medical_notes: string | null;
    checked_in_at: string;
  } | null>(null);

  // Check-out modal state
  const [checkoutRecord, setCheckoutRecord] = useState<AttendanceRecord | null>(null);
  const [checkoutCodeInput, setCheckoutCodeInput] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  // Quick Guest Registration Modal
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestBirthdate, setGuestBirthdate] = useState("2000-01-01");
  const [guestMinistryId, setGuestMinistryId] = useState<number>(1);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNotes, setGuestNotes] = useState("");

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    loadAttendanceData();
  }, [serviceDate, filterMinistry]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const ministryParam = coordinatorMinistryId 
        ? coordinatorMinistryId 
        : (filterMinistry !== "all" ? Number(filterMinistry) : undefined);
      const [rosterList, checkinsList] = await Promise.all([
        api.getAttendanceRoster({ ministry_id: ministryParam, date: serviceDate }).catch(() => []),
        api.getTodayAttendance(ministryParam, serviceDate).catch(() => [])
      ]);
      setRoster(rosterList);
      setActiveCheckins(checkinsList);
    } catch (err: any) {
      console.error("Failed to load attendance data:", err);
      showToast(err.message || "Failed to load attendance", "error");
    } finally {
      setLoading(false);
    }
  };

  // Mark single member present
  const handleMarkPresent = async (item: AttendanceRosterItem) => {
    try {
      setActionLoading(item.member_id);
      const res = await api.checkIn({
        member_id: item.member_id,
        ministry_id: item.ministry_id,
        service_name: serviceName,
        notes: `Sunday Service check-in by ${user?.name || "Usher"}`
      });

      if (res.security_code) {
        setIssuedBadge({
          security_code: res.security_code,
          member_name: res.member_name,
          ministry_name: res.ministry_name,
          medical_notes: res.medical_notes,
          checked_in_at: res.checked_in_at
        });
      }

      showToast(`✓ ${item.first_name} ${item.last_name} marked present!`);
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to mark present", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Undo / Unmark attendance
  const handleUndoAttendance = async (item: AttendanceRosterItem) => {
    if (!item.attendance_id) return;
    try {
      setActionLoading(item.member_id);
      await api.undoCheckIn(item.attendance_id);
      showToast(`Removed attendance mark for ${item.first_name}`);
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to undo attendance", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Check in entire household at once
  const handleCheckInHousehold = async (householdName: string, memberIds: number[]) => {
    try {
      setLoading(true);
      await api.batchCheckIn({
        member_ids: memberIds,
        service_name: `${serviceName} (Household: ${householdName})`
      });
      showToast(`✓ Checked in all ${memberIds.length} members of the ${householdName} family!`);
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to check in household", "error");
    } finally {
      setLoading(false);
    }
  };

  // Quick Guest check-in
  const handleCreateAndCheckInGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestFirstName.trim() || !guestLastName.trim()) {
      showToast("First and last name are required", "error");
      return;
    }

    try {
      setLoading(true);
      const newMember = await api.createMember({
        first_name: guestFirstName.trim(),
        last_name: guestLastName.trim(),
        birthdate: guestBirthdate,
        ministry_id: guestMinistryId,
        contact_phone: guestPhone.trim() || undefined,
        status: "visitor"
      });

      await api.checkIn({
        member_id: newMember.id,
        ministry_id: guestMinistryId,
        service_name: serviceName,
        notes: `Sunday Guest Check-In: ${guestNotes || "First-time visitor"}`
      });

      showToast(`✓ Registered & checked in guest ${guestFirstName} ${guestLastName}!`);
      setIsGuestModalOpen(false);
      setGuestFirstName("");
      setGuestLastName("");
      setGuestNotes("");
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to check in guest", "error");
    } finally {
      setLoading(false);
    }
  };

  // Check-out for minors
  const handlePerformCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutRecord) return;

    try {
      setCheckoutError("");
      await api.checkOut({
        attendance_id: checkoutRecord.id,
        security_code: checkoutCodeInput
      });

      showToast(`✓ ${checkoutRecord.first_name} checked out safely!`);
      setCheckoutRecord(null);
      setCheckoutCodeInput("");
      loadAttendanceData();
    } catch (err: any) {
      setCheckoutError(err.message || "Security code verification failed");
    }
  };

  // Filtered Roster Items
  const filteredRoster = useMemo(() => {
    return roster.filter(item => {
      if (coordinatorMinistryId && item.ministry_id !== coordinatorMinistryId) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        `${item.first_name} ${item.last_name}`.toLowerCase().includes(q) ||
        (item.household_name && item.household_name.toLowerCase().includes(q)) ||
        (item.parent_phone && item.parent_phone.includes(q));

      const matchesHousehold = selectedHousehold === "all" || item.household_name === selectedHousehold;

      return matchesSearch && matchesHousehold;
    });
  }, [roster, searchQuery, selectedHousehold, coordinatorMinistryId]);

  // Households list
  const householdsList = useMemo(() => {
    const names = new Set<string>();
    roster.forEach(r => {
      if (r.household_name) names.add(r.household_name);
    });
    return Array.from(names).sort();
  }, [roster]);

  // Statistics
  const totalRosterCount = roster.length;
  const presentCount = roster.filter(r => r.is_present === 1).length;
  const attendanceRate = totalRosterCount > 0 ? Math.round((presentCount / totalRosterCount) * 100) : 0;
  const minorsCheckedIn = activeCheckins.filter(c => c.security_code !== null);
  const checkedOutCount = activeCheckins.filter(c => c.checked_out_at !== null).length;

  return (
    <div className="space-y-6">
      
      {/* Toast Banner */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white border animate-in slide-in-from-bottom-4 ${
          toastMsg.type === "success" ? "bg-emerald-900 border-emerald-700" : "bg-rose-900 border-rose-700"
        }`}>
          {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP HERO: Sunday Service & Attendance Overview */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-radial from-amber-500/15 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-300 text-[11px] font-bold shadow-2xs backdrop-blur-md">
              <Church className="w-3.5 h-3.5 text-amber-400" />
              <span>Sunday Divine Worship & Attendance Kiosk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Worship Service Attendance
            </h1>
            <p className="text-xs text-indigo-200/90 max-w-xl leading-relaxed">
              Track Sunday worship attendees, manage multi-generational household check-ins, generate child security tags, and log attendance across all 7 ministries.
            </p>
          </div>

          {/* Quick Date & Service Selector Controls */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 p-2.5 rounded-2xl border border-white/15 backdrop-blur-md">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 rounded-xl border border-white/10 text-xs text-white">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsGuestModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber to-amber-500 hover:from-amber-500 hover:to-amber-600 text-charcoal font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Check In Guest</span>
            </button>

            <button
              onClick={loadAttendanceData}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Refresh Attendance"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Attendance Metric Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Present Today</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {presentCount} <span className="text-xs font-normal text-indigo-300">/ {totalRosterCount}</span>
            </div>
            <div className="text-[10px] text-emerald-300 font-bold mt-0.5">{attendanceRate}% Turnout</div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Kids Checked In</span>
              <Tag className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {minorsCheckedIn.length}
            </div>
            <div className="text-[10px] text-indigo-200 mt-0.5">Kinder & Elementary</div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Checked Out</span>
              <ShieldCheck className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {checkedOutCount}
            </div>
            <div className="text-[10px] text-indigo-200 mt-0.5">Safe pickup verified</div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Households</span>
              <Home className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {householdsList.length}
            </div>
            <div className="text-[10px] text-indigo-200 mt-0.5">Family units active</div>
          </div>
        </div>
      </div>

      {/* VIEW SWITCHER TABS & SEARCH FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
        {/* Ministry Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {coordinatorMinistryId ? (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth"} Ministry Attendance</span>
              <span className="text-[10px] text-indigo-600 font-semibold">(Assigned Scope)</span>
            </div>
          ) : (
            <>
              {!isRestricted && (
                <button
                  onClick={() => setFilterMinistry("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    filterMinistry === "all"
                      ? "bg-indigo text-white shadow-xs"
                      : "bg-gray-100 hover:bg-gray-200 text-charcoal/80"
                  }`}
                >
                  All Church ({totalRosterCount})
                </button>
              )}
              {allowedMinistries.map(m => {
                const countForMin = roster.filter(r => r.ministry_id === m.id).length;
                const presentForMin = roster.filter(r => r.ministry_id === m.id && r.is_present === 1).length;
                const isSelected = filterMinistry === String(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setFilterMinistry(String(m.id))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-indigo text-white shadow-xs"
                        : "bg-gray-100 hover:bg-gray-200 text-charcoal/80"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color || "#2C3968" }}></span>
                    <span>{m.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-white text-charcoal/70 shadow-2xs"}`}>
                      {presentForMin}/{countForMin}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Search Input & Household Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search member or family..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
            />
          </div>

          <select
            value={selectedHousehold}
            onChange={(e) => setSelectedHousehold(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs bg-white text-charcoal/80 focus:ring-2 focus:ring-indigo/20 outline-none font-medium"
          >
            <option value="all">All Households</option>
            {householdsList.map(h => (
              <option key={h} value={h}>{h} Family</option>
            ))}
          </select>
        </div>
      </div>

      {/* MAIN ATTENDANCE ROSTER LIST */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-charcoal">
                Sunday Service Attendee Directory ({filteredRoster.length})
              </h2>
              <p className="text-[11px] text-charcoal/50">
                Click "Mark Present" to register live Sunday morning attendance or print minor security tags.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              {presentCount} Present
            </span>
          </div>
        </div>

        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-charcoal/60 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Ministry</th>
                <th className="py-3 px-4">Household / Family</th>
                <th className="py-3 px-4">Security Tag</th>
                <th className="py-3 px-4">Status & Time</th>
                <th className="py-3 px-4 text-right">Attendance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-charcoal/50">
                    <AlertCircle className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
                    <p className="font-bold text-xs">No members found matching your search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => {
                  const isPresent = item.is_present === 1;
                  const isChecking = actionLoading === item.member_id;
                  const isMinor = item.ministry_name === "Kinder" || item.ministry_name === "Elementary";

                  return (
                    <tr key={item.member_id} className={`hover:bg-indigo-50/20 transition-colors ${isPresent ? "bg-emerald-50/30" : ""}`}>
                      {/* Member Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${
                            isPresent 
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300" 
                              : "bg-gray-100 text-charcoal/70 border-gray-200"
                          }`}>
                            {item.first_name[0]}{item.last_name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-charcoal flex items-center gap-1.5">
                              <span>{item.first_name} {item.last_name}</span>
                              {item.member_status === "Visitor" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  GUEST
                                </span>
                              )}
                            </div>
                            {item.medical_notes && (
                              <p className="text-[10px] text-rose-600 font-semibold truncate max-w-xs">
                                ⚠️ {item.medical_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ministry */}
                      <td className="py-3.5 px-4">
                        <span 
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-2xs inline-block"
                          style={{ backgroundColor: item.ministry_color || "#2C3968" }}
                        >
                          {item.ministry_name}
                        </span>
                      </td>

                      {/* Household */}
                      <td className="py-3.5 px-4">
                        {item.household_name ? (
                          <div className="flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-charcoal/40 shrink-0" />
                            <span className="font-bold text-charcoal">{item.household_name} Family</span>
                          </div>
                        ) : (
                          <span className="text-charcoal/40 italic text-[11px]">Individual</span>
                        )}
                      </td>

                      {/* Security Tag */}
                      <td className="py-3.5 px-4">
                        {item.security_code ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 font-mono font-black text-[11px] shadow-2xs">
                            <Tag className="w-3 h-3 text-amber-600" />
                            <span>{item.security_code}</span>
                          </span>
                        ) : isMinor ? (
                          <span className="text-[10px] text-charcoal/40 italic">Generated on check-in</span>
                        ) : (
                          <span className="text-[10px] text-charcoal/40">—</span>
                        )}
                      </td>

                      {/* Status & Time */}
                      <td className="py-3.5 px-4">
                        {isPresent ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Present</span>
                            </div>
                            {item.checked_in_at && (
                              <p className="text-[10px] text-charcoal/50 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-charcoal/40" />
                                {new Date(item.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-charcoal/60">
                            Not Present
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPresent ? (
                            <>
                              {/* Checkout button for minors */}
                              {item.security_code && !item.checked_out_at && (
                                <button
                                  onClick={() => {
                                    const match = activeCheckins.find(c => c.member_id === item.member_id);
                                    if (match) setCheckoutRecord(match);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all flex items-center gap-1"
                                >
                                  <KeyRound className="w-3 h-3 text-rose-600" />
                                  <span>Check Out</span>
                                </button>
                              )}

                              {/* Undo present button */}
                              <button
                                onClick={() => handleUndoAttendance(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-charcoal/70 text-[11px] font-semibold transition-all"
                                title="Undo attendance mark"
                              >
                                Undo
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleMarkPresent(item)}
                              disabled={isChecking}
                              className="px-3 py-1.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5 text-amber-300" />
                              <span>{isChecking ? "Marking..." : "Mark Present"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK GUEST CHECK-IN MODAL */}
      {isGuestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Quick Guest / Visitor Check-In</h3>
                  <p className="text-[11px] text-charcoal/50">Register first-time attendee for Sunday Service</p>
                </div>
              </div>
              <button onClick={() => setIsGuestModalOpen(false)} className="p-1.5 text-charcoal/40 hover:text-charcoal rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAndCheckInGuest} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-charcoal mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John"
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>
                <div>
                  <label className="block font-bold text-charcoal mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doe"
                    value={guestLastName}
                    onChange={(e) => setGuestLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Ministry Assignment *</label>
                <select
                  value={guestMinistryId}
                  onChange={(e) => setGuestMinistryId(Number(e.target.value))}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo bg-white disabled:opacity-90 disabled:cursor-not-allowed"
                >
                  {allowedMinistries.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.min_age || 0} - {m.max_age || "adult"} yrs)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Contact Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+63 912 345 6789"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Notes / Invited By</label>
                <input
                  type="text"
                  placeholder="e.g. Invited by Santos Family"
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>Register & Mark Present</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE SECURITY TAG MODAL (Kinder & Elementary) */}
      {issuedBadge && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-7 h-7 text-amber-600" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Sunday Minor Security Tag
              </span>
              <h3 className="text-xl font-black text-charcoal mt-1">{issuedBadge.member_name}</h3>
              <p className="text-xs text-charcoal/60 font-semibold">{issuedBadge.ministry_name}</p>
            </div>

            {/* Claim Tag Box */}
            <div className="p-4 rounded-2xl bg-indigo-950 text-white space-y-1 shadow-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Parent Claim Code</span>
              <div className="text-3xl font-black font-mono tracking-widest text-amber-400">
                {issuedBadge.security_code}
              </div>
              <p className="text-[10px] text-indigo-200">Keep this code to safely claim your child after service</p>
            </div>

            {issuedBadge.medical_notes && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs text-left">
                <span className="font-bold">Medical Alert:</span> {issuedBadge.medical_notes}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-charcoal hover:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tag</span>
              </button>
              <button
                onClick={() => setIssuedBadge(null)}
                className="flex-1 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-OUT SECURITY CODE MODAL */}
      {checkoutRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo" />
                <h3 className="font-bold text-sm text-charcoal">Verify Parent Claim Code</h3>
              </div>
              <button onClick={() => { setCheckoutRecord(null); setCheckoutError(""); }} className="p-1 text-charcoal/40 hover:text-charcoal">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-charcoal/70">
              Enter the matching parent security tag code to check out <strong className="text-charcoal font-bold">{checkoutRecord.first_name} {checkoutRecord.last_name}</strong>.
            </p>

            {checkoutError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
                {checkoutError}
              </div>
            )}

            <form onSubmit={handlePerformCheckout} className="space-y-3">
              <input
                type="text"
                required
                placeholder="e.g. KND-7482"
                value={checkoutCodeInput}
                onChange={(e) => setCheckoutCodeInput(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-center font-mono font-bold text-base uppercase tracking-wider outline-none focus:border-indigo"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCheckoutRecord(null); setCheckoutError(""); }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
                >
                  Verify & Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
