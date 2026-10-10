import { useEffect, useState } from "react";

export interface ListPage<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary?: Record<string, number>;
}

export function usePageControls(filterKey = "", initialSize = 30) {
  const [state, setState] = useState({ key: filterKey, page: 1, size: initialSize });
  const page = state.key === filterKey ? state.page : 1;
  const setPage = (page: number) => setState(current => ({ ...current, key: filterKey, page }));
  const setPageSize = (size: number) => setState({ key: filterKey, page: 1, size });
  return { page, pageSize: state.size, setPage, setPageSize };
}

/** For bounded calendar/rotation datasets; growing collections use API pagination. */
export function useListPagination<T>(items: T[], filterKey = "", initialSize = 20) {
  const controls = usePageControls(filterKey, initialSize);
  const pages = Math.max(1, Math.ceil(items.length / controls.pageSize));
  const page = Math.min(controls.page, pages);
  return { ...controls, page, total: items.length, items: items.slice((page - 1) * controls.pageSize, page * controls.pageSize) };
}

// Retain compatibility with legacy arrays and offline demo fixtures.
export function readListPage<T>(response: ListPage<T> | T[], page: number, size: number): ListPage<T> {
  if (!Array.isArray(response)) return response;
  const pages = Math.max(1, Math.ceil(response.length / size));
  const current = Math.min(page, pages);
  return { data: response.slice((current - 1) * size, current * size), pagination: { page: current, limit: size, total: response.length, totalPages: pages } };
}

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
