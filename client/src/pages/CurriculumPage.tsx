import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { StudyTopic, StudyTopicsSummary, BibleStudyGroup, Ministry } from "../types";
import {
  Library, BookOpen, BookMarked, Award, CheckCheck, CheckCircle2,
  Plus, Edit2, Trash2, Search, Filter, Sparkles, Calendar,
  Clock, Check, X, GraduationCap, ChevronRight, BookmarkCheck,
  Building2, Users, FileText, AlertCircle, RefreshCw
} from "lucide-react";

export const CurriculumPage: React.FC = () => {
  const { user, ministries } = useAuth();
  const [loading, setLoading] = useState(false);
  const [studyTopicsSummary, setStudyTopicsSummary] = useState<StudyTopicsSummary | null>(null);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [allGroups, setAllGroups] = useState<BibleStudyGroup[]>([]);
  const [groupsList, setGroupsList] = useState<{ id: number; name: string }[]>([]);

  // Filters & Search
  const [studyTopicFilter, setStudyTopicFilter] = useState<"all" | "completed" | "in_progress" | "planned">("all");
  const [studyTopicSearch, setStudyTopicSearch] = useState("");

  // Modals & Details View
  const [selectedDetailTopic, setSelectedDetailTopic] = useState<StudyTopic | null>(null);
  const [detailGroupTab, setDetailGroupTab] = useState<"all" | "completed" | "ongoing">("all");
  const [isStudyTopicModalOpen, setIsStudyTopicModalOpen] = useState(false);
  const [editingStudyTopic, setEditingStudyTopic] = useState<StudyTopic | null>(null);
  const [isCompletedBooksModalOpen, setIsCompletedBooksModalOpen] = useState(false);
  const [deleteConfirmTopic, setDeleteConfirmTopic] = useState<StudyTopic | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    type: "book" as "book" | "topical" | "doctrinal" | "character",
    testament_or_category: "New Testament",
    total_chapters: 1,
    completed_chapters: 0,
    status: "in_progress" as "in_progress" | "completed" | "planned",
    completed_date: "",
    assigned_group_id: "" as number | string,
    assigned_ministry_id: "" as number | string,
    lead_teacher: "",
    key_verse: "",
    summary_notes: ""
  });

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studyRes, groupsRes] = await Promise.all([
        api.getStudyTopics(),
        api.getGroups().catch(() => [])
      ]);
      setStudyTopicsSummary(studyRes);
      setStudyTopics(studyRes.topics || []);
      setAllGroups(groupsRes);
      setGroupsList(groupsRes.map(g => ({ id: g.id, name: g.name })));
    } catch (err: any) {
      console.error("Failed to load curriculum data:", err);
      showToast(err.message || "Failed to load curriculum data", "error");
    } finally {
      setLoading(false);
    }
  };

  const getGroupsForTopic = (topic: StudyTopic) => {
    const topicTitleLower = (topic.title || "").toLowerCase();
    const words = topicTitleLower
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((w) => w.length > 3 && !["book", "study", "guide", "life", "test", "with", "from", "paul", "holy"].includes(w));

    const matchedGroups = allGroups.filter((g) => {
      if (topic.assigned_group_id && g.id === topic.assigned_group_id) return true;
      if (g.curriculum) {
        const currLower = g.curriculum.toLowerCase();
        if (currLower.includes(topicTitleLower) || topicTitleLower.includes(currLower)) return true;
        if (words.some((w) => currLower.includes(w))) return true;
      }
      return false;
    });

    const completedGroupIds = new Set<number>();
    const ongoingGroupIds = new Set<number>();

    studyTopics.forEach((t) => {
      const tLower = (t.title || "").toLowerCase();
      const isSameBook = t.id === topic.id || (words.length > 0 && words.some((w) => tLower.includes(w)));
      if (isSameBook && t.assigned_group_id) {
        if (t.status === "completed") {
          completedGroupIds.add(t.assigned_group_id);
        } else if (t.status === "in_progress") {
          ongoingGroupIds.add(t.assigned_group_id);
        }
      }
    });

    if (topic.assigned_group_id) {
      if (topic.status === "completed") {
        completedGroupIds.add(topic.assigned_group_id);
      } else if (topic.status === "in_progress") {
        ongoingGroupIds.add(topic.assigned_group_id);
      }
    }

    matchedGroups.forEach((g) => {
      if (!completedGroupIds.has(g.id) && !ongoingGroupIds.has(g.id)) {
        if (topic.status === "completed") {
          completedGroupIds.add(g.id);
        } else {
          ongoingGroupIds.add(g.id);
        }
      }
    });

    const completedGroups = allGroups.filter((g) => completedGroupIds.has(g.id));
    const ongoingGroups = allGroups.filter((g) => ongoingGroupIds.has(g.id));

    return { completedGroups, ongoingGroups, matchedGroups };
  };

  const handleOpenModal = (topic?: StudyTopic) => {
    if (topic) {
      setEditingStudyTopic(topic);
      setFormData({
        title: topic.title,
        type: topic.type,
        testament_or_category: topic.testament_or_category || "New Testament",
        total_chapters: topic.total_chapters || 1,
        completed_chapters: topic.completed_chapters || 0,
        status: topic.status,
        completed_date: topic.completed_date || "",
        assigned_group_id: topic.assigned_group_id || "",
        assigned_ministry_id: topic.assigned_ministry_id || "",
        lead_teacher: topic.lead_teacher || "",
        key_verse: topic.key_verse || "",
        summary_notes: topic.summary_notes || ""
      });
    } else {
      setEditingStudyTopic(null);
      setFormData({
        title: "",
        type: "book",
        testament_or_category: "New Testament",
        total_chapters: 1,
        completed_chapters: 0,
        status: "in_progress",
        completed_date: "",
        assigned_group_id: "",
        assigned_ministry_id: "",
        lead_teacher: "",
        key_verse: "",
        summary_notes: ""
      });
    }
    setIsStudyTopicModalOpen(true);
  };

  const handleSaveStudyTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.title.trim()) {
        showToast("Please enter a book or study title", "error");
        return;
      }

      const total = Number(formData.total_chapters) || 1;
      let completed = Number(formData.completed_chapters) || 0;
      let status = formData.status;
      let completedDate = formData.completed_date;

      if (status === "completed") {
        completed = total;
        if (!completedDate) {
          completedDate = new Date().toISOString().split("T")[0];
        }
      } else if (completed >= total && total > 0) {
        status = "completed";
        if (!completedDate) {
          completedDate = new Date().toISOString().split("T")[0];
        }
      }

      const payload = {
        title: formData.title.trim(),
        type: formData.type,
        testament_or_category: formData.testament_or_category,
        total_chapters: total,
        completed_chapters: completed,
        status,
        completed_date: status === "completed" ? completedDate : undefined,
        assigned_group_id: formData.assigned_group_id ? Number(formData.assigned_group_id) : undefined,
        assigned_ministry_id: formData.assigned_ministry_id ? Number(formData.assigned_ministry_id) : undefined,
        lead_teacher: formData.lead_teacher.trim() || undefined,
        key_verse: formData.key_verse.trim() || undefined,
        summary_notes: formData.summary_notes.trim() || undefined
      };

      if (editingStudyTopic) {
        await api.updateStudyTopic(editingStudyTopic.id, payload);
        showToast(`'${formData.title}' updated successfully!`);
      } else {
        await api.createStudyTopic(payload);
        showToast(`'${formData.title}' added to curriculum library!`);
      }

      setIsStudyTopicModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save study topic", "error");
    }
  };

  const handleToggleCompleted = async (topic: StudyTopic) => {
    try {
      const isCurrentlyCompleted = topic.status === "completed";
      const newStatus = isCurrentlyCompleted ? "in_progress" : "completed";
      const newCompletedChapters = isCurrentlyCompleted ? Math.max(0, topic.total_chapters - 1) : topic.total_chapters;
      const newCompletedDate = isCurrentlyCompleted ? null : new Date().toISOString().split("T")[0];

      await api.updateStudyTopic(topic.id, {
        status: newStatus,
        completed_chapters: newCompletedChapters,
        completed_date: newCompletedDate ?? undefined
      });

      showToast(
        isCurrentlyCompleted
          ? `Reopened '${topic.title}' as In Progress.`
          : `🎉 Glory to God! '${topic.title}' marked as Completed!`
      );
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update study status", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTopic) return;
    try {
      await api.deleteStudyTopic(deleteConfirmTopic.id);
      showToast(`'${deleteConfirmTopic.title}' removed from curriculum.`);
      setDeleteConfirmTopic(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete topic", "error");
    }
  };

  // Filtered Topics
  const filteredStudyTopics = useMemo(() => {
    return studyTopics.filter(topic => {
      const matchesFilter = studyTopicFilter === "all" || topic.status === studyTopicFilter;
      const q = studyTopicSearch.toLowerCase().trim();
      const matchesSearch = !q || (
        topic.title.toLowerCase().includes(q) ||
        (topic.testament_or_category && topic.testament_or_category.toLowerCase().includes(q)) ||
        (topic.lead_teacher && topic.lead_teacher.toLowerCase().includes(q)) ||
        (topic.key_verse && topic.key_verse.toLowerCase().includes(q)) ||
        (topic.summary_notes && topic.summary_notes.toLowerCase().includes(q))
      );
      return matchesFilter && matchesSearch;
    });
  }, [studyTopics, studyTopicFilter, studyTopicSearch]);

  const completedBooksList = useMemo(() => {
    return studyTopics.filter(t => t.status === "completed");
  }, [studyTopics]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-in slide-in-from-bottom-5 duration-200 ${
          toastMessage.type === "success" 
            ? "bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/20"
            : "bg-rose-900 text-white border-rose-700 shadow-rose-950/20"
        }`}>
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 lg:p-8 border border-indigo-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo text-xs font-bold uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5 text-indigo" />
            <span>Discipleship & Scripture Curriculum</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-indigo tracking-tight">
            Topics & Books of Study
          </h1>
          <p className="text-sm text-charcoal/70 max-w-2xl">
            Track books of the Bible studied across small groups, record chapter completion, manage curriculum topics, and view the archive of completed studies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => setIsCompletedBooksModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all shadow-2xs"
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>View Completed Books ({studyTopicsSummary?.completed_count || 0})</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-indigo hover:bg-indigo-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Book / Topic Study</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 text-charcoal hover:bg-indigo-50/50 hover:border-indigo-200 transition-all shadow-2xs"
            title="Refresh curriculum list"
          >
            <RefreshCw className={`w-4 h-4 text-indigo ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Library */}
        <div className="bg-white rounded-2xl p-5 border border-indigo-100/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo">
              <Library className="w-4 h-4 text-indigo shrink-0" />
              <span>Total Curriculum</span>
            </div>
            <div className="text-2xl font-black text-indigo tracking-tight">
              {studyTopicsSummary?.total_count || 0}
            </div>
            <p className="text-[11px] text-charcoal/60 font-medium">Total Books & Topics</p>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo rounded-2xl shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Completed Books */}
        <div 
          onClick={() => setIsCompletedBooksModalOpen(true)}
          className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 group"
        >
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 pr-2">
              <div className="flex items-center gap-1.5">
                <CheckCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Completed Books</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold">
                {studyTopicsSummary?.completion_rate || 0}%
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-900 tracking-tight flex items-baseline gap-1.5">
              <span>{studyTopicsSummary?.completed_count || 0}</span>
              <span className="text-xs text-emerald-700 font-semibold">
                / {studyTopicsSummary?.total_count || 0}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${studyTopicsSummary?.completion_rate || 0}%` }}
              />
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0 group-hover:scale-105 transition-transform">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* In Progress */}
        <div 
          onClick={() => setStudyTopicFilter(studyTopicFilter === "in_progress" ? "all" : "in_progress")}
          className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-between gap-3 ${
            studyTopicFilter === "in_progress" ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20" : "border-amber-200"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <BookMarked className="w-4 h-4 text-amber-700 shrink-0" />
              <span>In Active Study</span>
            </div>
            <div className="text-2xl font-black text-amber-900 tracking-tight">
              {studyTopicsSummary?.in_progress_count || 0}
            </div>
            <p className="text-[11px] text-amber-700 font-medium">Ongoing Small Groups</p>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-700 rounded-2xl shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
        </div>

        {/* Planned */}
        <div 
          onClick={() => setStudyTopicFilter(studyTopicFilter === "planned" ? "all" : "planned")}
          className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-between gap-3 ${
            studyTopicFilter === "planned" ? "border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/40" : "border-gray-200"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-charcoal/70">
              <Calendar className="w-4 h-4 text-charcoal/50 shrink-0" />
              <span>Planned Series</span>
            </div>
            <div className="text-2xl font-black text-charcoal tracking-tight">
              {studyTopicsSummary?.planned_count || 0}
            </div>
            <p className="text-[11px] text-charcoal/60 font-medium">Upcoming Curriculum</p>
          </div>
          <div className="p-3.5 bg-gray-100 text-charcoal/70 rounded-2xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-indigo-100/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Studies", count: studyTopics.length },
            { id: "completed", label: "✅ Completed Books", count: studyTopicsSummary?.completed_count || 0 },
            { id: "in_progress", label: "⏳ In Progress", count: studyTopicsSummary?.in_progress_count || 0 },
            { id: "planned", label: "🗓️ Planned", count: studyTopicsSummary?.planned_count || 0 }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStudyTopicFilter(filter.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                studyTopicFilter === filter.id
                  ? "bg-indigo text-white shadow-2xs"
                  : "bg-gray-100 text-charcoal/70 hover:bg-gray-200"
              }`}
            >
              <span>{filter.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                studyTopicFilter === filter.id ? "bg-white/20 text-white" : "bg-white text-charcoal/60"
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search book, teacher, verse..."
            value={studyTopicSearch}
            onChange={(e) => setStudyTopicSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50/50 text-xs focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
          />
        </div>
      </div>

      {/* Study Topics Cards Grid */}
      {filteredStudyTopics.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 space-y-3">
          <BookOpen className="w-10 h-10 text-charcoal/30 mx-auto" />
          <p className="text-sm font-bold text-charcoal/70">No book studies found matching your filter.</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 rounded-xl bg-indigo text-white text-xs font-bold"
          >
            + Add New Book Study
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudyTopics.map(topic => {
            const isCompleted = topic.status === "completed";
            const progressPercent = topic.total_chapters > 0 
              ? Math.min(100, Math.round((topic.completed_chapters / topic.total_chapters) * 100))
              : (isCompleted ? 100 : 0);

            const { completedGroups, ongoingGroups } = getGroupsForTopic(topic);

            return (
              <div
                key={topic.id}
                onClick={() => {
                  setSelectedDetailTopic(topic);
                  setDetailGroupTab("all");
                }}
                className={`rounded-2xl border p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4 hover:shadow-md hover:border-indigo-300 group ${
                  isCompleted
                    ? "bg-gradient-to-b from-emerald-50/40 to-white border-emerald-200 shadow-2xs"
                    : topic.status === "in_progress"
                    ? "bg-white border-amber-200 shadow-2xs"
                    : "bg-gray-50/40 border-gray-200 hover:bg-white"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo border border-indigo-100">
                      {topic.testament_or_category || (topic.type === "book" ? "Book of the Bible" : "Topic Study")}
                    </span>

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Completed</span>
                      </span>
                    ) : topic.status === "in_progress" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold shadow-2xs">
                        <BookMarked className="w-3.5 h-3.5 text-amber-700" />
                        <span>In Progress</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-charcoal/70 text-[10px] font-bold">
                        <Calendar className="w-3.5 h-3.5 text-charcoal/50" />
                        <span>Planned</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Notes */}
                  <div>
                    <h3 className="text-base font-black text-indigo tracking-tight leading-snug group-hover:text-indigo-900 transition-colors">
                      {topic.title}
                    </h3>
                    {topic.summary_notes && (
                      <p className="text-xs text-charcoal/70 line-clamp-2 mt-1 leading-relaxed">
                        {topic.summary_notes}
                      </p>
                    )}
                  </div>

                  {/* Key Verse banner if available */}
                  {topic.key_verse && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900 font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Key Verse: {topic.key_verse}</span>
                    </div>
                  )}

                  {/* Chapters Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-charcoal/60">Chapter Progress:</span>
                      <span className={isCompleted ? "text-emerald-700 font-black" : "text-indigo font-bold"}>
                        {topic.completed_chapters} / {topic.total_chapters} Chapters ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted ? "bg-emerald-600" : "bg-amber-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta: Leader, Group status chips */}
                  <div className="flex items-center justify-between text-[11px] text-charcoal/60 pt-2 border-t border-gray-100 flex-wrap gap-1">
                    <span>Teacher: <strong className="text-charcoal font-semibold">{topic.lead_teacher || "Pastor / Leader"}</strong></span>
                    {topic.completed_date && isCompleted ? (
                      <span className="text-emerald-700 font-bold">
                        Completed: {topic.completed_date}
                      </span>
                    ) : (
                      <span className="text-indigo font-medium">
                        {completedGroups.length > 0 && `✅ ${completedGroups.length} Done `}
                        {ongoingGroups.length > 0 && `⏳ ${ongoingGroups.length} Active`}
                      </span>
                    )}
                  </div>

                  {/* Click hint badge */}
                  <div className="flex items-center justify-between pt-1 text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800">
                    <span>👥 View Group Progress & Details</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCompleted(topic);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isCompleted
                        ? "bg-gray-100 text-charcoal/70 hover:bg-gray-200"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    }`}
                    title={isCompleted ? "Reopen study as In Progress" : "Mark as Completed"}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isCompleted ? "Reopen Study ↺" : "Mark as Completed 🎉"}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(topic);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/60 hover:text-indigo transition-colors"
                      title="Edit book details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTopic(topic);
                      }}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-charcoal/60 hover:text-rose-600 transition-colors"
                      title="Delete book study"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: STUDY BOOK DETAILS & GROUP PROGRESS */}
      {/* ==================================================== */}
      {selectedDetailTopic && (() => {
        const { completedGroups, ongoingGroups, matchedGroups } = getGroupsForTopic(selectedDetailTopic);
        const isCompleted = selectedDetailTopic.status === "completed";
        const progressPercent = selectedDetailTopic.total_chapters > 0 
          ? Math.min(100, Math.round((selectedDetailTopic.completed_chapters / selectedDetailTopic.total_chapters) * 100))
          : (isCompleted ? 100 : 0);

        const displayedGroups = detailGroupTab === "completed" 
          ? completedGroups 
          : detailGroupTab === "ongoing" 
          ? ongoingGroups 
          : (completedGroups.length > 0 || ongoingGroups.length > 0 ? [...completedGroups, ...ongoingGroups.filter(g => !completedGroups.some(cg => cg.id === g.id))] : matchedGroups);

        return (
          <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 lg:p-8 shadow-2xl border border-indigo-100 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo border border-indigo-100">
                      {selectedDetailTopic.testament_or_category || "Curriculum"}
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Completed Book Study</span>
                      </span>
                    ) : selectedDetailTopic.status === "in_progress" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                        <BookMarked className="w-3.5 h-3.5 text-amber-700" />
                        <span>In Active Study</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-charcoal/70 text-[10px] font-bold">
                        <Calendar className="w-3.5 h-3.5 text-charcoal/50" />
                        <span>Planned Series</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-black text-indigo tracking-tight">
                    {selectedDetailTopic.title}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedDetailTopic(null)}
                  className="p-2 rounded-full text-charcoal/40 hover:text-charcoal hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Book Info Summary Card */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-ivory-light/70 border border-amber-200/60">
                {selectedDetailTopic.key_verse && (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Key Scripture Verse</span>
                    </div>
                    <p className="text-xs text-charcoal/80 font-medium italic">
                      "{selectedDetailTopic.key_verse}"
                    </p>
                  </div>
                )}

                {selectedDetailTopic.summary_notes && (
                  <div>
                    <h4 className="text-xs font-bold text-charcoal/70 mb-1">Study Overview & Objectives:</h4>
                    <p className="text-xs text-charcoal/80 leading-relaxed bg-white p-3 rounded-xl border border-gray-100">
                      {selectedDetailTopic.summary_notes}
                    </p>
                  </div>
                )}

                {/* Progress & Teacher */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-charcoal/60">Chapter Progress:</span>
                      <span className={isCompleted ? "text-emerald-700 font-black" : "text-indigo font-bold"}>
                        {selectedDetailTopic.completed_chapters} / {selectedDetailTopic.total_chapters} ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted ? "bg-emerald-600" : "bg-amber-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs flex flex-col justify-center space-y-0.5">
                    <span className="text-charcoal/50 text-[11px]">Lead Teacher / Facilitator:</span>
                    <strong className="text-charcoal font-bold text-xs">
                      {selectedDetailTopic.lead_teacher || "Pastor / Small Group Leader"}
                    </strong>
                    {selectedDetailTopic.completed_date && isCompleted && (
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        Finished on {selectedDetailTopic.completed_date}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Group Participation & Progress Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
                  <div>
                    <h3 className="font-black text-sm text-charcoal flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo" />
                      <span>Small Groups Progress on this Book</span>
                    </h3>
                    <p className="text-[11px] text-charcoal/60">
                      Track which groups have completed or are actively studying this curriculum
                    </p>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1 shrink-0">
                    <button
                      onClick={() => setDetailGroupTab("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        detailGroupTab === "all" ? "bg-white text-indigo shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                      }`}
                    >
                      All ({completedGroups.length + ongoingGroups.length})
                    </button>
                    <button
                      onClick={() => setDetailGroupTab("completed")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        detailGroupTab === "completed" ? "bg-white text-emerald-700 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                      }`}
                    >
                      ✅ Done ({completedGroups.length})
                    </button>
                    <button
                      onClick={() => setDetailGroupTab("ongoing")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        detailGroupTab === "ongoing" ? "bg-white text-amber-700 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                      }`}
                    >
                      ⏳ Ongoing ({ongoingGroups.length})
                    </button>
                  </div>
                </div>

                {displayedGroups.length === 0 ? (
                  <div className="p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center space-y-2">
                    <BookOpen className="w-8 h-8 text-charcoal/30 mx-auto" />
                    <p className="text-xs font-bold text-charcoal/70">
                      {detailGroupTab === "completed"
                        ? "No small groups have completed this book study yet."
                        : detailGroupTab === "ongoing"
                        ? "No small groups are currently ongoing with this book."
                        : "No small groups currently assigned to this curriculum."}
                    </p>
                    <p className="text-[11px] text-charcoal/50">
                      You can assign this book when creating or editing small groups in the Bible Study tab.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                    {displayedGroups.map((grp) => {
                      const isGroupDone = completedGroups.some((cg) => cg.id === grp.id);

                      return (
                        <div
                          key={grp.id}
                          className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                            isGroupDone
                              ? "bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200"
                              : "bg-gradient-to-br from-amber-50/50 to-white border-amber-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo border border-indigo-100">
                                {grp.category || "LifeGroup"}
                              </span>
                              <h4 className="font-bold text-xs text-charcoal mt-1">
                                {grp.name}
                              </h4>
                            </div>

                            {isGroupDone ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold shrink-0">
                                <Clock className="w-3 h-3 text-amber-700" />
                                <span>Ongoing</span>
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 text-[11px] text-charcoal/70 pt-1 border-t border-gray-100/80">
                            <div className="flex items-center gap-1.5 text-charcoal font-medium">
                              <span>👤 Leader: <strong>{grp.leader_name}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-indigo shrink-0" />
                              <span>{grp.meeting_day}s at {grp.meeting_time}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <Building2 className="w-3 h-3 text-sage-600 shrink-0" />
                              <span className="truncate">{grp.location}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 text-[10px] font-semibold text-charcoal/60">
                            <span>👥 {grp.current_member_count || 0} Members</span>
                            <span className={isGroupDone ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                              {isGroupDone ? "Finished Curriculum" : "Actively Studying"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-2">
                <button
                  onClick={() => {
                    handleToggleCompleted(selectedDetailTopic);
                    setSelectedDetailTopic(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    isCompleted
                      ? "bg-gray-100 text-charcoal/70 hover:bg-gray-200"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isCompleted ? "Reopen Study ↺" : "Mark Book as Completed 🎉"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const topic = selectedDetailTopic;
                      setSelectedDetailTopic(null);
                      handleOpenModal(topic);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo font-bold text-xs transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Book</span>
                  </button>

                  <button
                    onClick={() => setSelectedDetailTopic(null)}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal font-bold text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================================================== */}
      {/* MODAL: COMPLETED BOOKS ARCHIVE */}
      {/* ==================================================== */}
      {isCompletedBooksModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 lg:p-8 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-charcoal">
                    Completed Books & Studies Archive
                  </h3>
                  <p className="text-xs text-charcoal/60">
                    Finished curriculum records, completion dates, teachers, and memory verses.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCompletedBooksModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Completed Books Count Summary */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <div className="text-xs font-bold text-emerald-900">Total Books Finished</div>
                  <div className="text-[11px] text-emerald-700">Finished across small groups & church classes</div>
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-900">
                {completedBooksList.length} Books
              </div>
            </div>

            {/* Completed Books List */}
            {completedBooksList.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <BookOpen className="w-8 h-8 text-charcoal/30 mx-auto" />
                <p className="text-xs font-bold text-charcoal/60">No completed books recorded yet.</p>
                <p className="text-[11px] text-charcoal/50">Mark studies as completed to view them in this archive.</p>
              </div>
            ) : (
              <div className="space-y-3 divide-y divide-gray-100">
                {completedBooksList.map(item => (
                  <div key={item.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-indigo">{item.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {item.total_chapters} Chapters
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-charcoal/70">
                            {item.testament_or_category}
                          </span>
                        </div>
                        {item.summary_notes && (
                          <p className="text-xs text-charcoal/70 mt-1 leading-relaxed">
                            {item.summary_notes}
                          </p>
                        )}
                      </div>

                      {item.completed_date && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold whitespace-nowrap shrink-0">
                          Finished: {item.completed_date}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-charcoal/60 pt-1">
                      <span>Teacher: <strong className="text-charcoal">{item.lead_teacher || "Pastor / Leader"}</strong></span>
                      {item.key_verse && (
                        <span className="text-amber-800 font-semibold italic text-[11px]">
                          "{item.key_verse}"
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setIsCompletedBooksModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs"
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD / EDIT STUDY TOPIC */}
      {/* ==================================================== */}
      {isStudyTopicModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-charcoal">
                    {editingStudyTopic ? "Edit Topic / Book of Study" : "Add Book / Topic Study"}
                  </h3>
                  <p className="text-[11px] text-charcoal/60">
                    Configure curriculum title, chapters, status, teacher, and scripture references.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudyTopicModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudyTopic} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Book / Study Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gospel of John, Romans, Discipleship 101..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                />
              </div>

              {/* Type and Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Study Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  >
                    <option value="book">Book of the Bible</option>
                    <option value="topical">Topical Series</option>
                    <option value="doctrinal">Doctrinal Study</option>
                    <option value="character">Character Study</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Testament / Category</label>
                  <input
                    type="text"
                    placeholder="e.g. New Testament, Foundations..."
                    value={formData.testament_or_category}
                    onChange={(e) => setFormData({ ...formData, testament_or_category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>
              </div>

              {/* Total Chapters and Completed Chapters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Total Chapters / Lessons</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.total_chapters}
                    onChange={(e) => setFormData({ ...formData, total_chapters: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Completed Chapters</label>
                  <input
                    type="number"
                    min="0"
                    max={formData.total_chapters}
                    value={formData.completed_chapters}
                    onChange={(e) => setFormData({ ...formData, completed_chapters: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-bold"
                  />
                </div>
              </div>

              {/* Status and Completion Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Curriculum Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-bold"
                  >
                    <option value="in_progress">⏳ In Progress</option>
                    <option value="completed">✅ Completed</option>
                    <option value="planned">🗓️ Planned</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Completion Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.completed_date}
                    onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>
              </div>

              {/* Lead Teacher & Key Verse */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Lead Teacher / Facilitator</label>
                  <input
                    type="text"
                    placeholder="e.g. Pastor David, Elder Arthur..."
                    value={formData.lead_teacher}
                    onChange={(e) => setFormData({ ...formData, lead_teacher: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Key Scripture Verse</label>
                  <input
                    type="text"
                    placeholder="e.g. John 3:16, Romans 8:28..."
                    value={formData.key_verse}
                    onChange={(e) => setFormData({ ...formData, key_verse: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>
              </div>

              {/* Assigned Small Group */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Assigned Small Group (Optional)</label>
                <select
                  value={formData.assigned_group_id}
                  onChange={(e) => setFormData({ ...formData, assigned_group_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                >
                  <option value="">-- General Church Curriculum --</option>
                  {groupsList.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Summary Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Summary Notes / Objectives</label>
                <textarea
                  rows={2}
                  placeholder="Key themes, outline, study guides or reflections..."
                  value={formData.summary_notes}
                  onChange={(e) => setFormData({ ...formData, summary_notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsStudyTopicModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs"
                >
                  {editingStudyTopic ? "Save Changes" : "Add to Curriculum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ==================================================== */}
      {deleteConfirmTopic && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-charcoal">Delete Book Study?</h3>
              <p className="text-xs text-charcoal/60 mt-1">
                Are you sure you want to remove <strong>{deleteConfirmTopic.title}</strong> from the curriculum library?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTopic(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/70 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold transition-all shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
