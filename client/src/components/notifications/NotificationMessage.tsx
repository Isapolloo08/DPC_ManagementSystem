import { BookOpen, CalendarDays, MapPin } from "lucide-react";
import { AppNotification } from "../../types";

const fields = ["Group", "Saved by", "Session date", "Book", "Chapter", "Stage", "Lesson Notice & Specific Location", "Regular schedule", "Meeting venue", "Attendance", "Absent"];
const twoLines = { display: "-webkit-box", WebkitBoxOrient: "vertical" as const, WebkitLineClamp: 2, overflow: "hidden" };

/** Read existing plain-text study messages, including notices with multiple lines. */
function studyDetails(message: string) {
  const details: Record<string, string> = {};
  let current = "";
  for (const line of message.split("\n")) {
    const field = fields.find(key => line.startsWith(`${key}: `));
    if (field) { current = field; details[current] = line.slice(field.length + 2); }
    else if (current) details[current] += `\n${line}`;
  }
  return details;
}

export function NotificationMessage({ notification, compact = false }: { notification: AppNotification; compact?: boolean }) {
  if (notification.type !== "bible_study_update") return <span className="block text-xs text-muted whitespace-pre-line leading-relaxed mt-1"
    style={compact ? twoLines : undefined}>{notification.message}</span>;
  const details = studyDetails(notification.message);
  if (!details.Book) return <span className="block text-xs text-muted whitespace-pre-line mt-1">{notification.message}</span>;
  const date = details["Session date"];
  const dateLabel = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: compact ? undefined : "numeric", timeZone: "Asia/Manila",
  }) : date;
  const counts = details.Attendance?.match(/^(\d+) present • (\d+) absent • (\d+) excused$/);
  return <span className="block mt-2 space-y-2.5">
    <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {dateLabel && <span className="inline-flex items-center gap-1 text-muted"><CalendarDays className="w-3 h-3" />{dateLabel}</span>}
      <span className="rounded-md bg-indigo-50 text-indigo px-2 py-0.5 font-medium">{details.Stage}</span>
    </span>
    <span className="flex items-start gap-1.5 text-xs font-medium text-charcoal"><BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo" />
      <span className="break-words min-w-0">{details.Book}<span className="text-muted font-normal"> · {details.Chapter}</span></span></span>
    {counts && <span className="flex flex-wrap gap-1.5 text-[11px] font-medium">
      <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-1">{counts[1]} Present</span>
      <span className="rounded-md bg-rose-50 text-rose-700 px-2 py-1">{counts[2]} Absent</span>
      <span className="rounded-md bg-amber-50 text-amber-700 px-2 py-1">{counts[3]} Excused</span>
    </span>}
    {details["Lesson Notice & Specific Location"] && <span className="block border-l-2 border-amber-400 pl-2.5">
      {!compact && <span className="block text-[11px] font-medium text-charcoal mb-1">Lesson Notice & Specific Location (Saan Banda Sila)</span>}
      <span className="block text-xs text-muted leading-relaxed whitespace-pre-line break-words" style={compact ? twoLines : undefined}>{details["Lesson Notice & Specific Location"]}</span>
    </span>}
    {!compact && <span className="block space-y-1.5 text-xs text-muted">
      <span className="flex items-start gap-1.5"><CalendarDays className="w-3.5 h-3.5 shrink-0" />{details["Regular schedule"]}</span>
      <span className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{details["Meeting venue"]}</span>
      {details.Absent && <span className="block rounded-lg bg-amber-50 text-amber-800 p-2">Absent & follow-up: {details.Absent}</span>}
    </span>}
    <span className="block text-[11px] text-muted">Saved by {details["Saved by"] || "Group facilitator"}{!compact && details.Group ? ` · ${details.Group}` : ""}</span>
  </span>;
}
