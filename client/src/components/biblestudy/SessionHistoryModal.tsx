import { Pagination } from "../common/Pagination";
import { usePageControls, useDebouncedValue } from "../../hooks/useListPagination";
import { useEffect, useState } from "react";
import { BookOpen, Calendar, ClipboardList, RefreshCw, Search, X, BookmarkCheck, CheckCircle2, UserX, Clock, User, ChevronDown, Filter } from "lucide-react";
import { api } from "../../api";
import { BibleStudyGroup, BibleStudySessionDetail } from "../../types";
import { useSocketEvent } from "../../socket";
import { ModalShell } from "../common/ModalShell";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { formatDisplayDate } from "../../utils/displayDate";
import "./study-design.css";
import { STUDY_PROGRESS_STAGES } from "./StudyProgressFields";

interface Props { group: BibleStudyGroup; onClose: () => void }

export function SessionHistoryModal({ group, onClose }: Props) {
  const [sessions, setSessions] = useState<BibleStudySessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [book, setBook] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const { page, pageSize, setPage, setPageSize } = usePageControls(JSON.stringify([group.id, debouncedQuery, book, stageFilter, fromDate, toDate, attendanceFilter]), 10);
  const [serverPaged, setServerPaged] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [latest, setLatest] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ books: string[]; stages: string[] } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision(value => value + 1);
  useSocketEvent<{ group_id?: number }>("attendance:changed", event => {
    if (event.group_id === group.id) refresh();
  });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.getSessionHistoryPage(group.id, { page, limit: pageSize, search: debouncedQuery, book, stage: stageFilter, from: fromDate, to: toDate, attendance: attendanceFilter }, controller.signal).then(data => {
      if (!active) return;
      if (data.pagination) {
        setSessions(data.data || []); setServerPaged(true); setServerTotal(data.pagination.total);
        setHistoryTotal(data.history_summary?.total ?? data.pagination.total); setLatest(data.history_summary?.latest || null);
        setFilterOptions(data.options || null);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      } else { setSessions([...(data.sessions || [])].sort((a, b) => b.session_date.localeCompare(a.session_date))); setServerPaged(false); setFilterOptions(null); }
    }).catch(err => {
      if (active) setError(err.message || "Unable to load session history.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [group.id, revision, page, pageSize, debouncedQuery, book, stageFilter, fromDate, toDate, attendanceFilter]);
  const books = filterOptions ? filterOptions.books : [...new Set(sessions.map(session => session.topic_title).filter(Boolean))].sort();
  const recordedStages = filterOptions ? filterOptions.stages : [...new Set(sessions.map(session => session.progress_stage || "not_recorded"))];
  const filtered = serverPaged ? sessions : sessions.filter(session => (!book || session.topic_title === book)
    && (!stageFilter || (session.progress_stage || "not_recorded") === stageFilter)
    && (!fromDate || session.session_date >= fromDate) && (!toDate || session.session_date <= toDate)
    && (!attendanceFilter || (attendanceFilter === "absences" ? session.absent_count > 0 : session.absent_count === 0))
    && [session.session_date, session.topic_title, session.chapter, session.notes, session.recorded_by_name]
      .some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const resultTotal = serverPaged ? serverTotal : filtered.length;
  const totalSessions = serverPaged ? historyTotal : sessions.length;
  const visibleSessions = serverPaged ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  const filteredActive = Boolean(query || book || stageFilter || fromDate || toDate || attendanceFilter);
  const resetFilters = () => { setQuery(""); setBook(""); setStageFilter(""); setFromDate(""); setToDate(""); setAttendanceFilter(""); };
  const dateLabel = formatDisplayDate;

  return <ModalShell title="Session History" icon={<ClipboardList />} size="lg" onClose={onClose}
    className="study-design" showCloseFooter={false}
    subtitle={<>{group.name} · {totalSessions} logged sessions{totalSessions > 0 && <> · Latest: {dateLabel(latest || sessions[0]?.session_date)}</>}</>}
    footer={resultTotal > pageSize ? <Pagination label="sessions" page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} /> : undefined}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-muted" />
          <input aria-label="Search session history" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search date, book, chapter, notes, or recorder…" className="ui-input pl-9" /></div>
        <Button variant="secondary" size="icon" title="Refresh session history" aria-label="Refresh session history" disabled={loading} onClick={refresh}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>
      <details className="group rounded-xl border border-gray-200 bg-[var(--surface-2)] p-3 space-y-3">
        <summary className="list-none cursor-pointer flex items-center justify-between gap-2 text-xs font-medium"><span className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-indigo" />Filter sessions{filteredActive && <span className="text-indigo font-normal"> · Filters applied</span>}</span><ChevronDown className="w-4 h-4 group-open:rotate-180" /></summary>
        {filteredActive && <button type="button" onClick={resetFilters} className="text-xs text-indigo hover:underline">Clear filters</button>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <label className="space-y-1 block"><span className="ui-field">Book</span><select aria-label="Filter sessions by book" value={book} onChange={event => setBook(event.target.value)} className="ui-input"><option value="">All books</option>{books.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="space-y-1 block"><span className="ui-field">Study stage</span><select aria-label="Filter sessions by study stage" value={stageFilter} onChange={event => setStageFilter(event.target.value)} className="ui-input"><option value="">All stages</option>{recordedStages.map(value => <option key={value} value={value}>{STUDY_PROGRESS_STAGES.find(item => item.value === value)?.label || (value === "completed" ? "Completed study" : value === "not_recorded" ? "Stage not recorded" : value)}</option>)}</select></label>
          <label className="space-y-1 block col-span-2 sm:col-span-1"><span className="ui-field">Attendance</span><select aria-label="Filter sessions by attendance" value={attendanceFilter} onChange={event => setAttendanceFilter(event.target.value)} className="ui-input"><option value="">All attendance</option><option value="absences">With absences</option><option value="no_absences">No absences</option></select></label>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1 block min-w-0"><span className="ui-field">From date</span><input aria-label="Session history from date" type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)} className="ui-input min-w-0" /></label>
          <label className="space-y-1 block min-w-0"><span className="ui-field">To date</span><input aria-label="Session history to date" type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)} className="ui-input min-w-0" /></label>
        </div>
        {fromDate && toDate && fromDate > toDate && <p role="alert" className="text-xs text-red-700">From date must be on or before the to date.</p>}
      </details>
      {loading ? <p role="status" className="text-sm text-muted py-8 text-center">Loading session history…</p>
        : error ? <div role="alert" className="text-sm text-red-700 space-y-2"><p>{error}</p><button type="button" onClick={refresh} className="underline font-medium">Try again</button></div>
        : sessions.length === 0 ? <div className="text-center py-8 space-y-2"><ClipboardList className="w-8 h-8 mx-auto text-muted" />
          <p className="font-medium">{filteredActive ? "No sessions match your search." : "No sessions logged yet"}</p><p className="text-sm text-muted">{filteredActive ? "Try adjusting the filters." : "Saved weekly roll calls will appear here."}</p></div>
        : <>
          <p className="text-xs text-muted">{resultTotal} of {totalSessions} logged sessions · Most recent first</p>
          {filtered.length === 0 && <p className="text-sm text-muted py-6 text-center">No sessions match your search.</p>}
          <div className="study-session-timeline space-y-4">{visibleSessions.map(session => {
            const stage = STUDY_PROGRESS_STAGES.find(item => item.value === session.progress_stage)?.label
              || (session.progress_stage === "completed" ? "Completed study" : session.progress_stage || "Stage not recorded");
            const isLatest = serverPaged ? session.session_date === latest : session.id === sessions[0]?.id;
            return <article key={session.id} aria-label={`Session ${session.session_date}`} className={`relative rounded-2xl border p-4 sm:p-5 space-y-4 ${isLatest ? "border-indigo-200 bg-white shadow-sm" : "border-gray-200 bg-white"}`}>
              <span aria-hidden="true" className="absolute top-7 w-2.5 h-2.5 rounded-full" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-sm flex items-center gap-2"><span className="p-2 rounded-lg bg-indigo-50 text-indigo"><Calendar className="w-4 h-4" /></span><time dateTime={session.session_date}>{dateLabel(session.session_date)}</time></h3>
                {isLatest && <Badge variant="info">Latest session</Badge>}
              </div>
              <div className="rounded-xl bg-indigo-50/50 border border-indigo-100 p-3 space-y-2">
                <div className="flex items-start gap-2"><BookOpen className="w-4 h-4 text-indigo shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold break-words min-w-0">{session.topic_title} · {session.chapter}</p></div>
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-white border border-indigo-100 text-xs text-indigo"><BookmarkCheck className="w-3 h-3" />{stage}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <Badge variant="success" count={session.present_count}><CheckCircle2 className="w-3.5 h-3.5" />{session.present_count} Present</Badge>
                <Badge variant="danger" count={session.absent_count}><UserX className="w-3.5 h-3.5" />{session.absent_count} Absent</Badge>
                <Badge variant="warning" count={session.excused_count}><Clock className="w-3.5 h-3.5" />{session.excused_count} Excused</Badge>
              </div>
              {session.notes?.trim() ? <div className="study-session-note"><p className="text-xs font-medium">Lesson Notice & Specific Location (Saan Banda Sila)</p>
                <p className="text-sm text-muted whitespace-pre-wrap break-words mt-2 leading-relaxed">{session.notes}</p></div>
                : <p className="text-xs text-muted">No lesson notice logged</p>}
              {session.is_special && <p className="text-xs text-muted">Special session: {session.special_reason || "No reason recorded"}</p>}
              <p className="text-[12px] text-muted flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" /><span className="break-words">Recorded by: {session.recorded_by_name || "Not recorded"}</span></p>
              <details className="group border-t border-gray-100 pt-3"><summary className="text-xs font-medium cursor-pointer list-none flex items-center justify-between gap-2 text-indigo rounded-lg py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">View attendance details<ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" /></summary>
                <ul className="mt-3 divide-y divide-gray-100">{[...(session.attendees || []), ...(session.absentees || []), ...(session.excused || [])].map(member =>
                  <li key={member.member_id} className="flex items-center justify-between gap-3 text-sm py-2.5"><span className="flex items-center gap-2 min-w-0"><span aria-hidden="true" className="w-7 h-7 rounded-full bg-indigo-50 text-indigo flex items-center justify-center text-[12px] shrink-0">{member.name?.slice(0, 1)}</span><span className="break-words min-w-0">{member.name}</span></span>
                    <Badge variant={member.status === "present" ? "success" : member.status === "absent" ? "danger" : "warning"} className="capitalize">{member.status}</Badge></li>)}</ul>
              </details>
            </article>;
          })}</div>
        </>}
    </ModalShell>;
}
