import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

export type GuideDataStatus = "loading" | "error" | "empty" | "filtered" | "ready";
export interface GuideDataSnapshot {
  owner: string;
  status: GuideDataStatus;
  error?: string;
  retry?: () => void | Promise<void>;
}
type Registry = Record<string, GuideDataSnapshot>;
const GuideDataContext = createContext<{
  resources: Registry;
  publish: (resource: string, owner: string, snapshot: GuideDataSnapshot | null) => void;
}>({ resources: {}, publish: () => {} });

export function GuideDataProvider({ children }: { children: React.ReactNode }) {
  const [resources, setResources] = useState<Registry>({});
  const publish = useCallback((resource: string, owner: string, snapshot: GuideDataSnapshot | null) => {
    setResources(previous => {
      if (!snapshot && previous[resource]?.owner !== owner) return previous;
      if (!snapshot) {
        const next = { ...previous };
        delete next[resource];
        return next;
      }
      if (previous[resource]?.owner === owner && previous[resource]?.status === snapshot.status
        && previous[resource]?.error === snapshot.error && previous[resource]?.retry === snapshot.retry) return previous;
      return { ...previous, [resource]: snapshot };
    });
  }, []);
  return <GuideDataContext.Provider value={{ resources, publish }}>{children}</GuideDataContext.Provider>;
}

/** Publish actual fetch state, never infer an empty database from missing DOM. */
export function useGuideDataState(resource: string, options: {
  loading: boolean; count: number; filtered?: boolean; error?: string | null;
  retry?: () => void | Promise<void>;
}) {
  const { publish } = useContext(GuideDataContext);
  const owner = useId();
  const retryRef = useRef(options.retry);
  retryRef.current = options.retry;
  const retry = useCallback(() => retryRef.current?.(), []);
  const [loadError, setLoadError] = useState<string | undefined>();
  const clearError = useCallback(() => setLoadError(undefined), []);
  const reportError = useCallback((error: unknown) => {
    setLoadError(error instanceof Error ? error.message : "Unable to load this page. Please try again.");
  }, []);
  const error = options.error || loadError;
  const status: GuideDataStatus = options.loading ? "loading" : error ? "error"
    : options.count === 0 ? options.filtered ? "filtered" : "empty" : "ready";
  useEffect(() => {
    publish(resource, owner, { owner, status, error: error || undefined, retry: options.retry ? retry : undefined });
  }, [publish, resource, owner, status, error, retry, Boolean(options.retry)]);
  useEffect(() => () => publish(resource, owner, null), [publish, resource, owner]);
  return { clearError, reportError };
}

export function useGuideResources() { return useContext(GuideDataContext).resources; }
