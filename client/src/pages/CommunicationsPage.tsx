import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { Announcement, PrayerRequest } from "../types";
import { 
  MessageSquare, Heart, Pin, Plus, CheckCircle2, 
  Clock, ShieldCheck, User, X, Sparkles, Send 
} from "lucide-react";

export const CommunicationsPage: React.FC = () => {
  const { user, ministries, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const [activeTab, setActiveTab] = useState<"announcements" | "prayers">("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayerFilter, setPrayerFilter] = useState<string>("all");
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);

  // Form states
  const [announceForm, setAnnounceForm] = useState({
    title: "",
    body: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    is_pinned: false
  });
  const [prayerForm, setPrayerForm] = useState({
    request_text: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    is_anonymous: false
  });

  useEffect(() => {
    loadCommunications();
  }, [selectedMinistryId, prayerFilter]);

  const loadCommunications = async () => {
    try {
      const [aList, pList] = await Promise.all([
        api.getAnnouncements(selectedMinistryId ?? undefined),
        api.getPrayerRequests({
          ministry_id: selectedMinistryId ?? undefined,
          status: prayerFilter !== "all" ? prayerFilter : undefined
        })
      ]);
      setAnnouncements(aList);
      setPrayers(pList);
    } catch (err) {
      console.error("Communications load error:", err);
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
      alert(err.message || "Failed to publish announcement");
    }
  };

  const handleSubmitPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.submitPrayerRequest({
        ...prayerForm,
        ministry_id: prayerForm.ministry_id ? Number(prayerForm.ministry_id) : null
      });
      setIsPrayerModalOpen(false);
      setPrayerForm({ request_text: "", ministry_id: "", is_anonymous: false });
      loadCommunications();
    } catch (err: any) {
      alert(err.message || "Failed to submit prayer");
    }
  };

  const handleTogglePrayerStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === "open" ? "answered" : "open";
    try {
      await api.updatePrayerStatus(id, nextStatus as any);
      loadCommunications();
    } catch (err: any) {
      alert(err.message || "Failed to update prayer status");
    }
  };

  const canPostAnnouncement = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
              Communications & Prayer Fellowship
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200/80 shadow-2xs">
              Church-Wide Bulletin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed">
            Ministry-scoped broadcasts, church alerts, and community prayer request tracking.
          </p>
        </div>

        {/* Tab & Action controls */}
        <div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          {activeTab === "announcements" && canPostAnnouncement && (
            <button
              onClick={() => setIsAnnounceModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>Post Announcement</span>
            </button>
          )}

          {activeTab === "prayers" && (
            <button
              onClick={() => setIsPrayerModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4 text-amber-300" />
              <span>Submit Prayer Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/95 p-3 sm:p-4 rounded-3xl border border-indigo-100/90 shadow-sm">
        <div className="flex items-center bg-ivory-light p-1 rounded-2xl border border-indigo-100/80">
          <button
            onClick={() => setActiveTab("announcements")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "announcements" ? "bg-indigo-900 text-white shadow-sm" : "text-charcoal/60 hover:text-charcoal"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Announcements ({announcements.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("prayers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "prayers" ? "bg-emerald-700 text-white shadow-sm" : "text-charcoal/60 hover:text-charcoal"
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Prayer Requests ({prayers.length})</span>
          </button>
        </div>

        {activeTab === "prayers" && (
          <div className="flex items-center gap-2 pr-2">
            <span className="text-xs text-charcoal/60 font-bold">Filter:</span>
            <select
              value={prayerFilter}
              onChange={(e) => setPrayerFilter(e.target.value)}
              className="text-xs font-black text-indigo-900 bg-ivory-light px-3.5 py-2 rounded-2xl border border-indigo-100 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">🙏 Open Requests</option>
              <option value="answered">✨ Praise & Answered</option>
            </select>
          </div>
        )}
      </div>

      {/* Content Area */}
      {activeTab === "announcements" ? (
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
      ) : (
        /* Prayer Requests Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {prayers.map((p) => {
            const isAnswered = p.status === "answered";
            return (
              <div
                key={p.id}
                className={`bg-white/95 rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                  isAnswered ? "border-emerald-200/90 bg-emerald-50/20" : "border-indigo-100/90"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                      isAnswered ? "bg-emerald-100 text-emerald-950 border border-emerald-300" : "bg-amber-100 text-amber-950 border border-amber-300"
                    }`}>
                      {isAnswered ? "✨ Answered Praise" : "🙏 Active Prayer Petition"}
                    </span>
                    <span className="text-[11px] font-bold text-charcoal/50">
                      {p.ministry_name || "Church-Wide"}
                    </span>
                  </div>

                  <p className="text-xs text-charcoal/80 italic leading-relaxed my-2 font-serif text-sm">
                    "{p.request_text}"
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-charcoal/70 font-medium">
                    From: <strong className="text-charcoal font-bold">{p.submitter_name || "Church Family"}</strong>
                  </span>
                  <button
                    onClick={() => handleTogglePrayerStatus(p.id, p.status)}
                    className={`text-xs font-black px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer ${
                      isAnswered
                        ? "bg-gray-100 hover:bg-gray-200 text-charcoal/80"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95"
                    }`}
                  >
                    {isAnswered ? "Reopen Request ↺" : "Mark as Answered ✨"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Announcement Modal */}
      {isAnnounceModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
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
        </div>
      )}

      {/* Submit Prayer Modal */}
      {isPrayerModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose" />
                <span>Submit Prayer Request</span>
              </h2>
              <button onClick={() => setIsPrayerModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPrayer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Your Prayer Petition *</label>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {["Healing & Health", "Family & Relationships", "Spiritual Growth", "Guidance & Decisions", "Financial Provision", "Thanksgiving"].map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        const prefix = `[${tag}] `;
                        if (!prayerForm.request_text.startsWith(prefix)) {
                          setPrayerForm({ ...prayerForm, request_text: `${prefix}${prayerForm.request_text}` });
                        }
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 hover:bg-indigo-100 font-bold transition-colors cursor-pointer border border-indigo-100"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={4}
                  required
                  placeholder="Share what is on your heart for pastoral and ministry prayer warriors..."
                  value={prayerForm.request_text}
                  onChange={(e) => setPrayerForm({ ...prayerForm, request_text: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-medium leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Ministry Fellowship Scope</label>
                <select
                  value={prayerForm.ministry_id}
                  onChange={(e) => setPrayerForm({ ...prayerForm, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 disabled:opacity-90 disabled:cursor-not-allowed font-bold text-charcoal cursor-pointer"
                >
                  {!isRestricted && <option value="">Church-Wide Prayer Team</option>}
                  {allowedMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="anonCheck"
                  checked={prayerForm.is_anonymous}
                  onChange={(e) => setPrayerForm({ ...prayerForm, is_anonymous: e.target.checked })}
                  className="rounded text-indigo cursor-pointer"
                />
                <label htmlFor="anonCheck" className="font-bold text-charcoal/80 cursor-pointer">
                  Submit anonymously (Name hidden from public view)
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrayerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black shadow-md cursor-pointer active:scale-95"
                >
                  Submit Prayer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
