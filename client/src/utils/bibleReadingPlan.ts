export interface BibleBookInfo {
  name: string;
  shortName: string;
  chapters: number;
  testament: "Old Testament" | "New Testament";
  division: "Law" | "History" | "Poetry" | "Major Prophets" | "Minor Prophets" | "Gospels" | "Church History" | "Pauline Epistles" | "General Epistles" | "Prophecy";
}

export interface BibleChapterReference {
  book: string;
  shortName: string;
  chapter: number;
  testament: "Old Testament" | "New Testament";
  globalIndex: number; // 1 to 1189
}

export interface DayReading {
  dayIndex: number; // 1 to 365
  dateString?: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName: string; // "Sunday", "Monday", etc.
  isSunday: boolean;
  targetChapterCount: number; // 5 for Sunday, 3 for Monday-Saturday
  chapters: BibleChapterReference[];
  passageDisplay: string; // e.g., "Genesis 1–3" or "Genesis 49–50, Exodus 1"
  testamentSummary: string; // "Old Testament", "New Testament", or "Old & New Testament"
  isYearEndBonus?: boolean;
}

export const ALL_BIBLE_BOOKS: BibleBookInfo[] = [
  // --- OLD TESTAMENT (39 Books, 929 Chapters) ---
  // Law (Pentateuch)
  { name: "Genesis", shortName: "Gen", chapters: 50, testament: "Old Testament", division: "Law" },
  { name: "Exodus", shortName: "Exo", chapters: 40, testament: "Old Testament", division: "Law" },
  { name: "Leviticus", shortName: "Lev", chapters: 27, testament: "Old Testament", division: "Law" },
  { name: "Numbers", shortName: "Num", chapters: 36, testament: "Old Testament", division: "Law" },
  { name: "Deuteronomy", shortName: "Deu", chapters: 34, testament: "Old Testament", division: "Law" },
  // History
  { name: "Joshua", shortName: "Jos", chapters: 24, testament: "Old Testament", division: "History" },
  { name: "Judges", shortName: "Jdg", chapters: 21, testament: "Old Testament", division: "History" },
  { name: "Ruth", shortName: "Rut", chapters: 4, testament: "Old Testament", division: "History" },
  { name: "1 Samuel", shortName: "1Sa", chapters: 31, testament: "Old Testament", division: "History" },
  { name: "2 Samuel", shortName: "2Sa", chapters: 24, testament: "Old Testament", division: "History" },
  { name: "1 Kings", shortName: "1Ki", chapters: 22, testament: "Old Testament", division: "History" },
  { name: "2 Kings", shortName: "2Ki", chapters: 25, testament: "Old Testament", division: "History" },
  { name: "1 Chronicles", shortName: "1Ch", chapters: 29, testament: "Old Testament", division: "History" },
  { name: "2 Chronicles", shortName: "2Ch", chapters: 36, testament: "Old Testament", division: "History" },
  { name: "Ezra", shortName: "Ezr", chapters: 10, testament: "Old Testament", division: "History" },
  { name: "Nehemiah", shortName: "Neh", chapters: 13, testament: "Old Testament", division: "History" },
  { name: "Esther", shortName: "Est", chapters: 10, testament: "Old Testament", division: "History" },
  // Poetry / Wisdom
  { name: "Job", shortName: "Job", chapters: 42, testament: "Old Testament", division: "Poetry" },
  { name: "Psalms", shortName: "Psa", chapters: 150, testament: "Old Testament", division: "Poetry" },
  { name: "Proverbs", shortName: "Pro", chapters: 31, testament: "Old Testament", division: "Poetry" },
  { name: "Ecclesiastes", shortName: "Ecc", chapters: 12, testament: "Old Testament", division: "Poetry" },
  { name: "Song of Solomon", shortName: "Sng", chapters: 8, testament: "Old Testament", division: "Poetry" },
  // Major Prophets
  { name: "Isaiah", shortName: "Isa", chapters: 66, testament: "Old Testament", division: "Major Prophets" },
  { name: "Jeremiah", shortName: "Jer", chapters: 52, testament: "Old Testament", division: "Major Prophets" },
  { name: "Lamentations", shortName: "Lam", chapters: 5, testament: "Old Testament", division: "Major Prophets" },
  { name: "Ezekiel", shortName: "Ezk", chapters: 48, testament: "Old Testament", division: "Major Prophets" },
  { name: "Daniel", shortName: "Dan", chapters: 12, testament: "Old Testament", division: "Major Prophets" },
  // Minor Prophets
  { name: "Hosea", shortName: "Hos", chapters: 14, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Joel", shortName: "Jol", chapters: 3, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Amos", shortName: "Amo", chapters: 9, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Obadiah", shortName: "Oba", chapters: 1, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Jonah", shortName: "Jon", chapters: 4, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Micah", shortName: "Mic", chapters: 7, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Nahum", shortName: "Nam", chapters: 3, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Habakkuk", shortName: "Hab", chapters: 3, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Zephaniah", shortName: "Zep", chapters: 3, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Haggai", shortName: "Hag", chapters: 2, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Zechariah", shortName: "Zec", chapters: 14, testament: "Old Testament", division: "Minor Prophets" },
  { name: "Malachi", shortName: "Mal", chapters: 4, testament: "Old Testament", division: "Minor Prophets" },

  // --- NEW TESTAMENT (27 Books, 260 Chapters) ---
  // Gospels
  { name: "Matthew", shortName: "Mat", chapters: 28, testament: "New Testament", division: "Gospels" },
  { name: "Mark", shortName: "Mrk", chapters: 16, testament: "New Testament", division: "Gospels" },
  { name: "Luke", shortName: "Luk", chapters: 24, testament: "New Testament", division: "Gospels" },
  { name: "John", shortName: "Jhn", chapters: 21, testament: "New Testament", division: "Gospels" },
  // Church History
  { name: "Acts", shortName: "Act", chapters: 28, testament: "New Testament", division: "Church History" },
  // Pauline Epistles
  { name: "Romans", shortName: "Rom", chapters: 16, testament: "New Testament", division: "Pauline Epistles" },
  { name: "1 Corinthians", shortName: "1Co", chapters: 16, testament: "New Testament", division: "Pauline Epistles" },
  { name: "2 Corinthians", shortName: "2Co", chapters: 13, testament: "New Testament", division: "Pauline Epistles" },
  { name: "Galatians", shortName: "Gal", chapters: 6, testament: "New Testament", division: "Pauline Epistles" },
  { name: "Ephesians", shortName: "Eph", chapters: 6, testament: "New Testament", division: "Pauline Epistles" },
  { name: "Philippians", shortName: "Php", chapters: 4, testament: "New Testament", division: "Pauline Epistles" },
  { name: "Colossians", shortName: "Col", chapters: 4, testament: "New Testament", division: "Pauline Epistles" },
  { name: "1 Thessalonians", shortName: "1Th", chapters: 5, testament: "New Testament", division: "Pauline Epistles" },
  { name: "2 Thessalonians", shortName: "2Th", chapters: 3, testament: "New Testament", division: "Pauline Epistles" },
  { name: "1 Timothy", shortName: "1Ti", chapters: 6, testament: "New Testament", division: "Pauline Epistles" },
  { name: "2 Timothy", shortName: "2Ti", chapters: 4, testament: "New Testament", division: "Pauline Epistles" },
  { name: "Titus", shortName: "Tit", chapters: 3, testament: "New Testament", division: "Pauline Epistles" },
  { name: "Philemon", shortName: "Phm", chapters: 1, testament: "New Testament", division: "Pauline Epistles" },
  // General Epistles
  { name: "Hebrews", shortName: "Heb", chapters: 13, testament: "New Testament", division: "General Epistles" },
  { name: "James", shortName: "Jas", chapters: 5, testament: "New Testament", division: "General Epistles" },
  { name: "1 Peter", shortName: "1Pe", chapters: 5, testament: "New Testament", division: "General Epistles" },
  { name: "2 Peter", shortName: "2Pe", chapters: 3, testament: "New Testament", division: "General Epistles" },
  { name: "1 John", shortName: "1Jn", chapters: 5, testament: "New Testament", division: "General Epistles" },
  { name: "2 John", shortName: "2Jn", chapters: 1, testament: "New Testament", division: "General Epistles" },
  { name: "3 John", shortName: "3Jn", chapters: 1, testament: "New Testament", division: "General Epistles" },
  { name: "Jude", shortName: "Jud", chapters: 1, testament: "New Testament", division: "General Epistles" },
  // Prophecy
  { name: "Revelation", shortName: "Rev", chapters: 22, testament: "New Testament", division: "Prophecy" },
];

