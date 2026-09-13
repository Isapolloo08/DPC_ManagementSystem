import React, { useState, useMemo, useEffect } from "react";
import {
  BookOpen, Calendar, Search, Printer, Sparkles,
  ArrowUpRight, BookMarked, BookmarkCheck, Award, Sliders
} from "lucide-react";
import {
  getCachedPlanForYear, getTodaysReading, DayReading,
  TOTAL_BIBLE_CHAPTERS, getScheduledTargetUpToDate
} from "../utils/bibleReadingPlan";
import { ScripturePassageModal } from "../components/common/ScripturePassageModal";
import { DpcBibleGridGuide } from "../components/bible/DpcBibleGridGuide";
import { BibleScheduleAlignmentModal } from "../components/bible/BibleScheduleAlignmentModal";

export const BibleReadingPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [viewMode, setViewMode] = useState<"dpc-guide" | "calendar">("dpc-guide");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [selectedTestament, setSelectedTestament] = useState<"all" | "Old Testament" | "New Testament">("all");
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "covered" | "upcoming">("all");

  const [activePassageModal, setActivePassageModal] = useState<DayReading | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isAlignmentModalOpen, setIsAlignmentModalOpen] = useState<boolean>(false);
  const [planVersion, setPlanVersion] = useState<number>(0);

  useEffect(() => {
    const handleOffsetChange = () => {
      setPlanVersion(v => v + 1);
    };
    window.addEventListener("bible-plan-offset-changed", handleOffsetChange);
    return () => window.removeEventListener("bible-plan-offset-changed", handleOffsetChange);
  }, []);

  // Full year plan and scheduled target
  const fullPlan = useMemo(() => getCachedPlanForYear(selectedYear), [selectedYear, planVersion]);
  const todayReading = useMemo(() => getTodaysReading(new Date()), [planVersion]);
  const scheduledTarget = useMemo(() => getScheduledTargetUpToDate(new Date(), selectedYear), [selectedYear, planVersion]);

  // Filtered readings for calendar view
  const filteredPlan = useMemo(() => {
    return fullPlan.filter(item => {
      // Month filter
      if (selectedMonth !== "all") {
        if (!item.dateString) return true;
        const monthNum = parseInt(item.dateString.split("-")[1], 10);
        if (monthNum !== selectedMonth) return false;
      }

      // Testament filter
      if (selectedTestament !== "all") {
        if (!item.testamentSummary.includes(selectedTestament)) return false;
      }

      // Schedule status filter
      if (scheduleFilter === "covered") {
        if (item.dayIndex > todayReading.dayIndex) return false;
      } else if (scheduleFilter === "upcoming") {
        if (item.dayIndex <= todayReading.dayIndex) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesPassage = item.passageDisplay.toLowerCase().includes(query);
        const matchesDate = item.dateString?.toLowerCase().includes(query);
        const matchesDayName = item.dayName.toLowerCase().includes(query);
        const matchesChapters = item.chapters.some(c => 
          c.book.toLowerCase().includes(query) || `${c.book.toLowerCase()} ${c.chapter}`.includes(query)
        );
        return matchesPassage || matchesDate || matchesDayName || matchesChapters;
      }

      return true;
    });
  }, [fullPlan, selectedMonth, selectedTestament, scheduleFilter, searchQuery, todayReading.dayIndex]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const scheduledCount = scheduledTarget.scheduledChaptersCount;
  const progressPercent = Math.min(100, Number(((scheduledCount / TOTAL_BIBLE_CHAPTERS) * 100).toFixed(1)));
  const remainingChapters = Math.max(0, TOTAL_BIBLE_CHAPTERS - scheduledCount);

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
      
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-800/40">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                <Sparkles className="w-3.5 h-3.5" /> 1-Year Bible Reading Plan & Cycle
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                NIV Edition
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Read Through the Entire Bible in 1 Year
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Complete all 66 Books and 1,189 chapters with a sustainable, inspiring pace (New International Version - NIV): 
              <span className="font-bold text-sky-300"> 3 chapters every Monday to Saturday</span> and 
              <span className="font-bold text-amber-300"> 5 chapters on Sunday</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAlignmentModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-black shadow-md transition-all active:scale-95"
              title="Calibrate schedule to match church reading benchmark"
            >
              <Sliders className="w-4 h-4 text-sky-400" /> Calibrate Schedule
            </button>
            <button
              type="button"
              onClick={() => setIsPrinting(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-2xl text-xs font-black shadow-lg shadow-sky-500/25 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" /> Printable Guide
            </button>
          </div>
        </div>

        {/* Stats Grid inside Hero Banner */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
              <Calendar className="w-4 h-4 text-amber-400" /> Current Day
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              Day {todayReading.dayIndex} <span className="text-xs font-bold text-slate-400">/ 365</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{todayReading.dayName}, {todayReading.dateString}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-sky-300 text-xs font-bold uppercase tracking-wider mb-1">
              <BookOpen className="w-4 h-4 text-sky-400" /> Chapters Scheduled
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {scheduledCount} <span className="text-xs font-bold text-slate-400">/ 1,189</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{progressPercent}% of Holy Bible</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
              <BookmarkCheck className="w-4 h-4 text-indigo-400" /> Remaining Chapters
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {remainingChapters} <span className="text-xs font-bold text-slate-400">chapters</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">To finish full Bible in 1 year</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
              <Award className="w-4 h-4 text-emerald-400" /> Today's Reading
            </div>
            <div className="text-base sm:text-lg font-black text-white truncate">
              {todayReading.passageDisplay}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{todayReading.isSunday ? "5 Chapters" : "3 Chapters"} • {todayReading.testamentSummary}</p>
          </div>
        </div>
      </div>

      {/* Today's Reading Highlight Section */}
      <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Today's Reading Assignment</h2>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  todayReading.isSunday ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                }`}>
                  {todayReading.isSunday ? "Sunday 5 Chapters" : "Weekday 3 Chapters"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Day {todayReading.dayIndex} of 365 • {todayReading.dayName}, {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePassageModal(todayReading)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Read Today's Passage (NIV)
            </button>
          </div>
        </div>

        {/* Big Passage Display */}
        <div className="bg-gradient-to-r from-sky-50 via-indigo-50/40 to-slate-50 rounded-2xl p-5 border border-sky-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-black text-sky-700 uppercase tracking-wider">Passage for Today</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {todayReading.passageDisplay}
            </div>
            <p className="text-xs text-slate-500">
              {todayReading.testamentSummary} • Total of {todayReading.chapters.length} chapters today
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {todayReading.chapters.map((chap) => (
              <span
                key={`${chap.book}-${chap.chapter}`}
                className="px-3 py-1.5 rounded-xl bg-white border border-sky-200 text-slate-800 text-xs font-bold shadow-2xs"
              >
                {chap.book} Chapter {chap.chapter}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main View Mode Switcher Tabs */}
      <div className="flex items-center justify-center sm:justify-start gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setViewMode("dpc-guide")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all ${
            viewMode === "dpc-guide"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <BookMarked className="w-4 h-4 text-amber-400" />
          <span>D.P.C. Bible Reading Guide (Photo Sheet Grid)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold ml-1">
            Photo Style
          </span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all ${
            viewMode === "calendar"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Calendar className="w-4 h-4 text-sky-400" />
          <span>365-Day Daily Schedule Plan</span>
        </button>
      </div>

      {/* VIEW 1: D.P.C. Printed Guide Grid View (Matches User's Photo Exactly) */}
      {viewMode === "dpc-guide" && (
        <DpcBibleGridGuide
          year={selectedYear}
        />
      )}

      {/* VIEW 2: 365-Day Calendar Schedule Plan */}
      {viewMode === "calendar" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Controls & Filters */}
          <div className="space-y-4">
            {/* Month Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedMonth("all")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shrink-0 transition-all ${
                  selectedMonth === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                All Year (365 Days)
              </button>
              {monthNames.map((month, idx) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setSelectedMonth(idx + 1)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shrink-0 transition-all ${
                    selectedMonth === idx + 1
                      ? "bg-sky-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>

            {/* Search and Secondary Filter Row */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by book (e.g. Genesis, Matthew, Romans)..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
                <select
                  value={selectedTestament}
                  onChange={(e) => setSelectedTestament(e.target.value as any)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Testaments</option>
                  <option value="Old Testament">Old Testament (OT)</option>
                  <option value="New Testament">New Testament (NT)</option>
                </select>

                <select
                  value={scheduleFilter}
                  onChange={(e) => setScheduleFilter(e.target.value as any)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All 365 Days</option>
                  <option value="covered">Covered Up to Today</option>
                  <option value="upcoming">Upcoming Readings</option>
                </select>

                <span className="text-xs text-slate-500 font-medium shrink-0 pl-1">
                  Showing <span className="font-bold text-slate-900">{filteredPlan.length}</span> days
                </span>
              </div>
            </div>
          </div>

          {/* Reading Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlan.map((day) => {
              const isToday = day.dayIndex === todayReading.dayIndex;
              const isPassed = day.dayIndex < todayReading.dayIndex;

              return (
                <div
                  key={day.dayIndex}
                  onClick={() => setActivePassageModal(day)}
                  className={`group cursor-pointer rounded-2xl p-4 transition-all duration-200 border relative flex flex-col justify-between gap-3 ${
                    isToday
                      ? "bg-gradient-to-br from-sky-50 via-white to-sky-50/30 border-sky-400 shadow-md ring-2 ring-sky-400/20"
                      : isPassed
                      ? "bg-slate-50/60 border-slate-200/80 shadow-2xs hover:shadow-md hover:border-sky-300"
                      : "bg-white border-slate-200 shadow-2xs hover:shadow-md hover:border-sky-300"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Day {day.dayIndex}
                        </span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 bg-sky-600 text-white font-black text-[9px] rounded-md tracking-wider uppercase">
                            Today
                          </span>
                        )}
                        {isPassed && (
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 font-bold text-[9px] rounded-md tracking-wider">
                            Covered
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          day.isSunday ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {day.isSunday ? "Sunday (5 Ch)" : "3 Ch"}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">
                        {day.dayName}, {day.dateString}
                      </div>
                    </div>

                    <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-100 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      NIV
                    </span>
                  </div>

                  {/* Passage Title */}
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-sky-700 transition-colors flex items-center justify-between">
                      <span>{day.passageDisplay}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-600 opacity-0 group-hover:opacity-100 transition-all" />
                    </h3>

                    {/* Chapter chips */}
                    <div className="flex items-center gap-1 flex-wrap mt-2">
                      {day.chapters.map((chap) => (
                        <span
                          key={`${chap.book}-${chap.chapter}`}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-semibold text-slate-700"
                        >
                          {chap.shortName} {chap.chapter}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-medium">{day.testamentSummary}</span>
                    <span className="text-sky-600 font-bold group-hover:underline">Read NIV Passage →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {filteredPlan.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No reading assignments found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query, month, or testament filter to find scheduled chapters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedMonth("all");
              setSelectedTestament("all");
              setScheduleFilter("all");
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Passage Reader Modal */}
      {activePassageModal && (
        <ScripturePassageModal
          isOpen={Boolean(activePassageModal)}
          onClose={() => setActivePassageModal(null)}
          dayReading={activePassageModal}
        />
      )}

      {/* Printable Schedule Modal */}
      {isPrinting && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900">1-Year Bible Reading Schedule (Print View)</h2>
                <p className="text-xs text-slate-500">Mon-Sat: 3 Chapters / Day • Sunday: 5 Chapters / Day • 1,189 Total Chapters</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-sky-700 transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrinting(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto grow space-y-6 text-slate-900 text-xs print:p-0 print:text-black">
              <div className="text-center pb-4 border-b border-slate-200">
                <h1 className="text-2xl font-black">Daily Bible Reading Plan (1-Year Cycle)</h1>
                <p className="text-slate-600 text-xs mt-1">Discipleship Church • Genesis to Revelation in 365 Days (NIV)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {fullPlan.map((d) => (
                  <div key={d.dayIndex} className="p-2.5 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      <span className="font-bold text-slate-500 mr-1.5">Day {d.dayIndex}:</span>
                      <span className="font-black text-slate-900">{d.passageDisplay}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {d.isSunday ? "Sun (5)" : "3 Ch"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Church Schedule Alignment Modal */}
      <BibleScheduleAlignmentModal
        isOpen={isAlignmentModalOpen}
        onClose={() => setIsAlignmentModalOpen(false)}
        year={selectedYear}
      />

    </div>
  );
};
