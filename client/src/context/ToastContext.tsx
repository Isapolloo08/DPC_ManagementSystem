import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning" | "undo";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  durationMs: number;
  remainingMs: number;
  totalMs: number;
  createdAt: number;
  onUndo?: () => void | Promise<void>;
  onCommit?: () => void | Promise<void>;
  undoLabel?: string;
  status: "active" | "undone" | "committed";
}

export interface ShowUndoToastOptions {
  message: string;
  description?: string;
  durationMs?: number;
  onUndo: () => void | Promise<void>;
  onCommit: () => void | Promise<void>;
  undoLabel?: string;
}

export interface DeleteWithUndoOptions<T = any> {
  itemName: string;
  itemType?: string;
  item?: T;
  durationMs?: number;
  onOptimisticDelete: () => void;
  onRestore: () => void;
  onCommitDelete: () => Promise<void>;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: "success" | "error" | "info" | "warning", durationMs?: number) => string;
  showUndoToast: (options: ShowUndoToastOptions) => string;
  deleteWithUndo: <T = any>(options: DeleteWithUndoOptions<T>) => string;
  dismissToast: (id: string, commitImmediately?: boolean) => void;
  undoToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  toastsRef.current = toasts;

  // Flush all pending commits when user closes/reloads window
  useEffect(() => {
    const handleBeforeUnload = () => {
      toastsRef.current.forEach((t) => {
        if (t.type === "undo" && t.status === "active" && t.onCommit) {
          try {
            t.onCommit();
          } catch (e) {
            console.error("Failed to commit deletion on beforeunload:", e);
          }
        }
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Timer tick for countdown updates & automatic commit/dismissal
  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const currentToasts = toastsRef.current;
      if (currentToasts.length === 0) return;

      const expiredToasts: ToastItem[] = [];
      const updatedToasts: ToastItem[] = [];
      let hasChanges = false;

      for (const toast of currentToasts) {
        const elapsed = now - toast.createdAt;
        const remaining = Math.max(0, toast.totalMs - elapsed);

        if (remaining <= 0) {
          expiredToasts.push(toast);
          hasChanges = true;
        } else {
          if (Math.abs(toast.remainingMs - remaining) > 80) {
            hasChanges = true;
            updatedToasts.push({
              ...toast,
              remainingMs: remaining
            });
          } else {
            updatedToasts.push(toast);
          }
        }
      }

      if (hasChanges) {
        setToasts(updatedToasts);
        // Execute expired commits safely OUTSIDE the state updater
        for (const t of expiredToasts) {
          if (t.type === "undo" && t.status === "active" && t.onCommit) {
            Promise.resolve(t.onCommit()).catch((err) => {
              console.error("Delayed commit deletion failed:", err);
            });
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [toasts.length]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" | "warning" = "success", durationMs = 4000): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        message,
        durationMs,
        remainingMs: durationMs,
        totalMs: durationMs,
        createdAt: Date.now(),
        status: "active"
      };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts
      return id;
    },
    []
  );

  const showUndoToast = useCallback((options: ShowUndoToastOptions): string => {
    const durationMs = options.durationMs || 5000;
    const id = `undo-toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newToast: ToastItem = {
      id,
      type: "undo",
      message: options.message,
      description: options.description,
      durationMs,
      remainingMs: durationMs,
      totalMs: durationMs,
      createdAt: Date.now(),
      onUndo: options.onUndo,
      onCommit: options.onCommit,
      undoLabel: options.undoLabel || "Undo",
      status: "active"
    };

    setToasts((prev) => [...prev.slice(-4), newToast]);
    return id;
  }, []);

  const deleteWithUndo = useCallback(
    <T = any,>({
      itemName,
      itemType = "Item",
      durationMs = 5000,
      onOptimisticDelete,
      onRestore,
      onCommitDelete
    }: DeleteWithUndoOptions<T>): string => {
      // 1. Immediately remove from UI
      try {
        onOptimisticDelete();
      } catch (e) {
        console.error("Optimistic delete failed:", e);
      }

      // 2. Show Undo Toast
      return showUndoToast({
        message: `${itemType ? itemType + " " : ""}'${itemName}' deleted`,
        durationMs,
        undoLabel: "Undo",
        onUndo: () => {
          try {
            onRestore();
          } catch (e) {
            console.error("Restore failed:", e);
          }
          showToast(`Restored '${itemName}'`, "info", 3000);
        },
        onCommit: async () => {
          try {
            await onCommitDelete();
          } catch (err: any) {
            // Restore on server failure and show error
            try {
              onRestore();
            } catch (e) {
              console.error("Restore on error failed:", e);
            }
            showToast(err?.message || `Failed to delete '${itemName}' on server. Restored.`, "error", 5000);
          }
        }
      });
    },
    [showUndoToast, showToast]
  );

  const dismissToast = useCallback((id: string, commitImmediately = true) => {
    const target = toastsRef.current.find((t) => t.id === id);
    setToasts((prev) => prev.filter((t) => t.id !== id));

    if (target && target.type === "undo" && target.status === "active" && commitImmediately && target.onCommit) {
      Promise.resolve(target.onCommit()).catch((err) => {
        console.error("Commit on dismiss failed:", err);
      });
    }
  }, []);

  const undoToast = useCallback((id: string) => {
    const target = toastsRef.current.find((t) => t.id === id);
    if (!target) return;

    // Immediately remove from toast list and cancel countdown
    setToasts((prev) => prev.filter((t) => t.id !== id));

    // Execute undo callback safely outside of React state update
    if (target.type === "undo" && target.status === "active" && target.onUndo) {
      setTimeout(() => {
        try {
          target.onUndo?.();
        } catch (err) {
          console.error("Undo handler failed:", err);
        }
      }, 0);
    }
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showUndoToast,
        deleteWithUndo,
        dismissToast,
        undoToast,
        clearAllToasts
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
