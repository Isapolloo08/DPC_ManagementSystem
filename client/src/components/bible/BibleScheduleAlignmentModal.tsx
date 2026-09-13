import React, { useState, useEffect } from "react";
import {
  X, Sliders, Sparkles, Check, RotateCcw,
  BookOpen, Calendar, HelpCircle, ArrowRight
} from "lucide-react";
import {
  ALL_BIBLE_BOOKS,
  getReadingPlanAnchor,
  setReadingPlanAnchor,
  resetReadingPlanOffset,
  getTodaysReading,
  DayReading
} from "../../utils/bibleReadingPlan";

interface BibleScheduleAlignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  year?: number;
}

export const BibleScheduleAlignmentModal: React.FC<BibleScheduleAlignmentModalProps> = ({
  isOpen,
  onClose,
  year = new Date().getFullYear()
}) => {
  const currentAnchor = getReadingPlanAnchor();
  const [selectedBook, setSelectedBook] = useState<string>(currentAnchor.book);
  const [selectedChapter, setSelectedChapter] = useState<number>(currentAnchor.chapter);
  const [todayReading, setTodayReading] = useState<DayReading>(getTodaysReading());
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const bookInfo = ALL_BIBLE_BOOKS.find(b => b.name === selectedBook) || ALL_BIBLE_BOOKS[0];

  useEffect(() => {
    if (isOpen) {
      const a = getReadingPlanAnchor();
      setSelectedBook(a.book);
      setSelectedChapter(a.chapter);
      setTodayReading(getTodaysReading());
      setSavedFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAlignToEzekiel29 = () => {
    setReadingPlanAnchor("Ezekiel", 29);
    setSelectedBook("Ezekiel");
    setSelectedChapter(29);
    setTodayReading(getTodaysReading());
    setSavedFeedback("Schedule successfully calibrated to Ezekiel 29!");
    setTimeout(() => setSavedFeedback(null), 3500);
  };

  const handleCustomAlign = () => {
    setReadingPlanAnchor(selectedBook, selectedChapter);
    setTodayReading(getTodaysReading());
    setSavedFeedback(`Schedule aligned to ${selectedBook} ${selectedChapter}!`);
    setTimeout(() => setSavedFeedback(null), 3500);
  };

  const handleReset = () => {
    resetReadingPlanOffset(true); // reset to church default Ezekiel 29
    setSelectedBook("Ezekiel");
    setSelectedChapter(29);
    setTodayReading(getTodaysReading());
    setSavedFeedback("Reset to DPC Church default (Ezekiel 29).");
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Church Schedule Alignment</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Calibrate
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Sync today's assigned reading with your church's guide
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          
          {/* Current Live Benchmark Box */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-sky-900 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-sky-600" /> Currently Assigned Today
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-sky-200/70 text-sky-900 rounded-md font-bold">
                {todayReading.dayName}
              </span>
            </div>
            <div className="text-2xl font-black text-sky-950">
              {todayReading.passageDisplay}
            </div>
            <div className="text-xs text-slate-600 flex items-center justify-between">
              <span>Day {todayReading.dayIndex} of 365</span>
              <span className="text-sky-700 font-bold">{todayReading.isSunday ? "Sunday: 5 Chapters" : "Weekday: 3 Chapters"}</span>
            </div>
          </div>

          {savedFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedFeedback}</span>
            </div>
          )}

          {/* Quick Preset 1: DPC Church Guide Default */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
              Recommended Alignment Preset
            </label>
            <button
              type="button"
              onClick={handleAlignToEzekiel29}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md shadow-sky-600/20 text-left transition-all flex items-center justify-between group active:scale-98"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-sky-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> D.P.C. Church Schedule
                </div>
                <div className="text-base font-black">
                  Align to Ezekiel 29 (Ezekiel 25–29 Today)
                </div>
                <div className="text-[11px] text-sky-100/90 font-medium">
                  5 chapters for Sunday concluding exactly on Ezekiel Chapter 29
                </div>
              </div>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>

          {/* Custom Anchor Selector */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
              Custom Schedule Calibration
            </label>
            <p className="text-xs text-slate-500">
              Select which Bible book and chapter your church is reading today:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Bible Book</label>
                <select
                  value={selectedBook}
                  onChange={(e) => {
                    setSelectedBook(e.target.value);
                    setSelectedChapter(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {ALL_BIBLE_BOOKS.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.chapters} ch)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Chapter (1 to {bookInfo.chapters})
                </label>
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {Array.from({ length: bookInfo.chapters }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      Chapter {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCustomAlign}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm transition-all"
            >
              Align Schedule to {selectedBook} {selectedChapter}
            </button>
          </div>

          {/* Reset Option */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need to reset to church standard?</span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-slate-600 hover:text-sky-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset to Ezekiel 29 Default
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
