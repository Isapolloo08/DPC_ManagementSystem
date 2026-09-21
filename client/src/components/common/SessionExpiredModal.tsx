import React from "react";
import { createPortal } from "react-dom";
import { Clock, LogIn, ShieldAlert, Sparkles } from "lucide-react";

export interface SessionExpiredModalProps {
  isOpen: boolean;
  onGoToLogin: () => void;
  message?: string;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onGoToLogin,
  message
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up text-center">
        {/* Subtle decorative top background gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600" />

        {/* Center Pulsing Icon */}
        <div className="mx-auto mb-4 relative flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-50 border border-amber-100/80 shadow-inner">
          <div className="absolute -top-1 -right-1 p-1 bg-amber-500 rounded-full text-white shadow-xs">
            <Clock className="w-3.5 h-3.5 animate-spin-slow" />
          </div>
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] font-bold tracking-wide uppercase mb-2.5">
          <Sparkles className="w-3 h-3 text-amber-600" />
          <span>Session Timeout Notice</span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
          Your Session Has Expired
        </h2>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
          {message || (
            <>
              Your 3-day login session has expired for security purposes. Please log in again to continue managing your church records.
            </>
          )}
        </p>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onGoToLogin}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 hover:from-indigo-900 hover:to-indigo-800 text-white font-black text-sm shadow-lg shadow-indigo-950/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <LogIn className="w-4 h-4" />
          <span>Go to Login Page</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
