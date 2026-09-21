import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../api";
import { EventItem, EventAttendeeItem, EventAttendanceRosterResponse } from "../../types";
import {
  X,
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  Users,
  Sparkles,
  PartyPopper,
  Calendar,
  MapPin,
  Check
} from "lucide-react";
import { useSocketEvent } from "../../socket";

interface EventAttendanceModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EventAttendanceModal: React.FC<EventAttendanceModalProps> = ({
  event,
  isOpen,
  onClose
}) => {
  const [rosterData, setRosterData] = useState<EventAttendanceRosterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [markingMemberId, setMarkingMemberId] = useState<number | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "attended" | "registered">("all");

  const loadRoster = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEventAttendanceRoster(event.id);
      setRosterData(data);
    } catch (err: any) {
      console.error("Failed to load event attendance roster:", err);
      setError(err?.message || "Failed to load event attendance");
    } finally {
      setLoading(false);
    }
  }, [event]);

  useEffect(() => {
    if (isOpen && event) {
      loadRoster();
    }
  }, [isOpen, event, loadRoster]);

  // Real-time updates when attendance or RSVP changes
  useSocketEvent("events:changed", (payload) => {
    if (isOpen && event && (payload?.event_id === event.id || payload?.id === event.id)) {
      loadRoster();
    }
  });

  if (!isOpen || !event) return null;

  const handleToggleAttendance = async (memberId: number, currentStatus: string) => {
    try {
      setMarkingMemberId(memberId);
      const newStatus = currentStatus === "attended" ? "registered" : "attended";
      await api.markEventAttendance(event.id, {
        member_id: memberId,
        status: newStatus
      });
      await loadRoster();
    } catch (err: any) {
      alert(`Failed to update attendance: ${err.message || "Unknown error"}`);
    } finally {
      setMarkingMemberId(null);
    }
  };

  const attendees = rosterData?.attendees || [];
  const filteredAttendees = attendees.filter((a) => {
    const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || (a.ministry_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === "attended") return a.status === "attended";
    if (filterTab === "registered") return a.status === "registered";
    return true;
  }).sort((a, b) => {
    const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
    const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const totalAttended = rosterData?.summary.total_attended || 0;
  const totalRegistered = rosterData?.summary.total_registered || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-charcoal/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200/90 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-950 via-indigo-950 to-stone-900 text-white flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="p-3 bg-purple-500/20 text-purple-300 rounded-2xl border border-purple-400/30">
              <PartyPopper className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {event.title}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-purple-200/80 font-medium mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(event.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white bg-white/5 hover:bg-white/15 rounded-xl transition relative z-10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter Summary Strip */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Attended</div>
            <div className="text-xl font-black text-emerald-700 mt-0.5">{totalAttended}</div>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pre-Registered (RSVP)</div>
            <div className="text-xl font-black text-indigo mt-0.5">{totalRegistered}</div>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Turnout Rate</div>
            <div className="text-xl font-black text-purple-900 mt-0.5">
              {totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : totalAttended > 0 ? 100 : 0}%
            </div>
          </div>
        </div>

        {/* Search & Filter Strip */}
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member by name..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterTab === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              All Members
            </button>
            <button
              onClick={() => setFilterTab("attended")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                filterTab === "attended" ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Present ({totalAttended})</span>
            </button>
            <button
              onClick={() => setFilterTab("registered")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                filterTab === "registered" ? "bg-indigo text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <span>RSVP Only ({totalRegistered})</span>
            </button>
          </div>
        </div>

        {/* Members Roster List */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-stone-100">
          {loading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-indigo animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-500">Loading attendee list...</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <div className="text-sm font-bold text-rose-900">{error}</div>
              <button
                onClick={loadRoster}
                className="px-4 py-1.5 bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredAttendees.length === 0 && (
            <div className="py-12 text-center text-stone-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-xs font-bold">No matching members found.</p>
            </div>
          )}

          {!loading && !error && filteredAttendees.map((att) => {
            const isAttended = att.status === "attended";
            const isBusy = markingMemberId === att.member_id;

            return (
              <div
                key={att.member_id}
                className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-stone-50/80 rounded-xl transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isAttended
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-stone-100 text-stone-600 border border-stone-200"
                    }`}
                  >
                    {isAttended ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : `${att.first_name[0]}${att.last_name[0]}`}
                  </div>

                  <div className="min-w-0">
                    <div className="font-extrabold text-charcoal text-xs sm:text-sm truncate">
                      {att.first_name} {att.last_name}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500">
                      <span>{att.ministry_name}</span>
                      {att.status === "registered" && (
                        <span className="text-indigo font-bold">• RSVP Confirmed</span>
                      )}
                      {isAttended && (
                        <span className="text-emerald-700 font-bold">• Present & Checked-In</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAttendance(att.member_id, att.status)}
                  disabled={isBusy}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${
                    isAttended
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                      : "bg-indigo text-white hover:bg-indigo-900"
                  }`}
                >
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAttended ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Present</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Mark Present</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-3.5 flex items-center justify-between">
          <span className="text-xs text-stone-500 font-medium">
            Marked attendance automatically syncs to the central Attendance Log.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
