import React from "react";
import { createPortal } from "react-dom";
import { useToast, ToastItem } from "../../context/ToastContext";
import { 
  CheckCircle2, AlertCircle, AlertTriangle, Info, 
  RotateCcw, Trash2, X 
} from "lucide-react";

interface ToastCardProps {
  toast: ToastItem;
  onUndo: (id: string) => void;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onUndo, onDismiss }) => {
  const isUndo = toast.type === "undo";
  const secondsLeft = Math.ceil(toast.remainingMs / 1000);
  const progressPercent = Math.max(0, Math.min(100, (toast.remainingMs / toast.totalMs) * 100));

  const getStyleConfig = () => {
    switch (toast.type) {
      case "undo":
        return {
          bg: "bg-slate-900/95 text-white border-rose-500/30",
          icon: <Trash2 className="w-5 h-5 text-rose-400 shrink-0" />,
          progressBg: "bg-rose-500",
          iconContainer: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30"
        };
      case "error":
        return {
          bg: "bg-slate-900/95 text-white border-rose-500/30",
          icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          progressBg: "bg-rose-500",
          iconContainer: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30"
        };
      case "warning":
        return {
          bg: "bg-slate-900/95 text-white border-amber-500/30",
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          progressBg: "bg-amber-500",
          iconContainer: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
        };
      case "info":
        return {
          bg: "bg-slate-900/95 text-white border-indigo-500/30",
          icon: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
          progressBg: "bg-indigo-500",
          iconContainer: "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
        };
      case "success":
      default:
        return {
          bg: "bg-slate-900/95 text-white border-emerald-500/30",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          progressBg: "bg-emerald-500",
          iconContainer: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
        };
    }
  };

  const style = getStyleConfig();

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${style.bg} w-full max-w-sm sm:max-w-md pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-200`}
    >
      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
        {/* Left side: Icon & Message */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-xl shrink-0 ${style.iconContainer}`}>
            {style.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
              {toast.message}
            </p>
            {toast.description && (
              <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                {toast.description}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Action Button (Undo or Dismiss) */}
        <div className="flex items-center gap-2 shrink-0">
          {isUndo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onUndo(toast.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer ring-1 ring-amber-300/50"
              title="Cancel deletion and restore item"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-950 stroke-[2.5]" />
              <span>{toast.undoLabel || "Undo"}</span>
              <span className="ml-0.5 px-1 py-0.2 bg-indigo-950/20 rounded text-[10px] font-bold">
                {secondsLeft}s
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDismiss(toast.id);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isUndo ? "Dismiss & delete now" : "Close"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Countdown Progress Bar */}
      <div className="h-1 w-full bg-white/10 overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ease-linear ${style.progressBg}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, undoToast, dismissToast } = useToast();

  if (typeof document === "undefined" || toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-end gap-2.5 max-w-[calc(100vw-2rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onUndo={undoToast}
          onDismiss={dismissToast}
        />
      ))}
    </div>,
    document.body
  );
};
