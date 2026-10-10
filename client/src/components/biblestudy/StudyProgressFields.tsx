import { useId } from "react";
import { BIBLE_BOOKS_MAP, generateChapterOptions } from "../../utils/curriculumHelper";

export interface StudyProgressValue { book: string; chapter: string; stage: string }
export const STUDY_PROGRESS_STAGES = [
  { value: "intro", label: "Introduction / Starting" },
  { value: "in_progress", label: "In progress" },
  { value: "midway", label: "Mid-way" },
  { value: "application", label: "Discussion & Reflection" },
  { value: "review", label: "Review / Q&A" },
  { value: "exam", label: "Exam / Assessment" },
  { value: "chapter_completed", label: "Chapter finished" },
];

interface Props {
  value: StudyProgressValue;
  onChange: (value: StudyProgressValue) => void;
  topics: { title: string; total_chapters: number; has_discussion?: boolean; has_review?: boolean; has_exam?: boolean }[];
  fallbackBook?: string;
  fallbackChapters?: number;
  disabled?: boolean;
  readOnlyBook?: boolean;
}

/** The same book, chapter and pacing controls for progress and attendance drafts. */
export function StudyProgressFields({ value, onChange, topics, fallbackBook, fallbackChapters, disabled, readOnlyBook = false }: Props) {
  const id = useId();
  const clean = value.book.trim().toLowerCase();
  const topic = topics.find(t => t.title.trim().toLowerCase() === clean);
  const stages = STUDY_PROGRESS_STAGES.filter(stage =>
    stage.value === "application" ? topic?.has_discussion !== false
      : stage.value === "review" ? topic?.has_review !== false
      : stage.value === "exam" ? topic?.has_exam !== false : true);
  const total = Number(topic?.total_chapters || BIBLE_BOOKS_MAP[clean] ||
    (clean === fallbackBook?.trim().toLowerCase() ? fallbackChapters : 0)) || 0;
  const books = [...new Set([
    value.book,
    ...topics.map(t => t.title),
    ...Object.keys(BIBLE_BOOKS_MAP)
      .filter(name => !["psalm", "song of songs"].includes(name) && !name.startsWith("gospel of ") && !name.startsWith("book of ") && name !== "acts of the apostles")
      .map(name => name.replace(/\b\w/g, letter => letter.toUpperCase())),
  ])].filter(Boolean);
  const chapters = total > 0 ? generateChapterOptions(total).filter(c => !c.isSpecial) : [];
  return <div className="space-y-3">
    <div>
      <label htmlFor={`${id}-book`} className="ui-field mb-1">Book / Study Topic</label>
      {readOnlyBook ? <input id={`${id}-book`} readOnly value={value.book} className="ui-input" /> : <select id={`${id}-book`} required disabled={disabled} value={value.book} className="ui-input"
        onChange={event => onChange({ book: event.target.value, chapter: "Chapter 1", stage: "intro" })}>
        <option value="" disabled>Choose a book / study topic</option>
        {books.map(book => <option key={book} value={book}>{book}</option>)}
      </select>}
      {readOnlyBook && <p className="ui-help mt-1">Assigned book. Contact your coordinator or pastor to change it.</p>}
      <p className="ui-help mt-1">{total > 0 ? `${total} chapters in this book` : "Chapter count not recorded for this book. You can keep its existing lesson."}</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${id}-chapter`} className="ui-field mb-1">Chapter / Lesson</label>
        {total > 0 ? <select id={`${id}-chapter`} required disabled={disabled} value={value.chapter} className="ui-input"
          onChange={event => onChange({ ...value, chapter: event.target.value, stage: "intro" })}>
          {value.chapter && !chapters.some(c => c.value === value.chapter) && <option value={value.chapter}>{value.chapter} (saved lesson)</option>}
          {chapters.map(chapter => <option key={chapter.value} value={chapter.value}>{chapter.label}</option>)}
        </select> : <input id={`${id}-chapter`} required disabled={disabled} maxLength={100} value={value.chapter} className="ui-input"
          onChange={event => onChange({ ...value, chapter: event.target.value })} />}
      </div>
      <div>
        <label htmlFor={`${id}-stage`} className="ui-field mb-1">Study progress stage</label>
        <select id={`${id}-stage`} disabled={disabled} value={value.stage} className="ui-input"
          onChange={event => onChange({ ...value, stage: event.target.value })}>
          {!stages.some(s => s.value === value.stage) && <option value={value.stage}>{value.stage === "completed" ? "Completed study (recorded)" : `${STUDY_PROGRESS_STAGES.find(s => s.value === value.stage)?.label || value.stage} (recorded)`}</option>}
          {stages.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
        </select>
      </div>
    </div>
    <p className="ui-help">The stage describes this chapter. Use Complete Study when the entire book is finished.</p>
  </div>;
}
