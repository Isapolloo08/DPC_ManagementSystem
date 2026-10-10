interface StudyEmailDetails {
  groupName: string; actorName: string; sessionDate?: string;
  book: string; chapter: string; stage: string; notice: string; schedule: string; venue: string;
  attendance?: { present: number; absent: number; excused: number };
  absentNotice?: string;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

/** Inline styles and presentation tables keep the message usable in email clients. */
export function renderBibleStudyUpdateEmail(details: StudyEmailDetails): string {
  const e = escapeHtml;
  const date = details.sessionDate ? new Date(`${details.sessionDate}T12:00:00Z`).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
  }) : "Study progress & schedule";
  const row = (label: string, value: string) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e9edf5"><div style="font-size:11px;color:#64748b;margin-bottom:4px">${label}</div><div style="font-size:14px;color:#25345c;word-break:break-word">${e(value)}</div></td></tr>`;
  const metrics = details.attendance ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px"><tr>${[
    [details.attendance.present, "PRESENT", "#047857"], [details.attendance.absent, "ABSENT", "#b91c1c"], [details.attendance.excused, "EXCUSED", "#a16207"],
  ].map(([count, label, color]) => `<td width="33%" align="center" style="padding:16px 4px"><div style="color:${color};font-size:26px;font-weight:700">${count}</div><div style="font-size:10px;letter-spacing:1px;color:#64748b;margin-top:5px">${label}</div></td>`).join("")}</tr></table>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bible study update</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
<tr><td style="padding:26px 24px;background:#273560;border-top:4px solid #e4b648">
  <div style="color:#e4b648;font-size:11px;font-weight:700;letter-spacing:2px">DPC MANAGEMENT SYSTEM</div>
  <h1 style="color:#ffffff;font-size:24px;line-height:1.3;margin:12px 0 8px">${details.attendance ? "Weekly session recorded" : "Study progress updated"}</h1>
  <div style="color:#cbd5e1;font-size:13px">${e(date)}</div>
</td></tr>
<tr><td style="padding:24px">
  <div style="font-size:11px;letter-spacing:1px;color:#64748b">BIBLE STUDY GROUP</div>
  <h2 style="font-size:21px;line-height:1.4;margin:6px 0;color:#25345c;word-break:break-word">${e(details.groupName)}</h2>
  <div style="font-size:12px;color:#64748b">Saved by ${e(details.actorName)}</div>
  ${metrics}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:#f5f7fc;border:1px solid #e0e7f3;border-radius:12px"><tr><td style="padding:18px">
    <div style="font-size:11px;color:#64748b;letter-spacing:1px">LESSON COVERED</div>
    <div style="font-size:17px;font-weight:700;line-height:1.5;color:#25345c;margin-top:6px;word-break:break-word">${e(details.book)}</div>
    <div style="font-size:13px;color:#475569;margin:5px 0 12px">${e(details.chapter)}</div>
    <span style="font-size:12px;color:#25345c;background:#e5eaf7;padding:6px 10px;border-radius:20px">${e(details.stage)}</span>
  </td></tr></table>
  <div style="border-left:3px solid #e4b648;padding:4px 0 4px 14px;margin:22px 0">
    <div style="font-size:12px;font-weight:700;color:#25345c;margin-bottom:8px">Lesson Notice &amp; Specific Location (Saan Banda Sila)</div>
    <div style="font-size:14px;line-height:1.7;color:#475569;word-break:break-word">${e(details.notice).replace(/\r?\n/g, "<br>")}</div>
  </div>
  ${details.absentNotice ? `<div style="padding:14px;background:#fff8ed;border:1px solid #fde5b5;border-radius:10px;font-size:13px;line-height:1.6;color:#854d0e"><strong>Absent members &amp; follow-up</strong><br>${e(details.absentNotice)}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${row("REGULAR SCHEDULE", details.schedule)}${row("MEETING VENUE", details.venue)}</table>
</td></tr>
<tr><td style="padding:18px 24px;background:#fafbfe;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.7;color:#64748b">Open Bible Study Groups in DPC to review the session history.<br>Church attendance information · Sent to configured church recipients.</td></tr>
</table></td></tr></table></body></html>`;
}
