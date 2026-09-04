import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { EventItem, BirthdayCelebrant, BirthdaySummary } from "../types";
import {
  Calendar as CalendarIcon, Plus, MapPin, Clock, Users,
  CheckCircle2, ChevronLeft, ChevronRight, Filter, Search,
  Layers, LayoutGrid, List, X, Sparkles, AlertCircle,
  Cake, Gift, PartyPopper, Send, Check
} from "lucide-react";

export const EventsPage: React.FC = () => {
  const { user, ministries, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayCelebrant[]>([]);
  const [showBirthdays, setShowBirthdays] = useState<boolean>(true);

  const initialMinistry = isRestricted && allowedMinistries.length > 0
    ? String(allowedMinistries[0].id)
    : (selectedMinistryId ? String(selectedMinistryId) : "");

  const [filterMinistry, setFilterMinistry] = useState<string>(initialMinistry);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "agenda">("calendar");

  // Calendar navigation state (defaults to August 2026 from project timeline)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date(2026, 7, 28)); // Aug 28, 2026

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedBirthday, setSelectedBirthday] = useState<BirthdayCelebrant | null>(null);
  const [greetingMessage, setGreetingMessage] = useState<string>("");
  const [greetingSuccess, setGreetingSuccess] = useState<boolean>(false);
  const [sendingGreeting, setSendingGreeting] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    start_time: "2026-08-30T09:30",
    end_time: "2026-08-30T11:30",
    location: "Main Sanctuary"
  });

  // Sync filter when coordinator restrictions change
  useEffect(() => {
    if (isRestricted && allowedMinistries.length > 0) {
      setFilterMinistry(String(allowedMinistries[0].id));
      setFormData(prev => ({ ...prev, ministry_id: String(allowedMinistries[0].id) }));
    }
  }, [isRestricted, allowedMinistries]);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const res = await api.getLookups({ type: "event_location", active_only: true });
      if (res && res.length > 0) {
        setLocations(res.map(l => l.name));
      }
    } catch (e) {
      console.warn("Failed to load locations", e);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [filterMinistry]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const [eventsRes, bdaysRes] = await Promise.all([
        api.getEvents({ ministry_id: filterMinistry ? Number(filterMinistry) : undefined }),
        api.getBirthdays({ ministry_id: filterMinistry ? Number(filterMinistry) : undefined, timeframe: "all" })
      ]);
      setEvents(eventsRes);
      setBirthdays(bdaysRes.celebrants || []);
    } catch (err) {
      console.error("Failed to load events / birthdays:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEvent({
        ...formData,
        ministry_id: formData.ministry_id ? Number(formData.ministry_id) : null
      });
      setIsCreateModalOpen(false);
      setFormData({
        title: "",
        description: "",
        ministry_id: "",
        start_time: "2026-08-30T09:30",
        end_time: "2026-08-30T11:30",
        location: ""
      });
      loadEvents();
    } catch (err: any) {
      alert(err.message || "Failed to create event");
    }
  };

  const handleRsvp = async (eventId: number) => {
    try {
      await api.rsvpEvent(eventId);
      loadEvents();
      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent(prev => prev ? { ...prev, rsvp_count: (prev.rsvp_count || 0) + 1 } : null);
      }
    } catch (err: any) {
      alert(err.message || "RSVP failed");
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const matchSearch = !searchQuery ||
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.location && evt.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (evt.description && evt.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [events, searchQuery]);

  // Calendar Math and Grid Generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToday = () => {
    setCurrentDate(new Date(2026, 7, 28));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleOpenBirthdayModal = (celebrant: BirthdayCelebrant) => {
    setSelectedBirthday(celebrant);
    setGreetingMessage(
      `Happy ${celebrant.turning_age}th Birthday, ${celebrant.first_name}! 🎂 "The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25). Wishing you God's richest peace and blessings!`
    );
    setGreetingSuccess(false);
  };

  const handleSendBirthdayGreeting = async () => {
    if (!selectedBirthday) return;
    try {
      setSendingGreeting(true);
      await api.sendBirthdayGreeting(selectedBirthday.id, {
        message: greetingMessage,
        channel: "announcement"
      });
      setGreetingSuccess(true);
      setTimeout(() => {
        setSelectedBirthday(null);
        setGreetingSuccess(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to send birthday blessing");
    } finally {
      setSendingGreeting(false);
    }
  };

  const filteredBirthdays = useMemo(() => {
    if (!showBirthdays) return [];
    return birthdays.filter(b => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return b.first_name.toLowerCase().includes(q) ||
        b.last_name.toLowerCase().includes(q) ||
        (b.ministry_name && b.ministry_name.toLowerCase().includes(q));
    });
  }, [birthdays, showBirthdays, searchQuery]);

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: EventItem[];
      birthdays: BirthdayCelebrant[];
    }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayEvts = filteredEvents.filter(e => e.start_time.startsWith(dateStr));
      const targetM = d.getMonth() + 1;
      const targetD = d.getDate();
      const dayBdays = filteredBirthdays.filter(b => b.birth_month === targetM && b.birth_day === targetD);

      days.push({
        date: d,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        events: dayEvts,
        birthdays: dayBdays
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      // Format YYYY-MM-DD
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const datePrefix = `${yyyy}-${mm}-${dd}`;

      const dayEvts = filteredEvents.filter(e => e.start_time.startsWith(datePrefix));
      const targetM = month + 1;
      const dayBdays = filteredBirthdays.filter(b => b.birth_month === targetM && b.birth_day === i);
      const isToday = (i === 28 && month === 7 && year === 2026);

      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: true,
        isToday,
        events: dayEvts,
        birthdays: dayBdays
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const datePrefix = `${yyyy}-${mm}-${dd}`;

      const dayEvts = filteredEvents.filter(e => e.start_time.startsWith(datePrefix));
      const targetM = d.getMonth() + 1;
      const dayBdays = filteredBirthdays.filter(b => b.birth_month === targetM && b.birth_day === i);

      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        events: dayEvts,
        birthdays: dayBdays
      });
    }

    return days;
  }, [year, month, filteredEvents, filteredBirthdays]);

  const upcomingEventsList = useMemo(() => {
    return [...filteredEvents].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [filteredEvents]);

  const activeDetailEvent = selectedEvent || upcomingEventsList[0] || null;
  const canCreate = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="relative overflow-hidden bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
              Ministry Events & Master Calendar
            </h1>
            <span className="bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black px-3 py-1 rounded-full shadow-2xs">
              {filteredEvents.length} Events Listed
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed">
            Interactive church schedule, discipleship fellowships, Sunday celebrations, and RSVP registrations.
          </p>
        </div>

        {/* Top Actions */}
        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center bg-ivory-light p-1 rounded-2xl border border-indigo-100/90 shadow-2xs">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${viewMode === "calendar" ? "bg-indigo-900 text-white shadow-sm" : "text-charcoal/60 hover:text-charcoal"
                }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${viewMode === "agenda" ? "bg-indigo-900 text-white shadow-sm" : "text-charcoal/60 hover:text-charcoal"
                }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda List</span>
            </button>
          </div>

          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>Schedule Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-3xl border border-indigo-100/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Ministry Selector Filter & Birthday Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-charcoal/70">Ministry Filter:</span>
            <select
              value={filterMinistry}
              onChange={(e) => setFilterMinistry(e.target.value)}
              disabled={isRestricted && allowedMinistries.length <= 1}
              className="bg-ivory-light px-3.5 py-2 rounded-2xl text-xs border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-bold text-indigo-900 cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed shadow-2xs"
            >
              {!isRestricted && <option value="">All Church Events</option>}
              {allowedMinistries.map((m) => (
                <option key={m.id} value={m.id}>{m.name} Ministry</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowBirthdays(!showBirthdays)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black transition-all border cursor-pointer ${showBirthdays
                ? "bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 border-amber-400 shadow-sm"
                : "bg-ivory-light text-charcoal/70 border-indigo-100 hover:bg-indigo-50/60"
              }`}
          >
            <Cake className="w-3.5 h-3.5" />
            <span>Member Birthdays ({birthdays.length})</span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search events or celebrants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-ivory-light pl-10 pr-4 py-2 rounded-2xl text-xs border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-medium placeholder:text-charcoal/40"
          />
        </div>
      </div>

      {/* 2-COLUMN LAYOUT: MAIN VIEW (LEFT) + UPCOMING AGENDA & EVENT DETAILS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / MAIN COLUMN */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {viewMode === "calendar" ? (
            <div className="bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
              {/* Calendar Month Navigation Header */}
              <div className="p-5 bg-gradient-to-r from-[#1b2342] via-[#243058] to-[#1b2342] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white/10 text-amber-300">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                      <span>{monthNames[month]} {year}</span>
                    </h2>
                    <p className="text-[11px] text-indigo-200">Click any event to inspect details on the right panel or RSVP</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={jumpToday}
                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all cursor-pointer"
                  >
                    Today
                  </button>
                  <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/20">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Weekday Column Headers */}
              <div className="grid grid-cols-7 bg-indigo-50/40 border-b border-indigo-100/80 text-center py-3 text-xs font-black text-charcoal/70 uppercase text-[10px] tracking-wider">
                <span className="text-rose">Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* 35/42 Days Grid Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-indigo-50">
                {calendarDays.map((day, idx) => {
                  const totalItems = day.events.length + (day.birthdays?.length || 0);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[110px] sm:min-h-[125px] p-2 flex flex-col justify-between transition-colors ${day.isCurrentMonth ? "bg-white hover:bg-indigo-50/30" : "bg-gray-50/60 text-charcoal/30"
                        }`}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${day.isToday
                              ? "bg-amber-400 text-indigo-950 font-black shadow-sm ring-2 ring-amber-300"
                              : day.isCurrentMonth
                                ? "text-charcoal"
                                : "text-charcoal/40"
                            }`}
                        >
                          {day.dayNumber}
                        </span>
                        {totalItems > 0 && (
                          <div className="flex items-center gap-1">
                            {day.events.length > 0 && (
                              <span className="text-[9px] font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-full hidden sm:inline">
                                {day.events.length} evt
                              </span>
                            )}
                            {(day.birthdays?.length || 0) > 0 && (
                              <span className="text-[9px] font-black text-amber-950 bg-amber-100 px-2 py-0.5 rounded-full">
                                🎂 {day.birthdays.length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Attached Events & Birthdays Stack */}
                      <div className="space-y-1 overflow-y-auto max-h-[75px] sm:max-h-[85px] flex-1 no-scrollbar">
                        {/* Events */}
                        {day.events.map((evt) => {
                          const timeStr = new Date(evt.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                          const eventBg = evt.ministry_color || "#2C3968";
                          const isSelected = activeDetailEvent?.id === evt.id;

                          return (
                            <div
                              key={evt.id}
                              onClick={() => setSelectedEvent(evt)}
                              className={`group relative cursor-pointer text-[10px] sm:text-[11px] font-bold p-1.5 rounded-xl text-white shadow-2xs transition-all hover:scale-[1.02] hover:shadow-md truncate ${isSelected ? "ring-2 ring-amber-400 ring-offset-1" : ""
                                }`}
                              style={{ backgroundColor: eventBg }}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] opacity-90 font-mono font-semibold hidden sm:inline">{timeStr}</span>
                                <span className="font-bold truncate">{evt.title}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Birthdays */}
                        {day.birthdays?.map((b) => (
                          <div
                            key={`bday-${b.id}`}
                            onClick={() => handleOpenBirthdayModal(b)}
                            className="group relative cursor-pointer text-[10px] sm:text-[11px] font-bold p-1.5 rounded-xl text-white shadow-2xs transition-all hover:scale-[1.02] hover:shadow-md truncate bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 flex items-center gap-1"
                            title={`Birthday: ${b.first_name} ${b.last_name} turning ${b.turning_age}`}
                          >
                            <Cake className="w-3 h-3 shrink-0" />
                            <span className="truncate">{b.first_name} ({b.turning_age}y)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* VIEW 2: AGENDA / LIST VIEW */
            <div className="space-y-4">
              {/* Celebrants Showcase in Agenda view */}
              {showBirthdays && filteredBirthdays.filter(b => b.birth_month === month + 1).length > 0 && (
                <div className="bg-gradient-to-r from-amber-50/80 via-rose-50/40 to-indigo-50/40 p-5 rounded-3xl border border-amber-200/90 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                        <Cake className="w-4 h-4" />
                      </span>
                      <h3 className="font-black text-sm text-charcoal">
                        {monthNames[month]} Birthday Celebrants ({filteredBirthdays.filter(b => b.birth_month === month + 1).length} Members)
                      </h3>
                    </div>
                    <span className="text-[10px] font-black text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      Pastoral Care Milestone
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredBirthdays.filter(b => b.birth_month === month + 1).map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleOpenBirthdayModal(b)}
                        className="bg-white p-3.5 rounded-2xl border border-amber-200/70 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-950 font-black text-xs flex items-center justify-center">
                            {b.first_name[0]}{b.last_name[0]}
                          </div>
                          <div>
                            <h4 className="font-black text-xs text-charcoal">{b.first_name} {b.last_name}</h4>
                            <p className="text-[10px] text-charcoal/60">{b.ministry_name || "General"} • Turning {b.turning_age}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-rose block">Day {b.birth_day}</span>
                          <span className="text-[9px] text-indigo font-bold underline">Blessing</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredEvents.length === 0 ? (
                <div className="bg-white/95 p-10 rounded-3xl border border-indigo-100 text-center text-xs text-charcoal/50">
                  No events found matching your current filter.
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const isSelected = activeDetailEvent?.id === evt.id;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`bg-white/95 rounded-3xl p-5 sm:p-6 border shadow-sm hover:border-amber-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${isSelected ? "border-indigo-300 ring-2 ring-indigo-200/50 bg-indigo-50/20" : "border-indigo-100/90"
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date Badge */}
                        <div className="w-14 h-14 rounded-2xl bg-ivory-light border border-amber-200 text-center flex flex-col justify-center items-center shrink-0 shadow-2xs">
                          <span className="text-[10px] font-black uppercase text-rose leading-none">
                            {new Date(evt.start_time).toLocaleString([], { month: 'short' })}
                          </span>
                          <span className="text-xl font-black text-indigo leading-tight">
                            {new Date(evt.start_time).getDate()}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-black px-2.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: evt.ministry_color || "#2C3968" }}
                            >
                              {evt.ministry_name || "All-Church"}
                            </span>
                            <span className="text-sm font-black text-charcoal">{evt.title}</span>
                          </div>

                          <p className="text-xs text-charcoal/70 line-clamp-1">{evt.description || "No description."}</p>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-charcoal/60 flex-wrap">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(evt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              {evt.location || "Sanctuary"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                        <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-3.5 py-2 rounded-2xl border border-indigo-100">
                          {evt.rsvp_count || 0} RSVPs
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRsvp(evt.id);
                          }}
                          className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-4 py-2 rounded-2xl text-xs shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-950" />
                          <span>RSVP Going</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )
          }
        </div>
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* CONTAINER 1: UPCOMING AGENDA */}
          <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-800 font-bold">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Upcoming Agenda</h3>
                  <p className="text-[11px] text-charcoal/50">Next scheduled church gatherings</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/80">
                {upcomingEventsList.length} Events
              </span>
            </div>

            {upcomingEventsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-charcoal/50 bg-ivory-light rounded-2xl border border-dashed border-indigo-200/80">
                No upcoming events found for this filter.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                {upcomingEventsList.map((evt) => {
                  const isSelected = activeDetailEvent?.id === evt.id;
                  const dateObj = new Date(evt.start_time);
                  const monthName = dateObj.toLocaleString([], { month: "short" });
                  const dayNum = dateObj.getDate();
                  const timeStr = dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                          ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-200 shadow-2xs"
                          : "bg-white hover:bg-indigo-50/40 border-gray-100 hover:border-indigo-200"
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Mini Date Badge */}
                        <div className="w-11 h-11 rounded-xl bg-ivory-light border border-amber-200 text-center flex flex-col justify-center items-center shrink-0">
                          <span className="text-[9px] font-black uppercase text-rose leading-none">{monthName}</span>
                          <span className="text-sm font-black text-indigo leading-tight">{dayNum}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: evt.ministry_color || "#2C3968" }}
                            />
                            <h4 className="font-black text-xs text-charcoal truncate">{evt.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-charcoal/60 font-medium">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-amber-600" />
                              {timeStr}
                            </span>
                            <span>•</span>
                            <span className="truncate flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              {evt.location || "Sanctuary"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-black text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                          {evt.rsvp_count || 0} RSVPs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CONTAINER 2: EVENT DETAILS */}
          <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Event Details</h3>
                  <p className="text-[10px] text-charcoal/50">Schedule overview & member registration</p>
                </div>
              </div>
              {activeDetailEvent && (
                <span
                  className="text-[10px] font-black px-3 py-1 rounded-full text-white shadow-2xs"
                  style={{ backgroundColor: activeDetailEvent.ministry_color || "#2C3968" }}
                >
                  {activeDetailEvent.ministry_name || "All-Church"}
                </span>
              )}
            </div>

            {activeDetailEvent ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-black text-charcoal leading-snug">
                    {activeDetailEvent.title}
                  </h4>
                  <p className="text-xs text-charcoal/70 mt-1.5 leading-relaxed">
                    {activeDetailEvent.description || "No description provided for this church gathering."}
                  </p>
                </div>

                <div className="space-y-2 p-4 bg-ivory-light/90 rounded-2xl border border-amber-200/60 text-xs">
                  <div className="flex items-center gap-2 text-charcoal font-bold">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {new Date(activeDetailEvent.start_time).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
                      {" — "}
                      {new Date(activeDetailEvent.end_time).toLocaleTimeString([], { timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-charcoal/80 font-medium">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Location: <strong className="text-charcoal font-bold">{activeDetailEvent.location || "Main Sanctuary Hall"}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-2xl border border-indigo-100">
                      👥 {activeDetailEvent.rsvp_count || 0} RSVPs
                    </span>
                  </div>

                  <button
                    onClick={() => handleRsvp(activeDetailEvent.id)}
                    className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-4 py-2 rounded-2xl text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-950" />
                    <span>RSVP Going</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-charcoal/50 bg-ivory-light rounded-2xl border border-dashed border-indigo-200/80 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto text-charcoal/30" />
                <p className="font-bold text-charcoal/70">No event currently selected.</p>
                <p className="text-[11px]">Click on any event on the calendar or agenda to view full details.</p>
                {canCreate && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 font-black text-xs shadow-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule an Event</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* CREATE EVENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo" />
                <span>Schedule New Ministry Event</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-charcoal/50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Highschool IGNITE Night"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Ministry Scope</label>
                <select
                  value={formData.ministry_id}
                  onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo disabled:opacity-90 disabled:cursor-not-allowed"
                >
                  {!isRestricted && <option value="">Church-Wide (All Ministries)</option>}
                  {allowedMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} Ministry</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Start Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">End Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Location / Room</label>
                <input
                  type="text"
                  list="event-locations-list"
                  placeholder="e.g. Main Sanctuary, Youth Loft"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
                <datalist id="event-locations-list">
                  {locations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Event details, schedule, notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md"
                >
                  Publish to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BIRTHDAY CELEBRATION & BLESSING MODAL */}
      {selectedBirthday && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-amber-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-xs">
                  <Cake className="w-6 h-6" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      <span>Birthday Milestone</span>
                    </span>
                    <span className="text-[10px] font-semibold text-charcoal/50">
                      {selectedBirthday.ministry_name || "Discipleship Member"}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-charcoal">
                    {selectedBirthday.first_name} {selectedBirthday.last_name}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedBirthday(null)}
                className="p-1 rounded-full text-charcoal/50 hover:text-charcoal hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-ivory-light p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] text-charcoal/50 block">Birth Date</span>
                <span className="font-bold text-charcoal">
                  {selectedBirthday.birth_month_name} {selectedBirthday.birth_day}
                </span>
              </div>
              <div className="bg-ivory-light p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] text-charcoal/50 block">Turning Age</span>
                <span className="font-bold text-indigo">
                  {selectedBirthday.turning_age} years old
                </span>
              </div>
              <div className="bg-ivory-light p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] text-charcoal/50 block">Countdown</span>
                <span className="font-bold text-amber-700">
                  {selectedBirthday.days_until_birthday === 0 ? "Today! 🎂" : `${selectedBirthday.days_until_birthday} days`}
                </span>
              </div>
            </div>

            {greetingSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-700 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-charcoal text-base">Birthday Blessing Published!</h4>
                <p className="text-xs text-charcoal/60">
                  Pastoral blessing announced to the church community board.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">
                    Pastoral Prayer & Scripture Blessing
                  </label>
                  <textarea
                    rows={3}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    className="w-full bg-ivory-light p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    placeholder="Write your birthday prayer or blessing..."
                  />
                </div>

                {/* Scripture Presets */}
                <div>
                  <span className="text-[10px] font-semibold text-charcoal/50 block mb-1">
                    Quick Scripture Promises:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Numbers 6:24-25",
                        verse: `"The Lord bless you and keep you; the Lord make His face shine upon you!" (Numbers 6:24-25)`
                      },
                      {
                        label: "Jeremiah 29:11",
                        verse: `"For I know the plans I have for you, declares the Lord, to give you a future and a hope." (Jeremiah 29:11)`
                      },
                      {
                        label: "Psalm 20:4",
                        verse: `"May He grant you your heart's desire and fulfill all your plans!" (Psalm 20:4)`
                      }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setGreetingMessage(
                            `Happy ${selectedBirthday.turning_age}th Birthday, ${selectedBirthday.first_name}! 🎂 ${item.verse} Praying God's continued grace over you!`
                          );
                        }}
                        className="text-[10px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 rounded-lg border border-amber-200/80 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBirthday(null)}
                    className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBirthdayGreeting}
                    disabled={sendingGreeting || !greetingMessage.trim()}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingGreeting ? "Posting..." : "Publish Blessing"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