export const TOTAL_BIBLE_CHAPTERS = ALL_BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0); // 1,189

/**
 * Generate flat ordered list of all 1,189 chapters in the Bible
 */
export const ALL_CHAPTERS_LIST: BibleChapterReference[] = (() => {
  const list: BibleChapterReference[] = [];
  let index = 1;
  for (const book of ALL_BIBLE_BOOKS) {
    for (let c = 1; c <= book.chapters; c++) {
      list.push({
        book: book.name,
        shortName: book.shortName,
        chapter: c,
        testament: book.testament,
        globalIndex: index++
      });
    }
  }
  return list;
})();

/**
 * Formats a list of consecutive or mixed chapters into human readable string
 * e.g. [{book: "Genesis", chapter: 1}, {book: "Genesis", chapter: 2}, {book: "Genesis", chapter: 3}] -> "Genesis 1–3"
 * e.g. [{book: "Genesis", chapter: 50}, {book: "Exodus", chapter: 1}] -> "Genesis 50, Exodus 1"
 */
export function formatPassageDisplay(chapters: BibleChapterReference[]): string {
  if (!chapters || chapters.length === 0) return "Reflection & Catch-up";

  const bookGroups: { book: string; chapters: number[] }[] = [];
  for (const chap of chapters) {
    const lastGroup = bookGroups[bookGroups.length - 1];
    if (lastGroup && lastGroup.book === chap.book) {
      lastGroup.chapters.push(chap.chapter);
    } else {
      bookGroups.push({ book: chap.book, chapters: [chap.chapter] });
    }
  }

  const parts = bookGroups.map(bg => {
    if (bg.chapters.length === 1) {
      return `${bg.book} ${bg.chapters[0]}`;
    }
    const min = Math.min(...bg.chapters);
    const max = Math.max(...bg.chapters);
    if (max - min === bg.chapters.length - 1) {
      return `${bg.book} ${min}–${max}`;
    }
    return `${bg.book} ${bg.chapters.join(", ")}`;
  });

  return parts.join(" & ");
}

