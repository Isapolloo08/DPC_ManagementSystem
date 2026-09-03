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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal flex items-center gap-2">
            <span>Communications & Prayer Fellowship</span>
          </h1>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Ministry-scoped broadcasts, church alerts, and community prayer request tracking.
          </p>
        </div>

        {/* Tab & Action controls */}
        <div className="flex items-center gap-2">
          {activeTab === "announcements" && canPostAnnouncement && (
            <button
              onClick={() => setIsAnnounceModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-amber-300" />
              <span>Post Announcement</span>
            </button>
          )}

          {activeTab === "prayers" && (
            <button
              onClick={() => setIsPrayerModalOpen(true)}
              className="flex items-center gap-1.5 bg-sage hover:bg-sage-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5 text-amber-200" />
              <span>Submit Prayer Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-indigo-100/80 shadow-2xs">
        <div className="flex items-center bg-ivory p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("announcements")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "announcements" ? "bg-white text-indigo shadow-2xs" : "text-charcoal/60"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo" />
            <span>Announcements ({announcements.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("prayers")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "prayers" ? "bg-white text-sage-800 shadow-2xs" : "text-charcoal/60"
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose" />
            <span>Prayer Requests ({prayers.length})</span>
          </button>
        </div>

        {activeTab === "prayers" && (
          <div className="flex items-center gap-2 pr-2">
            <span className="text-xs text-charcoal/60 font-medium">Filter:</span>
            <select
              value={prayerFilter}
              onChange={(e) => setPrayerFilter(e.target.value)}
              className="text-xs font-semibold bg-ivory px-2.5 py-1 rounded-lg border border-gray-200 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open Prayers</option>
              <option value="answered">Praise & Answered</option>
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
              className={`bg-white rounded-2xl p-5 border shadow-2xs ${
                a.is_pinned ? "border-amber-300 bg-amber-50/15" : "border-indigo-100/80"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {a.is_pinned === 1 && (
                    <span className="p-1 rounded-md bg-amber text-charcoal text-[10px] font-bold flex items-center gap-1">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <h3 className="font-bold text-base text-charcoal">{a.title}</h3>
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white shrink-0"
                  style={{ backgroundColor: a.ministry_color || "#2C3968" }}
                >
                  {a.ministry_name || "All Church"}
                </span>
              </div>

              <p className="text-xs text-charcoal/80 whitespace-pre-line leading-relaxed">
                {a.body}
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-charcoal/50">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo" />
                  <strong>{a.author_name}</strong> ({a.author_role})
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(a.created_at).toLocaleDateString([], { dateStyle: 'long' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Prayer Requests Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prayers.map((p) => {
            const isAnswered = p.status === "answered";
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl p-5 border shadow-2xs flex flex-col justify-between ${
                  isAnswered ? "border-sage-300 bg-sage-50/20" : "border-indigo-100/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAnswered ? "bg-sage-100 text-sage-900 border border-sage-200" : "bg-amber-100 text-amber-900"
                    }`}>
                      {isAnswered ? "✨ Answered Prayer" : "🙏 Open Request"}
                    </span>
                    <span className="text-[10px] text-charcoal/50">
                      {p.ministry_name || "Church-Wide"}
                    </span>
                  </div>

                  <p className="text-xs text-charcoal/80 italic leading-relaxed my-2 font-serif text-sm">
                    "{p.request_text}"
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-charcoal/60 font-medium">
                    From: <strong>{p.submitter_name || "Church Family"}</strong>
                  </span>
                  <button
                    onClick={() => handleTogglePrayerStatus(p.id, p.status)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                      isAnswered
                        ? "bg-gray-100 hover:bg-gray-200 text-charcoal"
                        : "bg-sage hover:bg-sage-600 text-white shadow-2xs"
                    }`}
                  >
                    {isAnswered ? "Mark as Open" : "Mark as Answered"}
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo" />
                <span>Post Ministry Announcement</span>
              </h2>
              <button onClick={() => setIsAnnounceModalOpen(false)} className="p-1 text-charcoal/50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Youth Camp 2026 Live"
                  value={announceForm.title}
                  onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Ministry Audience</label>
                <select
                  value={announceForm.ministry_id}
                  onChange={(e) => setAnnounceForm({ ...announceForm, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo disabled:opacity-90 disabled:cursor-not-allowed"
                >
                  {!isRestricted && <option value="">Church-Wide (All Members)</option>}
                  {allowedMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Announcement Body *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write the update details..."
                  value={announceForm.body}
                  onChange={(e) => setAnnounceForm({ ...announceForm, body: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={announceForm.is_pinned}
                  onChange={(e) => setAnnounceForm({ ...announceForm, is_pinned: e.target.checked })}
                  className="rounded text-indigo"
                />
                <label htmlFor="pinCheck" className="font-semibold text-charcoal/80 cursor-pointer">
                  Pin to top of communications board
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnounceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose" />
                <span>Submit Prayer Request</span>
              </h2>
              <button onClick={() => setIsPrayerModalOpen(false)} className="p-1 text-charcoal/50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPrayer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Your Prayer Petition *</label>
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
                      className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo hover:bg-indigo-100 font-bold transition-colors"
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
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Ministry Fellowship Scope</label>
                <select
                  value={prayerForm.ministry_id}
                  onChange={(e) => setPrayerForm({ ...prayerForm, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo disabled:opacity-90 disabled:cursor-not-allowed"
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
                  className="rounded text-indigo"
                />
                <label htmlFor="anonCheck" className="font-semibold text-charcoal/80 cursor-pointer">
                  Submit anonymously (Name hidden from public view)
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrayerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sage hover:bg-sage-600 text-white font-bold shadow-md"
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
