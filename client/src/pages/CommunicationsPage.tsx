import { FilterPanel } from "../components/common/FilterPanel";
import { usePageControls, useDebouncedValue } from "../hooks/useListPagination";
import { Pagination } from "../components/common/Pagination";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/common/Button";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { useSocketEvent } from "../socket";
import { CommunicationsPageSkeleton, CardGridSkeleton } from "../components/common/SkeletonLoader";
import { Announcement } from "../types";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import { 
  MessageSquare, Pin, Plus, Clock, User, X, Megaphone, Trash2
} from "lucide-react";

export const CommunicationsPage: React.FC = () => {
  const { user, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { page, pageSize, setPage, setPageSize } = usePageControls(JSON.stringify([selectedMinistryId, debouncedSearch]), 20);
  const [serverPaged, setServerPaged] = useState(false);
  const [total, setTotal] = useState(0);
  const sequence = useRef(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);

  const canManageBulletins = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";

  const handleDeleteAnnouncement = (id: number, title: string) => {
    const originalAnnouncements = announcements;
    deleteWithUndo({
      itemName: title,
      itemType: "Announcement",
      onOptimisticDelete: () => {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      },
      onRestore: () => {
        setAnnouncements(originalAnnouncements);
      },
      onCommitDelete: async () => {
        await api.deleteAnnouncement(id);
      }
    });
  };

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
  }, [selectedMinistryId, page, pageSize, debouncedSearch]);
  useEffect(() => () => { sequence.current++; }, []);

  // Real-time synchronization
  useSocketEvent("communications:changed", () => {
    loadCommunications();
  });

 const loadCommunications = async () => {
    const requestId = ++sequence.current;
    guideData.clearError();
    try {
      setLoading(true);
      const aList = await api.getAnnouncementsPage({ ministry_id: selectedMinistryId ?? undefined, page, limit: pageSize, search: debouncedSearch });
      if (requestId !== sequence.current) return;
      if (Array.isArray(aList)) { setAnnouncements(aList); setTotal(aList.length); setServerPaged(false); }
      else { setAnnouncements(aList.data); setTotal(aList.pagination.total); setServerPaged(true); if (aList.pagination.page !== page) setPage(aList.pagination.page); }
    } catch (err) {
      if (requestId !== sequence.current) return;
      console.error("Communications load error:", err);
      guideData.reportError(err);
    } finally {
      if (requestId === sequence.current) { setHasLoaded(true); setLoading(false); }
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceForm.title.trim()) {
      showAlert("Title Required", "Please enter an announcement title.", "warning");
      return;
    }
    if (!announceForm.body.trim()) {
      showAlert("Message Body Required", "Please enter the announcement message content.", "warning");
      return;
    }

    try {
      await api.createAnnouncement({
        ...announceForm,
        title: announceForm.title.trim(),
        body: announceForm.body.trim(),
        ministry_id: announceForm.ministry_id ? Number(announceForm.ministry_id) : null
      });
      setIsAnnounceModalOpen(false);
      setAnnounceForm({ title: "", body: "", ministry_id: "", is_pinned: false });
      loadCommunications();
    } catch (err: any) {
      showAlert("Broadcast Failed", err.message || "Failed to publish announcement", "danger");
    }
  };

  const canPostAnnouncement = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";

  const filtered = serverPaged ? announcements : announcements.filter(item => (item.title + " " + item.body + " " + item.author_name).toLowerCase().includes(search.trim().toLowerCase()));
  const visible = serverPaged ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  const resultTotal = serverPaged ? total : filtered.length;
  const guideData = useGuideDataState("announcements", { loading, count: announcements.length, filtered: Boolean(selectedMinistryId), retry: loadCommunications });

  if (loading && !hasLoaded) {
    return <CommunicationsPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader icon={<Megaphone />} title={<>Church Communications & Bulletins</>}
        description={<>Ministry-scoped broadcasts, pastoral alerts, and official church announcements.</>}
        actions={<><div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          {canPostAnnouncement && (
            <Button data-guide="announcement-new" onClick={() => setIsAnnounceModalOpen(true)} variant="primary">
              <Plus className="w-4 h-4 " />
              <span>Post Announcement</span>
            </Button>
          )}
        </div></>} />

      {/* Summary Bar */}
      <div className="flex items-center justify-between bg-white/95 p-4 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-700" />
          <span className="text-xs font-medium text-charcoal">
            Active Bulletins ({resultTotal})
          </span>
        </div>
        <span className="text-[12px] text-muted font-medium">
          {selectedMinistryId ? "Filtered by selected ministry" : "All church broadcasts"}
        </span>
      </div>

      <FilterPanel title="Announcement filters" summary={search || "All announcements"}>
        <input aria-label="Search announcements" placeholder="Search title, message, or author…" value={search} onChange={event => setSearch(event.target.value)} className="ui-input" />
      </FilterPanel>

      {/* Announcements Content */}
      <div data-guide="announcements-list">
      {loading && filtered.length === 0 ? (
        <CardGridSkeleton count={4} columns={2} />
      ) : announcements.length === 0 ? (
        <div className="bg-white/95 rounded-2xl p-12 text-center border border-indigo-100 shadow-sm space-y-3">
          <MessageSquare className="w-12 h-12 text-charcoal/20 mx-auto" />
          <h3 className="font-semibold text-sm text-charcoal">No Announcements Yet</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Check back soon for church-wide news, events reminders, and department updates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((a) => (
            <div
              key={a.id}
              className={`bg-white/95 rounded-3xl p-6 border shadow-sm transition-all hover:shadow-md ${
                a.is_pinned ? "border-amber-300 bg-amber-50/20" : "border-indigo-100/90"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {a.is_pinned === 1 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-indigo-950 text-[12px] font-medium flex items-center gap-1 shadow-2xs">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <h3 className="font-semibold text-lg text-charcoal">{a.title}</h3>
                </div>
                <span
                  className="text-[12px] font-medium px-3 py-1 rounded-full text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: a.ministry_color || "#2C3968" }}
                >
                  {a.ministry_name || "All Church"}
                </span>
              </div>

              <p className="text-xs text-charcoal/80 whitespace-pre-line leading-relaxed">
                {a.body}
              </p>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-muted flex-wrap gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-indigo-700" />
                  <strong className="text-charcoal font-medium">{a.author_name}</strong> ({a.author_role})
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {new Date(a.created_at).toLocaleDateString([], { dateStyle: 'long' })}
                  </span>
                  {canManageBulletins && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAnnouncement(a.id, a.title)}
                      className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Announcement Modal */}
      </div>
      <Pagination label="announcements" page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} />
      {isAnnounceModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4 animate-scale-up">
            <div data-modal-header className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-charcoal flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo" />
                <span>Post Ministry Announcement</span>
              </h2>
              <button onClick={() => setIsAnnounceModalOpen(false)} className="p-1 text-muted hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="announcement-form" onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-charcoal mb-1">Title *</label>
                <input data-guide="announcement-title"
                  type="text"
                  required
                  placeholder="e.g. Summer Youth Camp 2026 Live"
                  value={announceForm.title}
                  onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-medium text-indigo-900"
                />
              </div>

              <div>
                <label className="block font-medium text-charcoal mb-1">Ministry Audience</label>
                <select data-guide="announcement-audience"
                  value={announceForm.ministry_id}
                  onChange={(e) => setAnnounceForm({ ...announceForm, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 disabled:opacity-90 disabled:cursor-not-allowed font-medium text-charcoal cursor-pointer"
                >
                  {!isRestricted && <option value="">Church-Wide (All Members)</option>}
                  {allowedMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-charcoal mb-1">Announcement Body *</label>
                <textarea data-guide="announcement-body"
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
                <label htmlFor="pinCheck" className="font-medium text-charcoal/80 cursor-pointer">
                  Pin to top of communications board
                </label>
              </div>

              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnounceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button data-guide="announcement-save"
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium shadow-md cursor-pointer active:scale-95"
                >
                  Broadcast Announcement
                </button>
              </div>
            </form>
          </ModalPanel>
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
