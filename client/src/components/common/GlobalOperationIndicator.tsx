import React, { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { operationActivity } from "../../services/operationActivity";

export function GlobalOperationIndicator() {
  const activity = useSyncExternalStore(operationActivity.subscribe, operationActivity.getSnapshot);
  if (!activity.count) return null;

  return createPortal(
    <div className="global-operation-indicator pointer-events-none fixed inset-x-0 top-0 z-[10000]">
      <div className="h-1 overflow-hidden bg-indigo-100" aria-hidden="true">
        <div className="global-operation-progress h-full w-1/3 bg-amber-500" />
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" aria-label="System activity"
        className="absolute top-20 right-3 sm:right-5 w-fit max-w-[calc(100vw-1.5rem)] rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-lg flex items-center gap-3 text-charcoal">
        <Loader2 aria-hidden="true" className="w-5 h-5 text-indigo animate-spin shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-indigo-950">{activity.message}</p>
          <p className="text-[12px] text-muted mt-0.5">{activity.count > 1 ? `${activity.count} operations running` : "Please wait while this finishes."}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
