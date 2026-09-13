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
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-indigo-800/40">
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Heading and Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
              <BookOpen className="w-3 h-3" /> 1-Year Bible Reading Plan
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
              NIV
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              todayReading.isSunday ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-indigo-400/20 text-indigo-200 border border-indigo-400/30"
            }`}>
              {todayReading.isSunday ? "Sunday: 5 Chapters" : "Weekday: 3 Chapters"}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-black rounded-full">
              <BookmarkCheck className="w-3 h-3" /> Schedule Monitor
            </span>
          </div>

          <div className="pt-0.5">
            <div className="text-xs text-slate-300 font-medium">
              Day {todayReading.dayIndex} of 365 • {todayReading.dayName}, {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
              {todayReading.passageDisplay}
            </h3>
          </div>

          {/* Chapters Breakdown Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {todayReading.chapters.map((chap) => (
              <span
                key={`${chap.book}-${chap.chapter}`}
                className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
              >
                {chap.shortName} {chap.chapter}
              </span>
            ))}
            <span className="text-[11px] text-slate-400 pl-1 font-medium">
              ({todayReading.testamentSummary})
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t border-white/10 sm:border-t-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all shadow-md shadow-sky-500/20 active:scale-95"
            >
              <BookOpen className="w-4 h-4 text-slate-950" />
              Read Today's Passage (NIV)
            </button>
          </div>

          {onNavigateToPlan && (
            <button
              type="button"
              onClick={onNavigateToPlan}
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200 transition-colors group"
            >
              Full 1-Year Reading Schedule <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Footer */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span>Schedule Progress:</span>
          <span className="font-black text-amber-300">{progressPercent}%</span>
          <span className="text-[11px] text-slate-400">({scheduledCount} / {TOTAL_BIBLE_CHAPTERS} chapters covered to date)</span>
        </div>
        <div className="hidden sm:block w-32 bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-400 to-sky-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
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