/**
 * Helper to determine day of week names
 */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DPC_ANCHOR_BOOK_KEY = "dpc_bible_anchor_book";
const DPC_ANCHOR_CHAP_KEY = "dpc_bible_anchor_chapter";
const DPC_OFFSET_STORAGE_KEY = "dpc_bible_reading_offset";

// Default church calibration anchor: Ezekiel 29 on current church benchmark
export const DEFAULT_ANCHOR_BOOK = "Ezekiel";
export const DEFAULT_ANCHOR_CHAPTER = 29;

/**
 * Get current church reading plan anchor (defaults to Ezekiel 29)
 */
export function getReadingPlanAnchor(): { book: string; chapter: number } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { book: DEFAULT_ANCHOR_BOOK, chapter: DEFAULT_ANCHOR_CHAPTER };
  }
  const storedBook = localStorage.getItem(DPC_ANCHOR_BOOK_KEY);
  const storedChap = localStorage.getItem(DPC_ANCHOR_CHAP_KEY);
  if (storedBook && storedChap) {
    const chapNum = parseInt(storedChap, 10);
    if (!isNaN(chapNum) && chapNum > 0) {
      return { book: storedBook, chapter: chapNum };
    }
  }
  return { book: DEFAULT_ANCHOR_BOOK, chapter: DEFAULT_ANCHOR_CHAPTER };
}

/**
 * Set custom church reading plan anchor (e.g. Ezekiel 29) and notify components
 */
export function setReadingPlanAnchor(bookName: string, chapterNum: number): void {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(DPC_ANCHOR_BOOK_KEY, bookName);
    localStorage.setItem(DPC_ANCHOR_CHAP_KEY, String(chapterNum));
  }
  clearPlanCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bible-plan-offset-changed", { detail: { book: bookName, chapter: chapterNum } }));
  }
}

/**
 * Reset reading plan anchor to church default (Ezekiel 29)
 */
export function resetReadingPlanOffset(toChurchDefault: boolean = true): void {
  if (toChurchDefault) {
    setReadingPlanAnchor(DEFAULT_ANCHOR_BOOK, DEFAULT_ANCHOR_CHAPTER);
  } else {
    // Standard Jan 1 start (Genesis 1)
    setReadingPlanAnchor("Genesis", 1);
  }
}

/**
 * Automatically sets the anchor so that today's reading begins at the specified book and chapter
 */
export function alignPlanToChapterOnDate(
  bookName: string,
  chapterNum: number,
  targetDate: Date = new Date()
): number {
  setReadingPlanAnchor(bookName, chapterNum);
  return 0;
}

export function getReadingPlanOffset(): number {
  return 0;
}

