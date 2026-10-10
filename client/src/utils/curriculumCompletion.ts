import type { BibleStudyGroup, StudyTopic } from '../types';
import { getBookTotalChapters } from './curriculumHelper';

/** Earlier chapters are assumed finished; the current one counts only when marked finished. */
export function getCurriculumCompletion(group: BibleStudyGroup | null, topics: StudyTopic[] = []) {
  const recordedTotal = group?.completed_total_chapters || group?.curriculum_total_chapters;
  const total = recordedTotal && Number.isFinite(recordedTotal) && recordedTotal > 0
    ? Math.floor(recordedTotal)
    : getBookTotalChapters(group?.completed_book_title_snapshot || group?.curriculum, topics);
  const chapter = group?.completed_chapter || group?.current_chapter || '';
  const complete = group?.status === 'completed' || group?.progress_stage === 'completed' || /^completed$/i.test(chapter.trim());
  const match = chapter.match(/\d+/);
  const current = complete || /^review/i.test(chapter) ? total : match ? Math.max(0, Math.min(total, Number(match[0]))) : 0;
  const finished = complete ? total : Math.max(0, current - (group?.progress_stage === 'chapter_completed' ? 0 : 1));
  const percent = Math.round(finished / total * 1000) / 10;
  return { total, current, finished, percent, complete };
}
