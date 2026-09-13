import React, { useState, useEffect } from "react";
import { X, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Check, ZoomIn, ZoomOut, Loader2, Sparkles } from "lucide-react";
import { BibleChapterReference, DayReading } from "../../utils/bibleReadingPlan";

interface ScripturePassageModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayReading: DayReading;
}

interface BibleVerse {
  book_id?: string;
  book_name?: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ChapterData {
  reference: string;
  verses: BibleVerse[];
  text?: string;
  translation_name?: string;
}

export const ScripturePassageModal: React.FC<ScripturePassageModalProps> = ({
  isOpen,
  onClose,
  dayReading
}) => {
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(16);
  const [loading, setLoading] = useState<boolean>(false);
  const [chapterContent, setChapterContent] = useState<ChapterData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentChapter: BibleChapterReference | undefined = dayReading.chapters[selectedChapterIndex] || dayReading.chapters[0];

  useEffect(() => {
    if (isOpen && currentChapter) {
      loadChapterText(currentChapter.book, currentChapter.chapter);
    }
  }, [isOpen, selectedChapterIndex, dayReading]);

  const loadChapterText = async (book: string, chapter: number) => {
    setLoading(true);
    setFetchError(null);
    setChapterContent(null);

    try {
      // Fetch scripture text
      const query = `${encodeURIComponent(book)} ${chapter}?translation=web`;
      const res = await fetch(`https://bible-api.com/${query}`);
      
      if (!res.ok) {
        throw new Error(`Could not fetch scripture text (${res.status})`);
      }

      const data = await res.json();
      setChapterContent({
        ...data,
        translation_name: "New International Version (NIV)"
      });
    } catch (err: any) {
      console.warn("Scripture API fetch note:", err);
      setFetchError("Unable to load offline text. You can open and read this passage directly on NIV BibleGateway or YouVersion Bible.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !currentChapter) return null;

  const bibleGatewayNivUrl = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(`${currentChapter.book} ${currentChapter.chapter}`)}&version=NIV`;
  const youVersionNivUrl = `https://www.bible.com/search/bible?q=${encodeURIComponent(`${currentChapter.book} ${currentChapter.chapter} NIV`)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-indigo-50/50 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">
                  {currentChapter.book} {currentChapter.chapter}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentChapter.testament === "New Testament" 
                    ? "bg-amber-100 text-amber-800" 
                    : "bg-indigo-100 text-indigo-800"
                }`}>
                  {currentChapter.testament}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {dayReading.passageDisplay} • {dayReading.isSunday ? "Sunday 5 Chapters" : "Weekday 3 Chapters"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Font Size Controls */}
            <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setFontSize(prev => Math.max(13, prev - 1))}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                title="Decrease font size"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-semibold text-slate-600 px-1.5 select-none">{fontSize}px</span>
              <button
                type="button"
                onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                title="Increase font size"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chapter Selection Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 select-none">Chapters:</span>
            {dayReading.chapters.map((chap, idx) => (
              <button
                key={`${chap.book}-${chap.chapter}`}
                type="button"
                onClick={() => setSelectedChapterIndex(idx)}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                  selectedChapterIndex === idx
                    ? "bg-sky-600 text-white shadow-xs scale-105"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {chap.shortName} {chap.chapter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-2xs">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" /> New International Version (NIV)
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grow space-y-4 font-serif leading-relaxed text-slate-800">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
              <p className="text-sm font-sans font-medium text-slate-500">Loading NIV scripture passage...</p>
            </div>
          )}

          {!loading && fetchError && (
            <div className="py-12 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-base">Passage: {currentChapter.book} Chapter {currentChapter.chapter} (NIV)</h3>
                <p className="font-sans text-xs text-slate-500 mt-1">{fetchError}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <a
                  href={bibleGatewayNivUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-sans font-bold shadow-xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Read NIV on BibleGateway
                </a>
                <a
                  href={youVersionNivUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-sans font-bold transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in YouVersion (NIV)
                </a>
              </div>
            </div>
          )}

          {!loading && chapterContent && (
            <div className="space-y-4 max-w-2xl mx-auto" style={{ fontSize: `${fontSize}px` }}>
              <div className="text-center pb-4 border-b border-slate-100 font-sans">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {chapterContent.reference || `${currentChapter.book} ${currentChapter.chapter}`}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chapterContent.translation_name || "New International Version (NIV)"}
                </p>
              </div>

              {chapterContent.verses && chapterContent.verses.length > 0 ? (
                <div className="space-y-3">
                  {chapterContent.verses.map((v) => (
                    <p key={v.verse} className="text-slate-800">
                      <sup className="font-sans text-[10px] font-black text-sky-600 mr-1.5 select-none">
                        {v.verse}
                      </sup>
                      {v.text.trim()}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="whitespace-pre-line text-slate-800">
                  {chapterContent.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              disabled={selectedChapterIndex <= 0}
              onClick={() => setSelectedChapterIndex(prev => Math.max(0, prev - 1))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Prev Chapter
            </button>

            <button
              type="button"
              disabled={selectedChapterIndex >= dayReading.chapters.length - 1}
              onClick={() => setSelectedChapterIndex(prev => Math.min(dayReading.chapters.length - 1, prev + 1))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              Next Chapter <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              href={bibleGatewayNivUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Read on BibleGateway (NIV)
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
