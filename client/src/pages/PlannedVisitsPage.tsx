import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { useEffect, useRef, useState } from 'react';
import { api, PlannedVisit, PlannedVisitSummary } from '../api';
import { CalendarDays, Users, ArrowUpRight, RefreshCw, Clock, MessageSquare, CheckCircle2, X, CalendarCheck, Circle, Save } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { Button } from '../components/common/Button';
import { ListSkeleton, AttendanceTableSkeleton } from '../components/common/SkeletonLoader';
import './plannedVisits.css';

const statuses = ['New', 'Contacted', 'Visited', 'Cancelled'] as const;
const dateLabel = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const submittedLabel = (date: string) => new Date(date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
const fieldClass = 'ui-input mt-1.5';
function VisitStatus({ status }: { status: string }) {
  const Icon = status === 'Visited' ? CheckCircle2 : status === 'Contacted' ? MessageSquare : status === 'Cancelled' ? X : Circle;
  const tone = status === 'Visited' ? 'emerald' : status === 'Contacted' ? 'sky' : status === 'Cancelled' ? 'neutral' : 'amber';
  return <span className={`visit-status visit-status--${tone}`}><Icon size={13} aria-hidden="true" />{status}</span>;
}
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
export function PlannedVisitsPage() {
  const [items, setItems] = useState<PlannedVisitSummary[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1), [status, setStatus] = useState(''), [date, setDate] = useState('');
  const [total, setTotal] = useState(0), [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<PlannedVisit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [editStatus, setEditStatus] = useState<PlannedVisit['status']>('New'), [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    api.getPlannedVisits({ page, limit: pageSize, status, visit_date: date }).then(result => {
      if (cancelled) return;
      setItems(result.items); setTotal(result.total); setPages(result.totalPages);
      if (page > result.totalPages) setPage(result.totalPages);
    }).catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to load visits.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, status, date, refresh]);
  useEffect(() => () => { requestId.current++; }, []);
  const open = async (id: number) => {
    const current = ++requestId.current;
    setSelected(null); setDetailLoading(true); setDetailError(''); setSaved(false);
    try {
      const result = await api.getPlannedVisit(id);
      if (current !== requestId.current) return;
      setSelected(result); setEditStatus(result.status); setNotes(result.staff_notes);
    } catch (failure) { if (current === requestId.current) setDetailError(failure instanceof Error ? failure.message : 'Unable to load visit.'); }
    finally { if (current === requestId.current) setDetailLoading(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || saving) return;
    setSaving(true); setDetailError(''); setSaved(false);
    try {
      await api.updatePlannedVisit(selected.id, { status: editStatus, staff_notes: notes });
      setSelected(current => current ? { ...current, status: editStatus, staff_notes: notes } : null);
      setSaved(true); setRefresh(value => value + 1);
    } catch (failure) { setDetailError(failure instanceof Error ? failure.message : 'Unable to save visit.'); }
    finally { setSaving(false); }
  };
  const reset = () => { setStatus(''); setDate(''); setPage(1); setRefresh(value => value + 1); };
  return <section className="planned-visits space-y-6 text-charcoal">
    <PageHeader icon={<CalendarDays />} title="Planned visits" description="A warm welcome starts before they arrive. Review visit plans and keep every follow-up in one place."
      meta={<span className="inline-flex items-center gap-1.5 text-xs text-muted"><Clock size={13} />Philippine time · UTC+8</span>}
      actions={<Button disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh visits</Button>} />
    <FilterPanel title="Visit filters" summary={[status || "All statuses", date || "All visit dates"].join(" · ")} aria-label="Visit filters">
<section aria-label="Visit filters" className="filter-panel-layout visit-filters visit-enter">

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
        <label className="ui-field">Status<select aria-label="Filter visits by status" className={fieldClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="ui-field min-w-0">Visit date<input aria-label="Filter visits by date" className={fieldClass} type="date" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} /></label>
        <Button onClick={reset}><RefreshCw size={14} />Reset / refresh</Button>
      </div>
    </section>
    </FilterPanel>
    {detailLoading && <ListSkeleton count={3} label="Loading visit details..." />}
    {detailError && <p role="alert" className="text-red-700">{detailError}</p>}
    {selected && <section aria-label="Visit details" className="visit-detail visit-enter">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-start gap-3 min-w-0"><span className="visit-avatar visit-avatar--large" aria-hidden="true">{initials(selected.full_name)}</span><div className="min-w-0"><p className="text-[11px] text-muted uppercase tracking-wider mb-1">Visitor details</p><h2 className="text-lg font-semibold break-words">{selected.full_name}</h2><div className="mt-2"><VisitStatus status={selected.status} /></div></div></div>
        <button type="button" disabled={saving} className="ui-button ui-button--secondary ui-button--icon shrink-0" aria-label="Close details" onClick={() => { requestId.current++; setSelected(null); setDetailError(''); }}><X size={17} /></button>
      </div>
      <dl className="visit-detail-grid grid gap-4 sm:grid-cols-2 text-sm break-words">
        <div><dt className="font-semibold">Visit</dt><dd>{dateLabel(selected.visit_date)} · {selected.party}</dd></div>
        <div><dt className="font-semibold">Contact</dt><dd>{selected.email || 'No email'}<br />{selected.phone || 'No phone'}</dd></div>
        <div><dt className="font-semibold">Children</dt><dd>{selected.bringing_children ? (selected.child_age_groups.join(', ') || 'Bringing children; ages not provided') : 'No children this visit'}</dd></div>
        <div><dt className="font-semibold">Submitted / consent recorded</dt><dd>{submittedLabel(selected.created_at)}<br />{submittedLabel(selected.consent_at)}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold">Questions or accessibility needs</dt><dd className="whitespace-pre-wrap">{selected.questions || 'None provided'}</dd></div>
      </dl>
      <form onSubmit={save} className="border-t border-gray-100 pt-5"><fieldset disabled={saving} className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><MessageSquare size={15} className="text-indigo" />Welcome & follow-up</h3>
        <label className="block ui-field">Status<select className={fieldClass} value={editStatus} onChange={event => { setEditStatus(event.target.value as PlannedVisit['status']); setSaved(false); }}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <p className="text-xs text-muted">Mark Visited only after confirming arrival. This does not create a member or attendance record.</p>
        <label className="block ui-field">Staff notes<textarea className={fieldClass} rows={4} maxLength={4000} placeholder="Add a follow-up, question, or welcome arrangement…" value={notes} onChange={event => { setNotes(event.target.value); setSaved(false); }} /></label>
        <div className="flex justify-end"><Button variant="primary" type="submit"><Save size={15} />{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </fieldset></form>
      {saved && <p role="status" className="text-emerald-700 text-sm flex items-center gap-2"><CheckCircle2 size={16} />Visit updated.</p>}
    </section>}
    {error ? <div role="alert"><p className="text-red-700">{error}</p><button className="border rounded-lg px-4 py-2 mt-2" onClick={() => setRefresh(value => value + 1)}>Retry</button></div> : loading ? <AttendanceTableSkeleton columns={6} showAvatar={false} showDirectoryHeader={false} /> : <>
      <section className="visit-ledger visit-enter" aria-label="Visitor plans">
        <div className="visit-ledger-heading"><div><h2 className="text-sm font-semibold flex items-center gap-2"><Users size={17} className="text-indigo" />Visitor plans <span className="visit-total"><AnimatedNumber value={total} /></span></h2><p className="text-xs text-muted mt-1.5">{status || date ? 'Matching your selected filters' : 'Most recent visit dates first'} · {total} visit plans</p></div><span className="text-[11px] text-muted flex items-center gap-1.5"><CalendarCheck size={14} />Welcome & follow-up</span></div>
        {items.length === 0 ? <div className="text-center py-12 px-5 space-y-3"><span className="visit-empty-icon"><CalendarDays size={25} /></span><h3 className="font-semibold text-sm">No planned visits match these filters.</h3><p className="text-xs text-muted">{status || date ? 'Try another status or date to find a visit.' : 'New visitor plans will appear here when submitted.'}</p>{(status || date) && <Button onClick={reset}>Clear filters</Button>}</div> : <>
          <div className="hidden md:block overflow-x-auto"><table className="visit-table w-full text-sm text-left min-w-[760px]"><thead><tr>{['Visitor', 'Visit date', 'Party', 'Status', 'Submitted', 'Details'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id} className="visit-row" style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}>
            <td><div className="flex items-center gap-3"><span className="visit-avatar" aria-hidden="true">{initials(item.full_name)}</span><div className="max-w-56"><p className="font-semibold break-words">{item.full_name}</p><p className="text-[11px] text-muted mt-1">Visitor · #{item.id}</p></div></div></td>
            <td><span className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap"><CalendarDays size={14} className="text-muted" />{dateLabel(item.visit_date)}</span></td>
            <td><span className="inline-flex items-center gap-1.5 text-xs"><Users size={13} className="text-muted" />{item.party}</span></td><td><VisitStatus status={item.status} /></td>
            <td className="text-muted text-[11px]"><time dateTime={item.created_at}>{submittedLabel(item.created_at)}</time></td>
            <td><button type="button" disabled={saving} className="visit-view" onClick={() => void open(item.id)} aria-label={`View visit for ${item.full_name}`}>View<ArrowUpRight size={14} /></button></td>
          </tr>)}</tbody></table></div>
          <div className="md:hidden divide-y divide-gray-100">{items.map((item, index) => <article key={item.id} className="visit-mobile-card visit-row" style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }} aria-label={`Visit plan for ${item.full_name}`}>
            <div className="flex items-start gap-3"><span className="visit-avatar shrink-0" aria-hidden="true">{initials(item.full_name)}</span><div className="min-w-0 flex-1"><h3 className="font-semibold text-sm break-words">{item.full_name}</h3><p className="text-[11px] text-muted mt-1">Visitor · #{item.id}</p></div><VisitStatus status={item.status} /></div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs mt-4"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-indigo" />{dateLabel(item.visit_date)}</span><span className="inline-flex items-center gap-1.5"><Users size={14} className="text-muted" />{item.party}</span></div>
            <div className="flex items-center justify-between gap-3 mt-4"><time dateTime={item.created_at} className="text-[11px] text-muted">{submittedLabel(item.created_at)}</time><button type="button" disabled={saving} className="visit-view shrink-0" onClick={() => void open(item.id)} aria-label={`View visit for ${item.full_name}`}>View<ArrowUpRight size={14} /></button></div>
          </article>)}</div>
        </>}
      </section>
      <Pagination label="planned visits" page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} loading={loading} />
    </>}
  </section>;
}
