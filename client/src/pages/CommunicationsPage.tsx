import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useSocketEvent } from "../socket";
import { CommunicationsPageSkeleton, CardGridSkeleton } from "../components/common/SkeletonLoader";
import { Announcement } from "../types";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import { 
  MessageSquare, Pin, Plus, Clock, User, X, Sparkles, Megaphone
} from "lucide-react";

export const CommunicationsPage: React.FC = () => {
  const { user, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);

  // Custom Confirmation & Alert Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    type: ModalType;
    confirmText?: string;
    cancelText?: string | null;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
    confirmText: "Okay",
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string, type: ModalType = "danger") => {
    setConfirmModalConfig({
      isOpen: true,
      title,
      type,
      confirmText: "Okay",
      cancelText: null,
      description: <p className="text-xs text-charcoal/80 text-center">{message}</p>,
      onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Form states
  const [announceForm, setAnnounceForm] = useState({
    title: "",
    body: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    is_pinned: false
  });

  useEffect(() => {
    loadCommunications();
  }, [selectedMinistryId]);

  // Real-time synchronization
  useSocketEvent("communications:changed", () => {
    loadCommunications();
  });

  const loadCommunications = async () => {
    try {
      setLoading(true);
      const aList = await api.getAnnouncements(selectedMinistryId ?? undefined);
      setAnnouncements(aList || []);
    } catch (err) {
      console.error("Communications load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAnnouncement({
        ...announceForm,
        ministry_id: announceForm.ministry_id ? Number(announceForm.ministry_id) : null
      });
      setIsAnnounceModalOpen(false);
      setAnnounceForm({ title: "", body: "", ministry_id: "", is_pinned: false });
      loadCommunications();
    } catch (err: any) {
      showAlert("Broadcast Failed", err.message || "Failed to publish announcement", "danger");
    }
  };

  const canPostAnnouncement = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  if (loading && announcements.length === 0) {
    return <CommunicationsPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
              Church Communications & Bulletins
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200/80 shadow-2xs">
              Church-Wide Board
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed">
            Ministry-scoped broadcasts, pastoral alerts, and official church announcements.
          </p>
        </div>

        {/* Action controls */}
        <div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          {canPostAnnouncement && (
            <button
              onClick={() => setIsAnnounceModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center justify-between bg-white/95 p-4 rounded-3xl border border-indigo-100/90 shadow-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-700" />
          <span className="text-xs font-black text-charcoal">
            Active Bulletins ({announcements.length})
          </span>
        </div>
        <span className="text-[11px] text-charcoal/60 font-semibold">
          {selectedMinistryId ? "Filtered by selected ministry" : "All church broadcasts"}
        </span>
      </div>

      {/* Announcements Content */}
      {loading && announcements.length === 0 ? (
        <CardGridSkeleton count={4} columns={2} />
      ) : announcements.length === 0 ? (
        <div className="bg-white/95 rounded-3xl p-12 text-center border border-indigo-100 shadow-sm space-y-3">
          <MessageSquare className="w-12 h-12 text-charcoal/20 mx-auto" />
          <h3 className="font-bold text-sm text-charcoal">No Announcements Yet</h3>
          <p className="text-xs text-charcoal/50 max-w-sm mx-auto">
            Check back soon for church-wide news, events reminders, and department updates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`bg-white/95 rounded-3xl p-6 border shadow-sm transition-all hover:shadow-md ${
                a.is_pinned ? "border-amber-300 bg-amber-50/20" : "border-indigo-100/90"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {a.is_pinned === 1 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-indigo-950 text-[10px] font-black flex items-center gap-1 shadow-2xs">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <h3 className="font-black text-lg text-charcoal">{a.title}</h3>
                </div>
                <span
                  className="text-[10px] font-black px-3 py-1 rounded-full text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: a.ministry_color || "#2C3968" }}
                >
                  {a.ministry_name || "All Church"}
                </span>
              </div>

              <p className="text-xs text-charcoal/80 whitespace-pre-line leading-relaxed">
                {a.body}
              </p>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-charcoal/60 flex-wrap gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-indigo-700" />
                  <strong className="text-charcoal font-bold">{a.author_name}</strong> ({a.author_role})
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {new Date(a.created_at).toLocaleDateString([], { dateStyle: 'long' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Announcement Modal */}
      {isAnnounceModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo" />
                <span>Post Ministry Announcement</span>
              </h2>
              <button onClick={() => setIsAnnounceModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Youth Camp 2026 Live"
                  value={announceForm.title}
                  onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-bold text-indigo-900"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Ministry Audience</label>
                <select
                  value={announceForm.ministry_id}
                  onChange={(e) => setAnnounceForm({ ...announceForm, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 disabled:opacity-90 disabled:cursor-not-allowed font-bold text-charcoal cursor-pointer"
                >
                  {!isRestricted && <option value="">Church-Wide (All Members)</option>}
                  {allowedMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Announcement Body *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write the update details..."
                  value={announceForm.body}
                  onChange={(e) => setAnnounceForm({ ...announceForm, body: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 leading-relaxed font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={announceForm.is_pinned}
                  onChange={(e) => setAnnounceForm({ ...announceForm, is_pinned: e.target.checked })}
                  className="rounded text-indigo cursor-pointer"
                />
                <label htmlFor="pinCheck" className="font-bold text-charcoal/80 cursor-pointer">
                  Pin to top of communications board
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnounceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black shadow-md cursor-pointer active:scale-95"
                >
                  Broadcast Announcement
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Reusable Confirmation & Alert Modal */}
      <ConfirmationModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        type={confirmModalConfig.type}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        isLoading={confirmModalConfig.isLoading}
        onConfirm={confirmModalConfig.onConfirm}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