export function setReadingPlanOffset(offset: number): void {
  // Provided for compatibility
  clearPlanCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bible-plan-offset-changed", { detail: { offset } }));
  }
}

/**
 * Clear cached plan
 */
export function clearPlanCache(): void {
  cachedYear = 0;
  cachedPlan = [];
  cachedAnchorKey = null;
}

/**
 * Generates the full 365-day (or 366-day) Bible Reading Plan for a specific year,
 * anchored directly to the church benchmark (e.g. Ezekiel 29 on today's date).
 * Schedule rule:
 * - Monday to Saturday: 3 chapters
 * - Sunday: 5 chapters
 * - Total per 7-day week = 23 chapters
 */
export function generateAnnualBiblePlan(year: number = new Date().getFullYear()): DayReading[] {
  const plan: DayReading[] = [];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const totalDays = isLeap ? 366 : 365;

  const anchor = getReadingPlanAnchor();
  const standardBook = anchor.book === "Song of Songs" ? "Song of Solomon" : anchor.book;
  const targetIndex = ALL_CHAPTERS_LIST.findIndex(
    c => c.book.toLowerCase() === standardBook.toLowerCase() && c.chapter === anchor.chapter
  );
  const anchorGlobalIndex = targetIndex >= 0 ? targetIndex : 0;

  // Determine targetDayIndex for today in this year
  const now = new Date();
  const targetDate = now.getFullYear() === year ? now : new Date(year, 0, 1);
  const startOfYear = new Date(year, 0, 1);
  const diffTime = targetDate.getTime() - startOfYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const todayDayIndex = Math.max(1, Math.min(totalDays, diffDays));

  // Count chapters scheduled before todayDayIndex
  let chaptersBeforeToday = 0;
  for (let d = 1; d < todayDayIndex; d++) {
    const dateObj = new Date(year, 0, d);
    chaptersBeforeToday += (dateObj.getDay() === 0 ? 5 : 3);
  }

  // Today's reading count (5 for Sunday, 3 for weekday)
  const todayIsSunday = targetDate.getDay() === 0;
  const todayTargetCount = todayIsSunday ? 5 : 3;

  // Today concludes at anchorGlobalIndex (e.g. Ezekiel 29), so today starts at (anchorGlobalIndex - todayTargetCount + 1)
  const todayStartChapterIndex = anchorGlobalIndex - todayTargetCount + 1;
  let currentChapterIndex = todayStartChapterIndex - chaptersBeforeToday;

  for (let dayIndex = 1; dayIndex <= totalDays; dayIndex++) {
    const d = new Date(year, 0, dayIndex);
    const dayOfWeek = d.getDay(); // 0 = Sunday
    const isSunday = dayOfWeek === 0;
    const targetCount = isSunday ? 5 : 3;

    const assignedChapters: BibleChapterReference[] = [];

    for (let i = 0; i < targetCount; i++) {
      const safeIndex = ((currentChapterIndex % ALL_CHAPTERS_LIST.length) + ALL_CHAPTERS_LIST.length) % ALL_CHAPTERS_LIST.length;
      assignedChapters.push(ALL_CHAPTERS_LIST[safeIndex]);
      currentChapterIndex++;
    }

    const testaments = new Set(assignedChapters.map(c => c.testament));
    const testamentSummary = testaments.size === 1
      ? Array.from(testaments)[0]
      : "Old & New Testament";

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(d.getDate()).padStart(2, "0");
    const dateString = `${y}-${m}-${dayOfMonth}`;

    plan.push({
      dayIndex,
      dateString,
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      isSunday,
      targetChapterCount: targetCount,
      chapters: assignedChapters,
      passageDisplay: formatPassageDisplay(assignedChapters),
      testamentSummary,
      isYearEndBonus: dayIndex > 355
    });
  }

  return plan;
}

/**
 * Quick access cache for current year's plan
 */
let cachedYear = 0;
let cachedPlan: DayReading[] = [];
let cachedAnchorKey: string | null = null;

export function getCachedPlanForYear(year: number = new Date().getFullYear()): DayReading[] {
  const anchor = getReadingPlanAnchor();
  const currentKey = `${year}_${anchor.book}_${anchor.chapter}`;
  if (cachedYear === year && cachedPlan.length > 0 && cachedAnchorKey === currentKey) {
    return cachedPlan;
  }
  cachedYear = year;
  cachedAnchorKey = currentKey;
  cachedPlan = generateAnnualBiblePlan(year);
  return cachedPlan;
}

/**
 * Get the reading for today based on current system time
 */
