import { StudyTopic } from "../types";

export const BIBLE_BOOKS_MAP: Record<string, number> = {
  // Old Testament (39 books)
  "genesis": 50, "exodus": 40, "leviticus": 27, "numbers": 36, "deuteronomy": 34,
  "joshua": 24, "judges": 21, "ruth": 4, "1 samuel": 31, "2 samuel": 24,
  "1 kings": 22, "2 kings": 25, "1 chronicles": 29, "2 chronicles": 36,
  "ezra": 10, "nehemiah": 13, "esther": 10, "job": 42, "psalms": 150, "psalm": 150,
  "proverbs": 31, "ecclesiastes": 12, "song of solomon": 8, "song of songs": 8,
  "isaiah": 66, "jeremiah": 52, "lamentations": 5, "ezekiel": 48, "daniel": 12,
  "hosea": 14, "joel": 3, "amos": 9, "obadiah": 1, "jonah": 4, "micah": 7,
  "nahum": 3, "habakkuk": 3, "zephaniah": 3, "haggai": 2, "zechariah": 14, "malachi": 4,
  // New Testament (27 books)
  "matthew": 28, "gospel of matthew": 28,
  "mark": 16, "gospel of mark": 16,
  "luke": 24, "gospel of luke": 24,
  "john": 21, "gospel of john": 21,
  "acts": 28, "acts of the apostles": 28,
  "romans": 16, "book of romans": 16,
  "1 corinthians": 16, "2 corinthians": 13, "galatians": 6, "ephesians": 6,
  "philippians": 4, "colossians": 4, "1 thessalonians": 5, "2 thessalonians": 3,
  "1 timothy": 6, "2 timothy": 4, "titus": 3, "philemon": 1,
  "hebrews": 13, "james": 5, "1 peter": 5, "2 peter": 3,
  "1 john": 5, "2 john": 1, "3 john": 1, "jude": 1,
  "revelation": 22
};

/**
 * Resolves the exact total chapters for any book title:
 * 1. Checks custom topics registered in bible_study_topics
 * 2. Checks standard 66 Bible books
 * 3. Fallback default to 12 chapters
 */
export function getBookTotalChapters(bookTitle?: string | null, customTopics: { title: string; total_chapters: number }[] = []): number {
  if (!bookTitle || !bookTitle.trim()) return 12;
  const clean = bookTitle.trim().toLowerCase();

  // 1. Direct match in database topics
  const dbMatch = customTopics.find(t => t.title.toLowerCase().trim() === clean || clean.includes(t.title.toLowerCase().trim()));
  if (dbMatch && dbMatch.total_chapters > 0) {
    return Number(dbMatch.total_chapters);
  }

  // 2. Direct match in standard Bible books map
  if (BIBLE_BOOKS_MAP[clean]) {
    return BIBLE_BOOKS_MAP[clean];
  }

  // 3. Partial match in Bible books map
  for (const [bookKey, chapters] of Object.entries(BIBLE_BOOKS_MAP)) {
    if (clean.includes(bookKey) || bookKey.includes(clean)) {
      return chapters;
    }
  }

  return 12;
}

/**
 * Generates an array of chapter options up to the book's total chapters
 */
export function generateChapterOptions(totalChapters: number): { label: string; value: string; isSpecial?: boolean }[] {
  const list: { label: string; value: string; isSpecial?: boolean }[] = [
    { label: "Introduction", value: "Introduction", isSpecial: true }
  ];

  for (let i = 1; i <= totalChapters; i++) {
    list.push({ label: `Chapter ${i}`, value: `Chapter ${i}` });
  }

  list.push({ label: "Review / Q&A", value: "Review / Q&A", isSpecial: true });
  list.push({ label: "Completed", value: "Completed", isSpecial: true });

  return list;
}
