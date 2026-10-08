import { useEffect, useRef, useState } from 'react';
import { api, PlannedVisit, PlannedVisitSummary } from '../api';

const statuses = ['New', 'Contacted', 'Visited', 'Cancelled'] as const;
const dateLabel = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const submittedLabel = (date: string) => new Date(date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
const fieldClass = 'border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm w-full';
export function PlannedVisitsPage() {
  const [items, setItems] = useState<PlannedVisitSummary[]>([]);
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
    api.getPlannedVisits({ page, status, visit_date: date }).then(result => {
      if (cancelled) return;
      setItems(result.items); setTotal(result.total); setPages(result.totalPages);
      if (page > result.totalPages) setPage(result.totalPages);
    }).catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to load visits.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, date, refresh]);
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
  return <section className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-gray-800">
    <header><h1 className="text-2xl font-bold">Planned visits</h1><p className="text-sm text-gray-500 mt-2">Welcome upcoming visitors and follow up on their questions. All dates use Philippine time.</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm">Status<select className={fieldClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm">Visit date<input className={fieldClass} type="date" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} /></label>
      <button className="border rounded-lg px-4 py-2 self-end" onClick={() => { setStatus(''); setDate(''); setPage(1); setRefresh(value => value + 1); }}>Reset / refresh</button>
    </div>
    {detailLoading && <p role="status">Loading visit details…</p>}
    {detailError && <p role="alert" className="text-red-700">{detailError}</p>}
    {selected && <section aria-label="Visit details" className="bg-white border rounded-xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold break-words">{selected.full_name}</h2><button disabled={saving} className="border rounded-lg px-3 py-2" onClick={() => { requestId.current++; setSelected(null); setDetailError(''); }}>Close details</button></div>
      <dl className="grid gap-4 sm:grid-cols-2 text-sm break-words">
        <div><dt className="font-semibold">Visit</dt><dd>{dateLabel(selected.visit_date)} · {selected.party}</dd></div>
        <div><dt className="font-semibold">Contact</dt><dd>{selected.email || 'No email'}<br />{selected.phone || 'No phone'}</dd></div>
        <div><dt className="font-semibold">Children</dt><dd>{selected.bringing_children ? (selected.child_age_groups.join(', ') || 'Bringing children; ages not provided') : 'No children this visit'}</dd></div>
        <div><dt className="font-semibold">Submitted / consent recorded</dt><dd>{submittedLabel(selected.created_at)}<br />{submittedLabel(selected.consent_at)}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold">Questions or accessibility needs</dt><dd className="whitespace-pre-wrap">{selected.questions || 'None provided'}</dd></div>
      </dl>
      <form onSubmit={save} className="space-y-4"><fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm">Status<select className={fieldClass} value={editStatus} onChange={event => { setEditStatus(event.target.value as PlannedVisit['status']); setSaved(false); }}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <p className="text-xs text-gray-500">Mark Visited only after confirming arrival. This does not create a member or attendance record.</p>
        <label className="block text-sm">Staff notes<textarea className={fieldClass} rows={4} maxLength={4000} value={notes} onChange={event => { setNotes(event.target.value); setSaved(false); }} /></label>
        <button className="rounded-lg bg-slate-800 text-white px-4 py-2" type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
      </fieldset></form>
      {saved && <p role="status" className="text-green-700">Visit updated.</p>}
    </section>}
    {error ? <div role="alert"><p className="text-red-700">{error}</p><button className="border rounded-lg px-4 py-2 mt-2" onClick={() => setRefresh(value => value + 1)}>Retry</button></div> : loading ? <p role="status">Loading planned visits…</p> : <>
      <p className="text-sm text-gray-500">{total} visit plans</p>
      {items.length === 0 ? <p className="border rounded-xl p-6 bg-white">No planned visits match these filters.</p> : <div className="overflow-x-auto border rounded-xl bg-white"><table className="w-full text-sm text-left min-w-[640px]"><thead className="bg-gray-50"><tr>{['Visitor', 'Visit date', 'Party', 'Status', 'Submitted', 'Details'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t"><td className="p-3 max-w-48 break-words">{item.full_name}</td><td className="p-3">{dateLabel(item.visit_date)}</td><td className="p-3">{item.party}</td><td className="p-3">{item.status}</td><td className="p-3">{submittedLabel(item.created_at)}</td><td className="p-3"><button disabled={saving} className="underline" onClick={() => void open(item.id)} aria-label={`View visit for ${item.full_name}`}>View</button></td></tr>)}</tbody></table></div>}
      <nav aria-label="Planned visits pagination" className="flex items-center gap-4"><button className="border rounded-lg px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span className="text-sm">Page {page} of {pages}</span><button className="border rounded-lg px-3 py-2 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </>}
  </section>;
}