export function getTodaysReading(date: Date = new Date()): DayReading {
  const year = date.getFullYear();
  const plan = getCachedPlanForYear(year);

  const startOfYear = new Date(year, 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const dayIndex = Math.max(1, Math.min(plan.length, diffDays));

  return plan[dayIndex - 1] || plan[0];
}

/**
 * Get reading by date string "YYYY-MM-DD"
 */
export function getReadingByDateString(dateStr: string): DayReading | undefined {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return undefined;
  const year = parts[0];
  const plan = getCachedPlanForYear(year);
  return plan.find(p => p.dateString === dateStr);
}

/**
 * Get the scheduled target up to a specific date according to the 1-year reading plan
 */
export function getScheduledTargetUpToDate(
  targetDate: Date = new Date(),
  year: number = targetDate.getFullYear()
) {
  const plan = getCachedPlanForYear(year);
  const todaysReading = getTodaysReading(targetDate);
  const targetDayIndex = todaysReading.dayIndex;

  const scheduledChaptersList: BibleChapterReference[] = [];
  const scheduledChaptersSet = new Set<string>();

  for (let i = 0; i < targetDayIndex && i < plan.length; i++) {
    for (const c of plan[i].chapters) {
      scheduledChaptersList.push(c);
      scheduledChaptersSet.add(`${c.book}:${c.chapter}`);
      if (c.book === "Song of Solomon") {
        scheduledChaptersSet.add(`Song of Songs:${c.chapter}`);
      }
    }
  }

  const currentBenchmarkChapter = scheduledChaptersList[scheduledChaptersList.length - 1] || ALL_CHAPTERS_LIST[0];

  return {
    targetDayIndex,
    targetDateString: todaysReading.dateString,
    todaysReading,
    scheduledChaptersCount: scheduledChaptersList.length,
    scheduledChaptersList,
    scheduledChaptersSet,
    currentBenchmarkChapter,
    currentBenchmarkPassage: todaysReading.passageDisplay
  };
}

export interface CatchUpChapter {
  book: string;
  chapter: number;
  testament: "Old Testament" | "New Testament";
  shortName: string;
  scheduledDayIndex: number;
  scheduledDateString?: string;
}

export interface BibleReadingPaceComparison {
  scheduledChaptersCount: number;
  completedChaptersCount: number;
  scheduledDaysCount: number;
  completedDaysCount: number;
  differenceChapters: number; // positive = ahead, negative = behind
  differenceDays: number;
  status: "behind" | "on_track" | "ahead";
  chaptersToCatchUp: number; // positive number of chapters behind
  daysBehind: number;
  statusTitle: string;
  statusDescription: string;
  currentBenchmarkPassage: string;
  currentBenchmarkChapter: BibleChapterReference;
  backlogChapters: CatchUpChapter[];
  nextUnreadChapter?: BibleChapterReference;
}

/**
 * Calculate pace comparison between scheduled guide progress and user actual progress
 */
export function calculateCatchUpPace(
  completedKeys: string[] = [],
  targetDate: Date = new Date(),
  year: number = targetDate.getFullYear()
): BibleReadingPaceComparison {
  const plan = getCachedPlanForYear(year);
  const scheduledInfo = getScheduledTargetUpToDate(targetDate, year);
  const completedChaptersSet = getCompletedChaptersSet(completedKeys, year);

  const completedChaptersCount = completedChaptersSet.size;
  const scheduledChaptersCount = scheduledInfo.scheduledChaptersCount;
  const differenceChapters = completedChaptersCount - scheduledChaptersCount;

  // Backlog chapters: chapters scheduled up to today that have NOT been read yet
  const backlogChapters: CatchUpChapter[] = [];

  for (let i = 0; i < scheduledInfo.targetDayIndex && i < plan.length; i++) {
    const day = plan[i];
    for (const c of day.chapters) {
      const key = `${c.book}:${c.chapter}`;
      const altKey = c.book === "Song of Solomon" ? `Song of Songs:${c.chapter}` : key;
      if (!completedChaptersSet.has(key) && !completedChaptersSet.has(altKey)) {
        backlogChapters.push({
          book: c.book,
          chapter: c.chapter,
          testament: c.testament,
          shortName: c.shortName,
          scheduledDayIndex: day.dayIndex,
          scheduledDateString: day.dateString
        });
      }
    }
  }

  // Find next unread chapter in full Bible sequence
  let nextUnreadChapter: BibleChapterReference | undefined = undefined;
  for (const c of ALL_CHAPTERS_LIST) {
    const key = `${c.book}:${c.chapter}`;
    const altKey = c.book === "Song of Solomon" ? `Song of Songs:${c.chapter}` : key;
    if (!completedChaptersSet.has(key) && !completedChaptersSet.has(altKey)) {
      nextUnreadChapter = c;
      break;
    }
  }

  const chaptersToCatchUp = differenceChapters < 0 ? Math.abs(differenceChapters) : 0;
  const daysBehind = chaptersToCatchUp > 0 ? Math.ceil(chaptersToCatchUp / 3.28) : 0;

  let status: "behind" | "on_track" | "ahead" = "on_track";
  let statusTitle = "On Track with Church Guide";
  let statusDescription = "You are right on schedule with the D.P.C. Bible Reading Guide. Keep up the daily reading!";

  if (differenceChapters < -3) {
    status = "behind";
    statusTitle = `Behind by ${chaptersToCatchUp} Chapters`;
    statusDescription = `You have ${chaptersToCatchUp} chapters (~${daysBehind} days of reading) to catch up on to align with today's church schedule.`;
  } else if (differenceChapters > 3) {
    status = "ahead";
    statusTitle = `Ahead by ${differenceChapters} Chapters`;
    statusDescription = `You are ahead of the church reading schedule by ${differenceChapters} chapters! Excellent dedication.`;
  } else {
    status = "on_track";
    statusTitle = "Right on Track";
    statusDescription = "Your personal reading progress is in sync with today's scheduled reading benchmark.";
  }

  return {
    scheduledChaptersCount,
    completedChaptersCount,
    scheduledDaysCount: scheduledInfo.targetDayIndex,
    completedDaysCount: Math.floor(completedChaptersCount / 3.28),
    differenceChapters,
    differenceDays: Math.round(differenceChapters / 3.28),
    status,
    chaptersToCatchUp,
    daysBehind,
    statusTitle,
    statusDescription,
    currentBenchmarkPassage: scheduledInfo.currentBenchmarkPassage,
    currentBenchmarkChapter: scheduledInfo.currentBenchmarkChapter,
    backlogChapters,
    nextUnreadChapter
  };
}

/**
 * Calculate user progress, streaks, chapters completed out of 1,189 with pace metrics
 */
export function calculateReadingProgress(
  completedKeys: string[] = [], // date strings or dayIndex keys e.g. "2026-09-12" or "day-255"
  year: number = new Date().getFullYear()
) {
  const plan = getCachedPlanForYear(year);
  const completedChaptersSet = getCompletedChaptersSet(completedKeys, year);
  const completedChaptersCount = completedChaptersSet.size;

  const completedSet = new Set(completedKeys);
  let completedDaysCount = 0;

  for (const day of plan) {
    const isCompleted = completedSet.has(day.dateString || "") || completedSet.has(`day-${day.dayIndex}`);
    if (isCompleted) {
      completedDaysCount++;
    }
  }

  // Calculate current streak
  const today = new Date();
  const todayDayIndex = getTodaysReading(today).dayIndex;
  let streak = 0;

  for (let i = todayDayIndex; i >= 1; i--) {
    const day = plan[i - 1];
    if (!day) break;
    const isCompleted = completedSet.has(day.dateString || "") || completedSet.has(`day-${day.dayIndex}`);
    
    // If today is not completed yet, allow streak calculation to continue from yesterday
    if (i === todayDayIndex && !isCompleted) {
      continue;
    }

    if (isCompleted) {
      streak++;
    } else {
      break;
    }
  }

  const percentage = Math.min(100, Number(((completedChaptersCount / TOTAL_BIBLE_CHAPTERS) * 100).toFixed(1)));
  const pace = calculateCatchUpPace(completedKeys, today, year);

  return {
    totalChapters: TOTAL_BIBLE_CHAPTERS,
    completedChapters: Math.min(TOTAL_BIBLE_CHAPTERS, completedChaptersCount),
    totalDays: plan.length,
    completedDays: completedDaysCount,
    percentage,
    streak,
    todayCompleted: completedSet.has(getTodaysReading(today).dateString || "") || completedSet.has(`day-${todayDayIndex}`),
    pace
  };
}

export interface DpcGuideBook {
  name: string;
  shortName: string;
  totalChapters: number;
  rows: { startChapter: number; endChapter: number }[];
}

export interface DpcGuideCategory {
  categoryName: string;
  verticalLabel: string;
  books: DpcGuideBook[];
}

export interface DpcGuideTestament {
  testament: "Old Testament" | "New Testament";
  categories: DpcGuideCategory[];
}

/**
 * Builds the exact 25-columns per row D.P.C. Bible Reading Guide data structure
 * exactly as structured in the church's printed handout.
 */
export function getDpcGuideStructure(): DpcGuideTestament[] {
  const createBook = (name: string, shortName: string, chapters: number): DpcGuideBook => {
    const rows: { startChapter: number; endChapter: number }[] = [];
    for (let c = 1; c <= chapters; c += 25) {
      rows.push({
        startChapter: c,
        endChapter: Math.min(chapters, c + 24)
      });
    }
    return { name, shortName, totalChapters: chapters, rows };
  };

  return [
    {
      testament: "Old Testament",
      categories: [
        {
          categoryName: "Pentateuch",
          verticalLabel: "Pentateuch",
          books: [
            createBook("Genesis", "Gen", 50),
            createBook("Exodus", "Exo", 40),
            createBook("Leviticus", "Lev", 27),
            createBook("Numbers", "Num", 36),
            createBook("Deuteronomy", "Deu", 34),
          ]
        },
        {
          categoryName: "Historical Books",
          verticalLabel: "Historical Books",
          books: [
            createBook("Joshua", "Jos", 24),
            createBook("Judges", "Jdg", 21),
            createBook("Ruth", "Rut", 4),
            createBook("1 Samuel", "1Sa", 31),
            createBook("2 Samuel", "2Sa", 24),
            createBook("1 Kings", "1Ki", 22),
            createBook("2 Kings", "2Ki", 25),
            createBook("1 Chronicles", "1Ch", 29),
            createBook("2 Chronicles", "2Ch", 36),
            createBook("Ezra", "Ezr", 10),
            createBook("Nehemiah", "Neh", 13),
            createBook("Esther", "Est", 10),
          ]
        },
        {
          categoryName: "Psalms & Wisdom",
          verticalLabel: "Psalms & Wisdom",
          books: [
            createBook("Job", "Job", 42),
            createBook("Psalms", "Psa", 150),
            createBook("Proverbs", "Pro", 31),
            createBook("Ecclesiastes", "Ecc", 12),
            createBook("Song of Songs", "Sng", 8),
          ]
        },
        {
          categoryName: "The Prophets",
          verticalLabel: "The Prophets",
          books: [
            createBook("Isaiah", "Isa", 66),
            createBook("Jeremiah", "Jer", 52),
            createBook("Lamentations", "Lam", 5),
            createBook("Ezekiel", "Ezk", 48),
            createBook("Daniel", "Dan", 12),
            createBook("Hosea", "Hos", 14),
            createBook("Joel", "Jol", 3),
            createBook("Amos", "Amo", 9),
            createBook("Obadiah", "Oba", 1),
            createBook("Jonah", "Jon", 4),
            createBook("Micah", "Mic", 7),
            createBook("Nahum", "Nam", 3),
            createBook("Habakkuk", "Hab", 3),
            createBook("Zephaniah", "Zep", 3),
            createBook("Haggai", "Hag", 2),
            createBook("Zechariah", "Zec", 14),
            createBook("Malachi", "Mal", 4),
          ]
        }
      ]
    },
    {
      testament: "New Testament",
      categories: [
        {
          categoryName: "Gospels & History",
          verticalLabel: "Gospels & History",
          books: [
            createBook("Matthew", "Mat", 28),
            createBook("Mark", "Mrk", 16),
            createBook("Luke", "Luk", 24),
            createBook("John", "Jhn", 21),
            createBook("Acts", "Act", 28),
          ]
        },
        {
          categoryName: "Pauline Epistles",
          verticalLabel: "Pauline Epistles",
          books: [
            createBook("Romans", "Rom", 16),
            createBook("1 Corinthians", "1Co", 16),
            createBook("2 Corinthians", "2Co", 13),
            createBook("Galatians", "Gal", 6),
            createBook("Ephesians", "Eph", 6),
            createBook("Philippians", "Php", 4),
            createBook("Colossians", "Col", 4),
            createBook("1 Thessalonians", "1Th", 5),
            createBook("2 Thessalonians", "2Th", 3),
            createBook("1 Timothy", "1Ti", 6),
            createBook("2 Timothy", "2Ti", 4),
            createBook("Titus", "Tit", 3),
            createBook("Philemon", "Phm", 1),
          ]
        },
        {
          categoryName: "General Epistles & Prophecy",
          verticalLabel: "General Epistles",
          books: [
            createBook("Hebrews", "Heb", 13),
            createBook("James", "Jas", 5),
            createBook("1 Peter", "1Pe", 5),
            createBook("2 Peter", "2Pe", 3),
            createBook("1 John", "1Jn", 5),
            createBook("2 John", "2Jn", 1),
            createBook("3 John", "3Jn", 1),
            createBook("Jude", "Jud", 1),
            createBook("Revelation", "Rev", 22),
          ]
        }
      ]
    }
  ];
}

/**
 * Extract all checked chapter keys formatted as "BookName:Chapter" (e.g. "Genesis:1")
 * from the user's completed day keys.
 */
export function getCompletedChaptersSet(
  completedKeys: string[] = [],
  year: number = new Date().getFullYear()
): Set<string> {
  const plan = getCachedPlanForYear(year);
  const completedDaySet = new Set(completedKeys);
  const chapterSet = new Set<string>();

  for (const day of plan) {
    const isDayCompleted =
      completedDaySet.has(day.dateString || "") ||
      completedDaySet.has(`day-${day.dayIndex}`);

    if (isDayCompleted) {
      for (const chap of day.chapters) {
        chapterSet.add(`${chap.book}:${chap.chapter}`);
        // Also add standardized name variants if needed
        if (chap.book === "Song of Solomon") {
          chapterSet.add(`Song of Songs:${chap.chapter}`);
        }
      }
    }
  }

  // Also include direct chapter keys if stored as "chap:BookName:Chapter"
  for (const k of completedKeys) {
    if (k.startsWith("chap:")) {
      const sub = k.substring(5);
      chapterSet.add(sub);
    }
  }

  return chapterSet;
}

/**
 * Toggle an individual chapter from the grid and sync back to day keys
 */
export function toggleIndividualChapterInKeys(
  bookName: string,
  chapterNum: number,
  currentCompletedKeys: string[],
  year: number = new Date().getFullYear()
): { updatedKeys: string[]; isNowCompleted: boolean } {
  const plan = getCachedPlanForYear(year);
  const standardBook = bookName === "Song of Songs" ? "Song of Solomon" : bookName;
  const chapKey = `${standardBook}:${chapterNum}`;
  const directKey = `chap:${chapKey}`;

  // Find the day this chapter belongs to in the annual reading plan
  const matchingDay = plan.find(d =>
    d.chapters.some(c => (c.book === standardBook || c.book === bookName) && c.chapter === chapterNum)
  );

  const completedChapters = getCompletedChaptersSet(currentCompletedKeys, year);
  const isCurrentlyDone = completedChapters.has(chapKey) || completedChapters.has(`${bookName}:${chapterNum}`);

  let updatedKeys = [...currentCompletedKeys];

  if (isCurrentlyDone) {
    // Unmark this chapter
    if (matchingDay) {
      const dayKey = matchingDay.dateString || `day-${matchingDay.dayIndex}`;
      updatedKeys = updatedKeys.filter(k => k !== dayKey && k !== `day-${matchingDay.dayIndex}`);
      // Re-add the other chapters of that day individually so only this clicked one is removed
      for (const c of matchingDay.chapters) {
        if (!(c.book === standardBook && c.chapter === chapterNum)) {
          const otherKey = `chap:${c.book}:${c.chapter}`;
          if (!updatedKeys.includes(otherKey)) updatedKeys.push(otherKey);
        }
      }
    }
    updatedKeys = updatedKeys.filter(k => k !== directKey && k !== `chap:${bookName}:${chapterNum}`);
    return { updatedKeys, isNowCompleted: false };
  } else {
    // Mark this chapter
    if (!updatedKeys.includes(directKey)) {
      updatedKeys.push(directKey);
    }

    // If all chapters of matchingDay are now completed, clean up and store the day key instead
    if (matchingDay) {
      const dayKey = matchingDay.dateString || `day-${matchingDay.dayIndex}`;
      const allDone = matchingDay.chapters.every(c => {
        if (c.book === standardBook && c.chapter === chapterNum) return true;
        const cKey = `${c.book}:${c.chapter}`;
        return completedChapters.has(cKey) || updatedKeys.includes(`chap:${cKey}`);
      });

      if (allDone) {
        // Remove individual sub keys and add dayKey
        for (const c of matchingDay.chapters) {
          updatedKeys = updatedKeys.filter(k => k !== `chap:${c.book}:${c.chapter}`);
        }
        if (!updatedKeys.includes(dayKey)) updatedKeys.push(dayKey);
      }
    }

    return { updatedKeys, isNowCompleted: true };
  }
}

