import React, { useState, useEffect } from "react";
import { BookOpen, ArrowRight, Sparkles, Calendar, BookMarked, BookmarkCheck } from "lucide-react";
import { getTodaysReading, DayReading, TOTAL_BIBLE_CHAPTERS, getScheduledTargetUpToDate } from "../../utils/bibleReadingPlan";
import { ScripturePassageModal } from "./ScripturePassageModal";

interface TodayBibleReadingWidgetProps {
  onNavigateToPlan?: () => void;
  compact?: boolean;
}

export const TodayBibleReadingWidget: React.FC<TodayBibleReadingWidgetProps> = ({
  onNavigateToPlan,
  compact = false
}) => {
  const [todayReading, setTodayReading] = useState<DayReading>(getTodaysReading());
  const [scheduledTarget, setScheduledTarget] = useState(getScheduledTargetUpToDate(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setTodayReading(getTodaysReading());
      setScheduledTarget(getScheduledTargetUpToDate(new Date()));
    };
    handleUpdate();
    window.addEventListener("bible-plan-offset-changed", handleUpdate);
    return () => window.removeEventListener("bible-plan-offset-changed", handleUpdate);
  }, []);

  const scheduledCount = scheduledTarget.scheduledChaptersCount;
  const progressPercent = Math.min(100, Number(((scheduledCount / TOTAL_BIBLE_CHAPTERS) * 100).toFixed(1)));
  const remainingChapters = Math.max(0, TOTAL_BIBLE_CHAPTERS - scheduledCount);

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-white to-sky-50/40 rounded-2xl border border-sky-100 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">Daily Bible Reading (NIV)</h4>
              <p className="text-[10px] text-slate-500">{todayReading.isSunday ? "Sunday (5 Ch)" : "Weekday (3 Ch)"}</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
            Day {todayReading.dayIndex}/365
          </span>
        </div>

        <div className="bg-white rounded-xl p-3 border border-sky-100/80 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Today's Assigned Passage</span>
            <h3 className="text-sm font-black text-slate-900">{todayReading.passageDisplay}</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            Read
          </button>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1"
          >
            Read Scripture (NIV) <ArrowRight className="w-3 h-3" />
          </button>
          {onNavigateToPlan && (
            <button
              type="button"
              onClick={onNavigateToPlan}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              1-Year Plan
            </button>
          )}
        </div>

        {isModalOpen && (
          <ScripturePassageModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            dayReading={todayReading}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-white/10">
      <img
        src="/container_bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center opacity-30 mix-blend-screen pointer-events-none"
      />
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Top Row: Left Badges & Right Annual Coverage Progress */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/15 text-white border border-white/20 backdrop-blur-md">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>1-Year Bible Reading Plan</span>
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
              NIV
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${todayReading.isSunday ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-white/10 text-slate-200 border border-white/15"
              }`}>
              {todayReading.isSunday ? "Sunday: 5 Chapters" : "Weekday: 3 Chapters"}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-black rounded-full">
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Schedule Synced</span>
            </span>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Annual Coverage</span>
              <span className="font-black text-cyan-400 text-sm">{progressPercent}%</span>
            </div>
            <div className="w-44 bg-white/15 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {scheduledCount} / {TOTAL_BIBLE_CHAPTERS} chapters completed to-date
            </span>
          </div>
        </div>

        {/* Middle Row: Today's Assigned Passage */}
        <div className="pt-1">
          <div className="text-xs text-slate-300 font-medium">
            Day {todayReading.dayIndex} of 365 • {todayReading.dayName}, {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </div>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mt-0.5">
            {todayReading.passageDisplay}
          </h3>
        </div>

        {/* Bottom Row: Chapter Breakdown Chips & Read Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 flex-wrap">
            {todayReading.chapters.map((chap, i) => (
              <span
                key={`${chap.book}-${chap.chapter}`}
                className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-bold backdrop-blur-md border border-white/15 transition-all shadow-xs"
              >
                {chap.shortName} {chap.chapter} {i === 0 ? "· Today's Start" : i === todayReading.chapters.length - 1 ? "· Reading Target" : ""}
              </span>
            ))}
            <span className="text-xs text-slate-400 font-semibold pl-1">
              ({todayReading.testamentSummary})
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black bg-white hover:bg-slate-100 text-slate-950 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-indigo-950" />
              <span>Read Today's Chapters</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-950" />
            </button>
            {onNavigateToPlan && (
              <button
                type="button"
                onClick={onNavigateToPlan}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white transition-colors px-2 py-1"
              >
                <span>Full Plan</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {isModalOpen && (
        <ScripturePassageModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          dayReading={todayReading}
        />
      )}
    </div>
  );
};
