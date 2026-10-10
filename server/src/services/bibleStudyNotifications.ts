import { randomUUID } from "node:crypto";
import { db } from "../db/schema";
import { notify } from "./notificationService";
import { logger } from "../utils/logger";
import { countConsecutiveAbsences } from "../utils/groupAttendanceIntelligence";
import { renderBibleStudyUpdateEmail } from "./bibleStudyEmailTemplate";

interface StudyGroup {
  id: number; name: string; curriculum: string | null; current_chapter: string | null;
  progress_stage: string | null; progress_notes: string | null; ministry_id: number | null;
  meeting_day: string; meeting_time: string; location: string;
}
interface SavedSession { id: number; topic_title: string | null; chapter: string | null; progress_stage: string | null; notes: string | null }
const stageLabels: Record<string, string> = {
  intro: "Introduction / Starting", in_progress: "In progress", midway: "Mid-way",
  application: "Discussion & Reflection", review: "Review / Q&A", exam: "Exam / Assessment",
  chapter_completed: "Chapter finished", completed: "Completed study",
};

/** One post-save delivery path for both roll-call entry points and progress/schedule edits. */
export async function sendBibleStudyUpdateNotification(groupId: number, options: { actorName: string; sessionDate?: string }): Promise<void> {
  try {
    const group = await db.get<StudyGroup>(`SELECT id, name, curriculum, current_chapter, progress_stage, progress_notes,
      ministry_id, meeting_day, meeting_time, location FROM bible_study_groups WHERE id = $1`, [groupId]);
    if (!group) return;
    const session = options.sessionDate ? await db.get<SavedSession>(`SELECT id, topic_title, chapter, progress_stage, notes
      FROM bible_study_sessions WHERE group_id = $1 AND session_date = $2`, [groupId, options.sessionDate]) : null;
    if (options.sessionDate && !session) return;
    const stage = session ? session.progress_stage : group.progress_stage;
    let attendance: { present: number; absent: number; excused: number } | undefined;
    let absentNotice: string | undefined;
    const lines = [
      `Group: ${group.name}`, `Saved by: ${options.actorName}`,
      ...(options.sessionDate ? [`Session date: ${options.sessionDate}`] : []),
      `Book: ${(session ? session.topic_title : group.curriculum) || "Not assigned"}`,
      `Chapter: ${(session ? session.chapter : group.current_chapter) || "Not recorded"}`,
      `Stage: ${stage ? stageLabels[stage] || stage : "Not recorded"}`,
      `Lesson Notice & Specific Location: ${(session ? session.notes : group.progress_notes) || "No lesson notice recorded"}`,
      `Regular schedule: ${group.meeting_day} • ${group.meeting_time}`,
      `Meeting venue: ${group.location || "Not specified"}`,
    ];
    if (session) {
      const attendees = await db.all<{ member_id: number; display_name: string; status: string }>(`SELECT a.member_id, a.status,
        COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), bsm.member_name, 'Disciple') AS display_name
        FROM bible_study_attendance a
        LEFT JOIN members m ON m.id = a.member_id
        LEFT JOIN bible_study_members bsm ON bsm.group_id = a.group_id AND bsm.member_id = a.member_id
        WHERE a.group_id = $1 AND a.session_date = $2 ORDER BY display_name ASC`, [groupId, options.sessionDate]);
      const absent = attendees.filter(member => member.status === "absent");
      attendance = { present: attendees.filter(member => member.status === "present").length, absent: absent.length, excused: attendees.filter(member => member.status === "excused").length };
      lines.push(`Attendance: ${attendees.filter(member => member.status === "present").length} present • ${absent.length} absent • ${attendees.filter(member => member.status === "excused").length} excused`);
      if (absent.length) {
        const [threshold, history] = await Promise.all([
          db.get<{ threshold: number | null }>("SELECT threshold FROM notification_rules WHERE event_type = 'absence_alert' AND enabled = TRUE AND threshold IS NOT NULL ORDER BY threshold ASC LIMIT 1"),
          db.all<{ member_id: number; session_date: string; status: string }>(`SELECT member_id, session_date, status FROM bible_study_attendance
            WHERE group_id = $1 AND member_id = ANY($2::int[]) AND session_date <= $3 ORDER BY member_id ASC, session_date DESC`, [groupId, absent.map(member => member.member_id), options.sessionDate]),
        ]);
        absentNotice = absent.map(member => {
          const streak = countConsecutiveAbsences(history.filter(item => item.member_id === member.member_id));
          return streak >= Number(threshold?.threshold || 3) ? `${member.display_name} (${streak} consecutive absences — attention needed)` : member.display_name;
        }).join(", ");
        lines.push(`Absent: ${absentNotice}`);
      }
    }
    const title = `${session ? "Bible study attendance saved" : "Study progress & schedule saved"}: ${group.name}`.slice(0, 255);
    // One key per successful save; outbox retries reuse it and recipient rules deduplicate per channel.
    await notify("bible_study_update", {
      eventKey: `bible-study:${groupId}:${randomUUID()}`, title, message: lines.join("\n"),
      linkTab: "biblestudy", linkRefId: groupId, ministryId: group.ministry_id,
      emailSubject: title,
      emailHtml: renderBibleStudyUpdateEmail({
        groupName: group.name, actorName: options.actorName, sessionDate: options.sessionDate,
        book: (session ? session.topic_title : group.curriculum) || "Not assigned",
        chapter: (session ? session.chapter : group.current_chapter) || "Not recorded",
        stage: stage ? stageLabels[stage] || stage : "Not recorded",
        notice: (session ? session.notes : group.progress_notes) || "No lesson notice recorded",
        schedule: `${group.meeting_day} • ${group.meeting_time}`, venue: group.location || "Not specified",
        attendance, absentNotice,
      }),
    });
  } catch (error) {
    logger.error({ error, groupId }, "Failed to prepare Bible study update notification");
  }
}
