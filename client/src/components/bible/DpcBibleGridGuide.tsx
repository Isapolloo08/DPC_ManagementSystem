import React, { useState, useMemo, useEffect } from "react";
import {
  Printer, Sparkles, BookOpen, BookmarkCheck, Calendar, Eye, Sliders
} from "lucide-react";
import {
  getDpcGuideStructure, TOTAL_BIBLE_CHAPTERS,
  getScheduledTargetUpToDate, getCachedPlanForYear,
  BibleChapterReference
} from "../../utils/bibleReadingPlan";
import { useAuth } from "../../context/AuthContext";
import { ScripturePassageModal } from "../common/ScripturePassageModal";
import { BibleScheduleAlignmentModal } from "./BibleScheduleAlignmentModal";

interface DpcBibleGridGuideProps {
  year?: number;
}

export const DpcBibleGridGuide: React.FC<DpcBibleGridGuideProps> = ({
  year = new Date().getFullYear()
}) => {
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>(user?.name || "Church Member");
  const [markStyle, setMarkStyle] = useState<"slash" | "pen" | "fill" | "check">("slash");
  const [activeTestamentTab, setActiveTestamentTab] = useState<"all" | "Old Testament" | "New Testament">("all");
  const [activeReadingChapter, setActiveReadingChapter] = useState<BibleChapterReference | null>(null);
  const [isAlignmentModalOpen, setIsAlignmentModalOpen] = useState<boolean>(false);
  const [planVersion, setPlanVersion] = useState<number>(0);

  useEffect(() => {
    const handleOffsetChange = () => {
      setPlanVersion(v => v + 1);
    };
    window.addEventListener("bible-plan-offset-changed", handleOffsetChange);
    return () => window.removeEventListener("bible-plan-offset-changed", handleOffsetChange);
  }, []);

  const guideStructure = getDpcGuideStructure();
  const scheduledTarget = useMemo(() => getScheduledTargetUpToDate(new Date(), year), [year, planVersion]);
  const plan = useMemo(() => getCachedPlanForYear(year), [year, planVersion]);

  // Map each chapter key ("Book:Chapter") to its scheduled day info
  const chapterScheduleMap = useMemo(() => {
    const map = new Map<string, { dayIndex: number; dateString?: string; isPassedOrToday: boolean }>();
    for (let i = 0; i < plan.length; i++) {
      const day = plan[i];
      const isPassedOrToday = day.dayIndex <= scheduledTarget.targetDayIndex;
      for (const c of day.chapters) {
        const key = `${c.book}:${c.chapter}`;
        map.set(key, { dayIndex: day.dayIndex, dateString: day.dateString, isPassedOrToday });
        if (c.book === "Song of Solomon") {
          map.set(`Song of Songs:${c.chapter}`, { dayIndex: day.dayIndex, dateString: day.dateString, isPassedOrToday });
        }
      }
    }
    return map;
  }, [plan, scheduledTarget.targetDayIndex]);

  const scheduledCount = scheduledTarget.scheduledChaptersCount;
  const progressPercent = Math.min(100, Number(((scheduledCount / TOTAL_BIBLE_CHAPTERS) * 100).toFixed(1)));
  const remainingChapters = Math.max(0, TOTAL_BIBLE_CHAPTERS - scheduledCount);

  const handlePrint = () => {
    window.print();
  };

  const handleCellClick = (bookName: string, chapterNum: number) => {
    const testament: "Old Testament" | "New Testament" = 
      ["Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"].includes(bookName)
        ? "New Testament"
        : "Old Testament";

    setActiveReadingChapter({
      book: bookName,
      chapter: chapterNum,
      testament,
      shortName: bookName.substring(0, 4),
      globalIndex: 0
    });
  };

  const cols25 = Array.from({ length: 25 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      
      {/* 1. Top Schedule Monitor Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-indigo-800/40 space-y-5 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                <BookmarkCheck className="w-3.5 h-3.5 text-sky-400" /> 1-Year Bible Reading Guide Monitor
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                NIV Edition
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-200">
                Automated Progress Schedule
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              D.P.C. Church Bible Reading Schedule Tracker
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              This digital guide monitors the church's annual reading progress (3 chapters Mon–Sat, 5 chapters Sunday). Chapters up to today are automatically checked off to show current progress. Click any chapter to read the NIV scripture passage.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setIsAlignmentModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-black shadow-md transition-all flex items-center gap-2 active:scale-95"
              title="Calibrate schedule to match church reading benchmark"
            >
              <Sliders className="w-4 h-4 text-sky-400" /> Calibrate Schedule
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-sky-600/25 transition-all flex items-center gap-2 active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print Sheet
            </button>
          </div>
        </div>

        {/* 3-Column Schedule Monitor Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-white/10">
          
          {/* Box 1: Current Benchmark Today */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-sky-300 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-sky-400" /> Today's Assigned Reading
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-sky-500/20 text-sky-200 rounded-md font-bold">
                Day {scheduledTarget.targetDayIndex} of 365
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {scheduledTarget.currentBenchmarkPassage}
            </div>
            <p className="text-[11px] text-slate-400">
              {scheduledTarget.todaysReading.isSunday ? "Sunday 5 Chapters" : "Weekday 3 Chapters"} • {scheduledTarget.todaysReading.testamentSummary}
            </p>
          </div>

          {/* Box 2: Chapters Covered To Date */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-300 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <BookmarkCheck className="w-4 h-4 text-indigo-400" /> Chapters Covered to Date
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-200 rounded-md font-bold">
                {progressPercent}% of Bible
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {scheduledCount} <span className="text-xs font-medium text-slate-400">/ 1,189 chapters</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {remainingChapters} chapters remaining in annual cycle
            </p>
          </div>

          {/* Box 3: Schedule Pace Rule */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" /> Reading Schedule Cadence
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded-md font-bold">
                1-Year Cycle
              </span>
            </div>
            <div className="text-base sm:text-lg font-black text-amber-300">
              Mon–Sat: 3 Ch/day • Sun: 5 Ch
            </div>
            <p className="text-[11px] text-slate-400">
              23 chapters/week • All 66 books covered in 365 days
            </p>
          </div>

        </div>
      </div>
      
      {/* 2. Grid Toolbar / Interactive Controls */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-slate-900">D.P.C. Bible Reading Guide (Grid Sheet)</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                NIV Edition
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Matches church handout layout. Automatically marked up to today's date. Click any chapter to read!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          {/* Testament Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTestamentTab("all")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTestamentTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Both (Full Bible)
            </button>
            <button
              type="button"
              onClick={() => setActiveTestamentTab("Old Testament")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTestamentTab === "Old Testament" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Old Testament
            </button>
            <button
              type="button"
              onClick={() => setActiveTestamentTab("New Testament")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTestamentTab === "New Testament" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              New Testament
            </button>
          </div>

          {/* Mark Style Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <span className="text-[10px] text-slate-500 uppercase px-1.5 hidden sm:inline">Style:</span>
            <button
              type="button"
              onClick={() => setMarkStyle("slash")}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                markStyle === "slash" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Classic diagonal pen slash"
            >
              ✍️ Slash ( / )
            </button>
            <button
              type="button"
              onClick={() => setMarkStyle("pen")}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                markStyle === "pen" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Fine pen cross mark"
            >
              ✕ Pen Cross
            </button>
            <button
              type="button"
              onClick={() => setMarkStyle("fill")}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                markStyle === "fill" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Pastel highlighter"
            >
              🟩 Highlight
            </button>
            <button
              type="button"
              onClick={() => setMarkStyle("check")}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                markStyle === "check" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Checkmark badge"
            >
              ✓ Check
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Printer className="w-4 h-4" /> Print Sheet
          </button>
        </div>
      </div>

      {/* Main Printed Sheet Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 font-sans text-slate-900 max-w-5xl mx-auto overflow-x-auto">
        
        {/* Printable Sheet Header (Exact replica of church handout photo) */}
        <div className="text-center pb-5 mb-5 border-b-2 border-slate-900 space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-slate-900 uppercase">
              D.P.C. {year} Bible Reading Guide
            </h1>
            <span className="text-xs font-black px-2 py-0.5 bg-slate-900 text-white rounded-md tracking-wider">
              NIV
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs sm:text-sm font-bold text-slate-800 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span>Name:</span>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter Your Name"
                className="font-black border-b-2 border-slate-400 focus:border-slate-900 outline-hidden px-2 py-0.5 text-center bg-transparent w-48 sm:w-64"
              />
            </div>
          </div>
          <p className="text-xs sm:text-sm font-black text-rose-700 tracking-wide pt-1">
            Everyday 3 Chapters and Every Sunday 5 Chapters.
          </p>
        </div>

        {/* Testaments Render Loop */}
        <div className="space-y-10">
          {guideStructure
            .filter(t => activeTestamentTab === "all" || t.testament === activeTestamentTab)
            .map((testamentData) => (
              <div
                key={testamentData.testament}
                className="space-y-4 print:break-inside-avoid print:page-break-after-always"
              >
                {/* Testament Header Badge */}
                <div className="text-center">
                  <span className={`inline-block px-8 py-1.5 rounded-full text-base sm:text-lg font-black tracking-wide border-2 ${
                    testamentData.testament === "Old Testament"
                      ? "bg-rose-50 text-rose-800 border-rose-600 shadow-xs"
                      : "bg-sky-50 text-sky-800 border-sky-600 shadow-xs"
                  }`}>
                    {testamentData.testament}
                  </span>
                </div>

                {/* Table Layout */}
                <div className="border-2 border-slate-800 rounded-lg overflow-hidden text-[10px] sm:text-[11px]">
                  <table className="w-full border-collapse table-fixed select-none">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-800 text-slate-700 font-bold text-center">
                        <th className="w-[12%] p-1 border-r border-slate-400">Category</th>
                        <th className="w-[16%] p-1 border-r border-slate-800 text-left pl-2">Book</th>
                        {cols25.map((c) => (
                          <th key={c} className="p-0.5 border-r border-slate-300 font-semibold text-[9px] text-slate-500 last:border-r-0">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {testamentData.categories.map((category, catIdx) => {
                        // Calculate total row span for category
                        const totalCategoryRows = category.books.reduce((sum, b) => sum + b.rows.length, 0);
                        let isFirstCategoryRow = true;

                        return category.books.map((book, bookIdx) => {
                          return book.rows.map((rowRange, rowIdx) => {
                            const showCategoryCell = isFirstCategoryRow;
                            isFirstCategoryRow = false;

                            const showBookName = rowIdx === 0;
                            const isLastBookRow = rowIdx === book.rows.length - 1;
                            const isLastCategoryBook = bookIdx === category.books.length - 1 && isLastBookRow;

                            return (
                              <tr
                                key={`${book.name}-row-${rowIdx}`}
                                className={`hover:bg-sky-50/30 transition-colors ${
                                  isLastBookRow ? "border-b border-slate-400" : "border-b border-dashed border-slate-200"
                                } ${isLastCategoryBook ? "border-b-2 border-slate-800" : ""}`}
                              >
                                {/* Vertical Category Label (Span across all books in this category) */}
                                {showCategoryCell && (
                                  <td
                                    rowSpan={totalCategoryRows}
                                    className="border-r-2 border-slate-800 bg-slate-50/80 text-center font-black text-slate-800 align-middle p-1 tracking-widest uppercase text-[10px] sm:text-xs"
                                    style={{
                                      writingMode: "vertical-rl",
                                      textOrientation: "upright",
                                      letterSpacing: "2px"
                                    }}
                                  >
                                    {category.verticalLabel}
                                  </td>
                                )}

                                {/* Book Name */}
                                <td
                                  className={`p-1.5 border-r-2 border-slate-800 font-bold text-slate-900 truncate pl-2 ${
                                    rowIdx > 0 ? "text-slate-400 italic font-medium" : ""
                                  }`}
                                  title={book.name}
                                >
                                  {showBookName ? book.name : ""}
                                </td>

                                {/* 25 Numbered / Scheduled Chapter Boxes */}
                                {cols25.map((colNum) => {
                                  const chapterNum = rowRange.startChapter + colNum - 1;
                                  const isWithinBook = chapterNum <= rowRange.endChapter;

                                  if (!isWithinBook) {
                                    // Empty blank grid box (outside chapter range for this book)
                                    return (
                                      <td
                                        key={colNum}
                                        className="border-r border-slate-300 bg-slate-50/30 p-0 text-center align-middle last:border-r-0 h-6 sm:h-7"
                                      />
                                    );
                                  }

                                  const chapKey = `${book.name}:${chapterNum}`;
                                  const scheduleInfo = chapterScheduleMap.get(chapKey);
                                  const isChecked = Boolean(scheduleInfo?.isPassedOrToday);

                                  let cellBgClass = "bg-white text-slate-800 hover:bg-sky-100 hover:text-sky-900";
                                  if (isChecked) {
                                    if (markStyle === "fill") {
                                      cellBgClass = "bg-emerald-100/90 text-emerald-950 font-black border-emerald-300";
                                    } else if (markStyle === "slash") {
                                      cellBgClass = "bg-blue-50/30 text-slate-900 hover:bg-blue-50";
                                    } else if (markStyle === "pen") {
                                      cellBgClass = "bg-indigo-50/30 text-slate-900 hover:bg-indigo-50";
                                    } else if (markStyle === "check") {
                                      cellBgClass = "bg-emerald-50/40 text-slate-900 hover:bg-emerald-50";
                                    }
                                  }

                                  return (
                                    <td
                                      key={colNum}
                                      onClick={() => handleCellClick(book.name, chapterNum)}
                                      className={`border-r border-slate-400 p-0 text-center align-middle cursor-pointer transition-all relative select-none last:border-r-0 h-6 sm:h-7 font-bold ${cellBgClass}`}
                                      title={`${book.name} Chapter ${chapterNum} • ${
                                        scheduleInfo
                                          ? `Day ${scheduleInfo.dayIndex} (${scheduleInfo.dateString})`
                                          : "Scheduled"
                                      } - Click to read NIV passage`}
                                    >
                                      {/* Chapter Number Label */}
                                      <span className="relative z-10 text-[9px] sm:text-[10px] font-bold">
                                        {chapterNum}
                                      </span>

                                      {/* Mark 1: Clean Authentic Diagonal Pen Slash */}
                                      {isChecked && markStyle === "slash" && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                          <svg viewBox="0 0 24 24" className="w-full h-full text-blue-700/60 p-0.5">
                                            <path
                                              d="M4 20 L20 4"
                                              stroke="currentColor"
                                              strokeWidth="1.6"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                        </div>
                                      )}

                                      {/* Mark 2: Refined Delicate Pen Cross */}
                                      {isChecked && markStyle === "pen" && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                          <svg viewBox="0 0 24 24" className="w-full h-full text-blue-800/50 p-0.5">
                                            <path
                                              d="M5 5 L19 19 M19 5 L5 19"
                                              stroke="currentColor"
                                              strokeWidth="1.25"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                        </div>
                                      )}

                                      {/* Mark 3: Clean Checkmark Badge */}
                                      {isChecked && markStyle === "check" && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                          <svg viewBox="0 0 24 24" className="w-full h-full text-emerald-600/70 p-1">
                                            <path
                                              d="M4 12 L9 17 L20 6"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              fill="none"
                                            />
                                          </svg>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>

        {/* Sheet Footer */}
        <div className="mt-8 pt-4 border-t border-slate-400 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Current Schedule Progress:</span>
            <span className="font-black text-rose-700">{scheduledCount} / {TOTAL_BIBLE_CHAPTERS} chapters covered ({progressPercent}%)</span>
          </div>
          <div className="italic text-slate-500 text-[11px]">
            Discipleship Church • 1-Year Bible Reading Guide (NIV)
          </div>
        </div>

      </div>

      {/* Scripture Reader Modal */}
      {activeReadingChapter && (
        <ScripturePassageModal
          isOpen={Boolean(activeReadingChapter)}
          onClose={() => setActiveReadingChapter(null)}
          dayReading={{
            dayIndex: 0,
            dateString: "",
            dayOfWeek: 0,
            dayName: "",
            isSunday: false,
            targetChapterCount: 1,
            chapters: [activeReadingChapter],
            passageDisplay: `${activeReadingChapter.book} ${activeReadingChapter.chapter}`,
            testamentSummary: activeReadingChapter.testament
          }}
        />
      )}

      {/* Church Schedule Alignment Modal */}
      <BibleScheduleAlignmentModal
        isOpen={isAlignmentModalOpen}
        onClose={() => setIsAlignmentModalOpen(false)}
        year={year}
      />

    </div>
  );
};
