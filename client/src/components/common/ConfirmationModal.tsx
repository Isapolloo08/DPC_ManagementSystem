import React from "react";
import { createPortal } from "react-dom";
import { 
  AlertTriangle, Trash2, Sparkles, CheckCircle2, 
  Info, X, ArrowRight, Users, AlertCircle, ArrowLeftRight, Loader2
} from "lucide-react";

export type ModalType = "danger" | "warning" | "info" | "success" | "promotion" | "swap" | "delete";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string | null;
  confirmVariant?: "danger" | "primary" | "emerald" | "amber" | "rose";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  type = "info",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant,
  isLoading = false,
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  // Derive visual styles based on modal type
  const getTypeConfig = () => {
    switch (type) {
      case "danger":
      case "delete":
        return {
          icon: <Trash2 className="w-6 h-6 text-rose-600" />,
          iconBg: "bg-rose-100 ring-8 ring-rose-50",
          badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
          btnColor: "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-200",
          accentBorder: "border-rose-100"
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: "bg-amber-100 ring-8 ring-amber-50",
          badgeColor: "bg-amber-100 text-amber-900 border-amber-200",
          btnColor: "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-indigo-950 font-black shadow-amber-200",
          accentBorder: "border-amber-100"
        };
      case "promotion":
        return {
          icon: <Sparkles className="w-6 h-6 text-amber-400" />,
          iconBg: "bg-gradient-to-br from-indigo-900 to-indigo-950 ring-8 ring-indigo-50",
          badgeColor: "bg-amber-100 text-amber-950 border-amber-300",
          btnColor: "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black shadow-amber-200",
          accentBorder: "border-amber-200/80"
        };
      case "success":
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: "bg-emerald-100 ring-8 ring-emerald-50",
          badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-200",
          btnColor: "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-200",
          accentBorder: "border-emerald-100"
        };
      case "swap":
        return {
          icon: <ArrowLeftRight className="w-6 h-6 text-indigo-600" />,
          iconBg: "bg-indigo-100 ring-8 ring-indigo-50",
          badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-200",
          btnColor: "bg-gradient-to-r from-indigo-900 to-indigo-950 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-indigo-200",
          accentBorder: "border-indigo-100"
        };
      case "info":
      default:
        return {
          icon: <Info className="w-6 h-6 text-indigo-600" />,
          iconBg: "bg-indigo-100 ring-8 ring-indigo-50",
          badgeColor: "bg-indigo-50 text-indigo-900 border-indigo-100",
          btnColor: "bg-gradient-to-r from-indigo-900 to-indigo-950 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-indigo-200",
          accentBorder: "border-indigo-100"
        };
    }
  };

  const config = getTypeConfig();

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className={`bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border ${config.accentBorder} space-y-5 animate-in zoom-in-95 duration-150 relative overflow-hidden`}
      >
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-600/5 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10"></div>

        {/* Close icon button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-charcoal/40 hover:text-charcoal/80 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center shadow-xs transition-transform duration-200`}>
            {config.icon}
          </div>

          <div className="space-y-1.5 px-2">
            <h3 className="text-lg font-black text-indigo-950 tracking-tight">
              {title}
            </h3>
            <div className="text-xs text-charcoal/70 leading-relaxed font-normal">
              {description}
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center gap-2.5 pt-2">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-2xl border border-gray-200 hover:bg-gray-100/80 text-charcoal font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${config.btnColor}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
