import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;
  loading?: boolean;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, label = "records", loading = false }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-white p-3 sm:p-4 text-xs text-muted">
    <p aria-live="polite">Showing <strong className="text-charcoal">{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</strong> of <strong className="text-charcoal">{total.toLocaleString()}</strong> {label}</p>
    <div className="flex w-full sm:w-auto flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2">Rows per page<select aria-label={`${label} rows per page`} value={pageSize} disabled={loading} onChange={event => onPageSizeChange(Number(event.target.value))} className="ui-input w-auto min-h-9 py-1.5">
        {[10, 20, 30, 50, 100].map(size => <option key={size}>{size}</option>)}
      </select></label>
      <div className="flex items-center gap-2">
      <span>Page {page} of {pages}</span>
      <button type="button" aria-label={`Previous ${label} page`} disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} className="ui-button ui-button--secondary ui-button--icon disabled:opacity-40"><ChevronLeft size={16} /></button>
      <button type="button" aria-label={`Next ${label} page`} disabled={loading || page >= pages} onClick={() => onPageChange(page + 1)} className="ui-button ui-button--secondary ui-button--icon disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>
    </div>
  </nav>;
}
