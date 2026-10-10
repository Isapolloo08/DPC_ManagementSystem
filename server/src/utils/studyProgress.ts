export const STUDY_PROGRESS_STAGES = new Set([
  "intro", "in_progress", "midway", "application", "review", "exam", "chapter_completed", "completed",
]);

export function validStudyProgressStage(value: unknown): value is string {
  return typeof value === "string" && STUDY_PROGRESS_STAGES.has(value);
}
