import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { StudyTopic, StudyTopicsSummary, StudyTopicDetailResponse, BibleStudyGroup, Ministry } from "../types";
import {
  Library, BookOpen, BookMarked, Award, CheckCheck, CheckCircle2,
  Plus, Edit2, Trash2, Search, Filter, Sparkles, Calendar,
  Clock, Check, X, GraduationCap, ChevronRight, BookmarkCheck,
  Building2, Users, FileText, AlertCircle, RefreshCw, Phone, Mail,
  MapPin, UserCheck, Loader2, PanelRightClose, PanelRight, ExternalLink
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
  const [topicDetailData, setTopicDetailData] = useState<StudyTopicDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
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

      // Auto-load details for first topic into right container
      if (studyRes.topics && studyRes.topics.length > 0) {
        handleOpenDetailModal(studyRes.topics[0]);
      }
    } catch (err: any) {
      console.error("Failed to load curriculum data:", err);
      showToast(err.message || "Failed to load curriculum data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetailModal = async (topic: StudyTopic) => {
    setSelectedDetailTopic(topic);
    setTopicDetailData(null);
    setDetailGroupTab("all");
    setLoadingDetail(true);
    try {
      const res = await api.getStudyTopic(topic.id);
      setTopicDetailData(res);
      if (res.topic) {
        setSelectedDetailTopic(res.topic);
      }
    } catch (err: any) {
      console.error("Failed to load topic details:", err);
      showToast(err.message || "Failed to fetch topic details", "error");
    } finally {
      setLoadingDetail(false);
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
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-in slide-in-from-bottom-5 duration-200 ${toastMessage.type === "success"
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
      <div className="relative overflow-hidden bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <BookMarked className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
              Topics & Books of Study
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/80 text-xs font-black uppercase tracking-wider shadow-2xs">
              Discipleship & Scripture Curriculum
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed">
            Track books of the Bible studied across small groups, record chapter completion, manage curriculum topics, and view the archive of completed studies.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          <button
            onClick={() => setIsCompletedBooksModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300/80 text-xs font-black transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
          >
            <Award className="w-4 h-4 text-emerald-700" />
            <span>View Completed Books ({studyTopicsSummary?.completed_count || 0})</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-950" />
            <span>Add Book / Topic Study</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-indigo-100 bg-white text-charcoal hover:bg-indigo-50/60 transition-all shadow-2xs cursor-pointer"
            title="Refresh curriculum list"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-700 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Library */}
        <div className="bg-white/95 rounded-3xl p-5 border border-indigo-100/90 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
              <Library className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>Total Curriculum</span>
            </div>
            <div className="text-2xl font-black text-charcoal tracking-tight">
              {studyTopicsSummary?.total_count || 0}
            </div>
            <p className="text-[11px] text-charcoal/60 font-medium">Total Books & Topics</p>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo-700 rounded-2xl shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Completed Books */}
        <div
          onClick={() => setIsCompletedBooksModalOpen(true)}
          className="bg-white/95 rounded-3xl p-5 border border-emerald-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
        >
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-black text-emerald-950 pr-2">
              <div className="flex items-center gap-1.5">
                <CheckCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Completed Books</span>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black shadow-2xs">
                {studyTopicsSummary?.completion_rate || 0}%
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-950 tracking-tight flex items-baseline gap-1.5">
              <span>{studyTopicsSummary?.completed_count || 0}</span>
              <span className="text-xs text-emerald-700 font-bold">
                / {studyTopicsSummary?.total_count || 0}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden mt-1.5">
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
          className={`bg-white/95 rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${studyTopicFilter === "in_progress" ? "border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/20" : "border-amber-200/80"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
              <BookMarked className="w-4 h-4 text-amber-700 shrink-0" />
              <span>In Active Study</span>
            </div>
            <div className="text-2xl font-black text-charcoal tracking-tight">
              {studyTopicsSummary?.in_progress_count || 0}
            </div>
            <p className="text-[11px] text-amber-800 font-medium">Ongoing Small Groups</p>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-700 rounded-2xl shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
        </div>

        {/* Planned */}
        <div
          onClick={() => setStudyTopicFilter(studyTopicFilter === "planned" ? "all" : "planned")}
          className={`bg-white/95 rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${studyTopicFilter === "planned" ? "border-indigo-400 ring-2 ring-indigo-400/20 bg-indigo-50/30" : "border-indigo-100/90"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-black text-charcoal/80">
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

      {/* Filter and Search Bar with Layout Mode & Inspector Toggle */}
      <div className="bg-white/95 rounded-3xl p-4 sm:p-5 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          {[
            { id: "all", label: "All Studies", count: studyTopics.length },
            { id: "completed", label: "Completed Books", count: studyTopicsSummary?.completed_count || 0 },
            { id: "in_progress", label: "In Progress", count: studyTopicsSummary?.in_progress_count || 0 },
            { id: "planned", label: "Planned", count: studyTopicsSummary?.planned_count || 0 }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStudyTopicFilter(filter.id as any)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${studyTopicFilter === filter.id
                  ? "bg-indigo-900 text-white shadow-sm ring-2 ring-indigo-900/20"
                  : "bg-gray-100/80 text-charcoal/70 hover:bg-gray-200/70 hover:text-charcoal"
                }`}
            >
              <span>{filter.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${studyTopicFilter === filter.id ? "bg-white/20 text-white" : "bg-white text-charcoal/70 shadow-2xs"
                }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar & Inspector Toggle */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search book, teacher, verse..."
              value={studyTopicSearch}
              onChange={(e) => setStudyTopicSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-indigo-100/90 bg-ivory-light text-xs focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium placeholder:text-charcoal/40 transition-all"
            />
          </div>

          {selectedDetailTopic && (
            <button
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-black transition-all cursor-pointer whitespace-nowrap ${isInspectorOpen
                  ? "bg-indigo-50 text-indigo-950 border-indigo-200 shadow-2xs hover:bg-indigo-100/70"
                  : "bg-white text-charcoal/70 border-gray-200 hover:bg-gray-50"
                }`}
              title={isInspectorOpen ? "Close Side Inspector" : "Open Side Inspector"}
            >
              {isInspectorOpen ? <PanelRightClose className="w-4 h-4 text-indigo-700" /> : <PanelRight className="w-4 h-4 text-charcoal/50" />}
              <span className="hidden sm:inline">{isInspectorOpen ? "Hide Inspector" : "Show Inspector"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout: Responsive Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Study Topics Cards */}
        <div className={selectedDetailTopic && isInspectorOpen ? "lg:col-span-7 2xl:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
          {filteredStudyTopics.length === 0 ? (
            <div className="text-center py-16 bg-white/95 rounded-3xl border border-dashed border-indigo-200/80 space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-black text-charcoal">No curriculum studies found</p>
                <p className="text-xs text-charcoal/60 max-w-sm mx-auto">No study materials match your current search or status filter.</p>
              </div>
              <button
                onClick={() => handleOpenModal()}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 text-xs font-black shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
              >
                + Add New Book Study
              </button>
            </div>
          ) : (
            <div className={`grid gap-5 ${selectedDetailTopic && isInspectorOpen
                ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              }`}>
              {filteredStudyTopics.map(topic => {
                const isSelected = selectedDetailTopic?.id === topic.id;
                const isCompleted = topic.status === "completed";
                const progressPercent = topic.total_chapters > 0
                  ? Math.min(100, Math.round((topic.completed_chapters / topic.total_chapters) * 100))
                  : (isCompleted ? 100 : 0);

                const { completedGroups, ongoingGroups } = getGroupsForTopic(topic);

                return (
                  <div
                    key={topic.id}
                    onClick={() => {
                      handleOpenDetailModal(topic);
                      setIsInspectorOpen(true);
                    }}
                    className={`group relative rounded-3xl border p-5 sm:p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 ${isSelected
                        ? "bg-gradient-to-b from-indigo-50/60 via-white to-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-md scale-[1.01]"
                        : isCompleted
                          ? "bg-white/95 border-emerald-200/80 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-950/5"
                          : topic.status === "in_progress"
                            ? "bg-white/95 border-amber-200/80 hover:border-amber-400 hover:shadow-md hover:shadow-amber-950/5"
                            : "bg-white/90 border-indigo-100/90 hover:border-indigo-300 hover:shadow-md"
                      }`}
                  >
                    {/* Top Status & Category Badges */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-950 border border-indigo-200/70 shadow-2xs">
                          {topic.testament_or_category || (topic.type === "book" ? "Scripture Study" : "Topic Study")}
                        </span>

                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-black shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Completed</span>
                          </span>
                        ) : topic.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>In Progress</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-charcoal/70 text-[10px] font-black">
                            <Calendar className="w-3.5 h-3.5 text-charcoal/40" />
                            <span>Planned</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Notes */}
                      <div>
                        <h3 className={`text-base sm:text-lg font-black tracking-tight leading-snug transition-colors ${isSelected ? "text-indigo-950" : "text-charcoal group-hover:text-indigo-900"
                          }`}>
                          {topic.title}
                        </h3>
                        {topic.summary_notes && (
                          <p className="text-xs text-charcoal/65 line-clamp-2 mt-1.5 leading-relaxed font-normal">
                            {topic.summary_notes}
                          </p>
                        )}
                      </div>

                      {/* Scripture Callout Ribbon */}
                      {topic.key_verse && (
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-950 font-bold truncate shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate font-serif italic">{topic.key_verse}</span>
                        </div>
                      )}

                      {/* Chapters Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-black">
                          <span className="text-charcoal/50 text-[11px]">Progress:</span>
                          <span className={isCompleted ? "text-emerald-700 font-black" : "text-indigo-950 font-black"}>
                            {topic.completed_chapters} / {topic.total_chapters} Chapters ({progressPercent}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-600" : "bg-gradient-to-r from-amber-400 to-amber-500"
                              }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Facilitator & Small Groups Footer */}
                      <div className="flex items-center justify-between text-xs text-charcoal/70 pt-3 border-t border-gray-100 flex-wrap gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-900 font-black text-[9px] flex items-center justify-center shrink-0">
                            {(topic.lead_teacher || "P")[0]}
                          </div>
                          <span className="truncate text-charcoal font-bold text-xs">
                            {topic.lead_teacher || "Pastor / Leader"}
                          </span>
                        </div>

                        {topic.completed_date && isCompleted ? (
                          <span className="text-emerald-700 font-black text-[11px] bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                            {topic.completed_date}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {completedGroups.length > 0 && (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                {completedGroups.length} Done
                              </span>
                            )}
                            {ongoingGroups.length > 0 && (
                              <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md">
                                {ongoingGroups.length} Active
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Select & View Action Tag */}
                      <div className={`flex items-center justify-between pt-1 text-xs font-black transition-colors ${isSelected ? "text-indigo-700" : "text-indigo-900/80 group-hover:text-indigo-900"
                        }`}>
                        <span>{isSelected ? "✨ Currently Inspected" : "🔍 View Study Details & Roster"}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "translate-x-1" : "group-hover:translate-x-1"}`} />
                      </div>
                    </div>

                    {/* Quick Card Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCompleted(topic);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${isCompleted
                            ? "bg-gray-100 text-charcoal/80 hover:bg-gray-200"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95"
                          }`}
                        title={isCompleted ? "Reopen study as In Progress" : "Mark as Completed"}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isCompleted ? "Reopen Study" : "Mark Done"}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(topic);
                          }}
                          className="p-2 hover:bg-indigo-50 rounded-xl text-charcoal/50 hover:text-indigo-700 transition-colors cursor-pointer"
                          title="Edit study"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmTopic(topic);
                          }}
                          className="p-2 hover:bg-rose-50 rounded-xl text-charcoal/50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete study"
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
        </div>

        {/* Right Side: Responsive Master Inspector (Sticky Dock on Desktop, Slide-over Drawer on Tablet/Mobile) */}
        {selectedDetailTopic && isInspectorOpen && (() => {
          const topicData = topicDetailData?.topic || selectedDetailTopic;
          const groupMembers = topicDetailData?.group_members || [];
          const { completedGroups, ongoingGroups, matchedGroups } = getGroupsForTopic(topicData);
          const isCompleted = topicData.status === "completed";
          const progressPercent = topicData.total_chapters > 0
            ? Math.min(100, Math.round((topicData.completed_chapters / topicData.total_chapters) * 100))
            : (isCompleted ? 100 : 0);

          const displayedGroups = detailGroupTab === "completed"
            ? completedGroups
            : detailGroupTab === "ongoing"
              ? ongoingGroups
              : (completedGroups.length > 0 || ongoingGroups.length > 0 ? [...completedGroups, ...ongoingGroups.filter(g => !completedGroups.some(cg => cg.id === g.id))] : matchedGroups);

          return (
            <>
              {/* Backdrop for smaller screens (< lg) */}
              <div
                onClick={() => setIsInspectorOpen(false)}
                className="lg:hidden fixed inset-0 z-40 bg-indigo-950/60 backdrop-blur-xs animate-in fade-in duration-200"
              />

              {/* Inspector Container */}
              <div className="lg:col-span-5 2xl:col-span-4 lg:sticky lg:top-6 fixed inset-y-0 right-0 z-50 lg:z-auto w-full max-w-md lg:max-w-none bg-white lg:bg-transparent shadow-2xl lg:shadow-none p-4 sm:p-6 lg:p-0 overflow-y-auto animate-in slide-in-from-right duration-200">
                <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-indigo-100/90 shadow-sm space-y-5">
                  {/* Inspector Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-gray-100 gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-950 border border-indigo-200/70 shadow-2xs">
                          {topicData.testament_or_category || (topicData.type === "book" ? "Book of the Bible" : "Curriculum")}
                        </span>

                        {topicData.ministry_name && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow-2xs"
                            style={{ backgroundColor: topicData.ministry_color || "#2C3968" }}
                          >
                            {topicData.ministry_name}
                          </span>
                        )}

                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200 text-[10px] font-black shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Completed</span>
                          </span>
                        ) : topicData.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-200 text-[10px] font-black shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>In Progress</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-charcoal/70 text-[10px] font-black">
                            <Calendar className="w-3.5 h-3.5 text-charcoal/40" />
                            <span>Planned</span>
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-black text-indigo-950 tracking-tight leading-snug">
                        {topicData.title}
                      </h2>
                    </div>

                    <button
                      onClick={() => setIsInspectorOpen(false)}
                      className="p-2 rounded-2xl text-charcoal/40 hover:text-charcoal hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      title="Close Inspector"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Live sync loader */}
                  {loadingDetail && (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-bold animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Syncing study metadata & members...</span>
                    </div>
                  )}

                  {/* Illuminated Scripture Ribbon */}
                  {topicData.key_verse && (
                    <div className="p-4 bg-gradient-to-r from-amber-50/95 via-amber-100/40 to-amber-50/60 rounded-2xl border-l-4 border-amber-500 shadow-2xs space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Key Scripture Focus</span>
                      </div>
                      <p className="text-sm text-amber-950 font-serif italic leading-relaxed">
                        "{topicData.key_verse}"
                      </p>
                    </div>
                  )}

                  {/* Overview & Theological Notes */}
                  {topicData.summary_notes && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-black text-charcoal/70">Overview & Study Notes:</h4>
                      <p className="text-xs text-charcoal/80 leading-relaxed bg-gray-50/90 p-3.5 rounded-2xl border border-gray-100">
                        {topicData.summary_notes}
                      </p>
                    </div>
                  )}

                  {/* Chapter Progress & Facilitator Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Chapter Progress Box */}
                    <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-charcoal/60">Chapter Progress:</span>
                        <span className={isCompleted ? "text-emerald-700 font-black" : "text-indigo-950 font-bold"}>
                          {topicData.completed_chapters}/{topicData.total_chapters} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-600" : "bg-gradient-to-r from-amber-400 to-amber-500"
                            }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Teacher Box */}
                    <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 text-xs flex flex-col justify-center space-y-1 shadow-2xs">
                      <span className="text-charcoal/50 text-[11px] font-semibold">Teacher / Facilitator:</span>
                      <strong className="text-charcoal font-black text-xs truncate">
                        {topicData.lead_teacher || topicData.leader_name || "Pastor / Leader"}
                      </strong>
                      {topicData.completed_date && isCompleted && (
                        <span className="text-[10px] text-emerald-700 font-bold">
                          Finished on {topicData.completed_date}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assigned Small Group Details */}
                  <div className="space-y-2 p-4 bg-gray-50/80 rounded-2xl border border-gray-100 text-xs">
                    <div className="flex items-center justify-between font-black text-charcoal">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-700" />
                        <span>{topicData.group_name || "General Church Curriculum"}</span>
                      </div>
                      {topicData.meeting_day && (
                        <span className="text-[11px] text-amber-800 font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          {topicData.meeting_day}s {topicData.meeting_time}
                        </span>
                      )}
                    </div>
                    {topicData.leader_email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-indigo-800 font-medium">
                        <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{topicData.leader_email}</span>
                      </div>
                    )}
                    {topicData.current_location && (
                      <div className="flex items-center gap-1.5 text-[11px] text-charcoal/70">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{topicData.current_location}</span>
                      </div>
                    )}
                  </div>

                  {/* Enrolled Group Members */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-xs text-charcoal flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                        <span>Enrolled Group Members ({groupMembers.length})</span>
                      </h4>
                    </div>

                    {groupMembers.length === 0 ? (
                      <p className="text-[11px] text-charcoal/50 italic p-3.5 bg-gray-50/80 rounded-2xl text-center border border-dashed border-gray-200">
                        No active members registered in this group yet.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 no-scrollbar">
                        {groupMembers.map((m) => (
                          <div
                            key={m.id || m.member_id}
                            className="p-2.5 bg-white rounded-2xl border border-gray-100 flex items-center justify-between gap-2 shadow-2xs hover:border-indigo-200 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-100 flex items-center justify-center font-black text-[10px] shrink-0">
                                {m.first_name?.[0]}{m.last_name?.[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-charcoal truncate">
                                  {m.first_name} {m.last_name}
                                </div>
                                <div className="text-[10px] text-charcoal/60 truncate">
                                  {m.member_ministry_name || m.gender || "Member"}
                                </div>
                              </div>
                            </div>
                            {m.contact_phone && (
                              <span className="text-[10px] font-semibold text-charcoal/60 shrink-0 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-amber-600" />
                                {m.contact_phone}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Groups Progress Tabs */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-black text-xs text-charcoal flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Groups on this Study</span>
                      </h4>

                      <div className="flex items-center bg-gray-100 p-0.5 rounded-xl gap-0.5 shrink-0">
                        <button
                          onClick={() => setDetailGroupTab("all")}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${detailGroupTab === "all" ? "bg-white text-indigo-900 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                            }`}
                        >
                          All ({completedGroups.length + ongoingGroups.length})
                        </button>
                        <button
                          onClick={() => setDetailGroupTab("completed")}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${detailGroupTab === "completed" ? "bg-white text-emerald-800 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                            }`}
                        >
                          Done ({completedGroups.length})
                        </button>
                        <button
                          onClick={() => setDetailGroupTab("ongoing")}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${detailGroupTab === "ongoing" ? "bg-white text-amber-800 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                            }`}
                        >
                          Active ({ongoingGroups.length})
                        </button>
                      </div>
                    </div>

                    {displayedGroups.length === 0 ? (
                      <p className="text-[11px] text-charcoal/50 italic p-3.5 bg-gray-50/80 rounded-2xl text-center border border-dashed border-gray-200">
                        No small groups recorded for this study category yet.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                        {displayedGroups.map((grp) => {
                          const isGroupDone = completedGroups.some((cg) => cg.id === grp.id);

                          return (
                            <div
                              key={grp.id}
                              className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${isGroupDone
                                  ? "bg-emerald-50/50 border-emerald-200"
                                  : "bg-amber-50/50 border-amber-200"
                                }`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-charcoal truncate">{grp.name}</div>
                                <div className="text-[10px] text-charcoal/60 truncate">
                                  Leader: {grp.leader_name} • {grp.meeting_day}s
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${isGroupDone ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                {isGroupDone ? "Done" : "Ongoing"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Primary & Secondary Inspector Action Buttons */}
                  <div className="flex items-center justify-between pt-3.5 border-t border-gray-100 flex-wrap gap-2">
                    <button
                      onClick={() => handleToggleCompleted(topicData)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-xs cursor-pointer ${isCompleted
                          ? "bg-gray-100 text-charcoal/80 hover:bg-gray-200"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                        }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isCompleted ? "Reopen Study" : "Mark Completed"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(topicData)}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-black text-xs transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTopic(topicData)}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

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
                  <div 
                    key={item.id} 
                    onClick={() => {
                      setIsCompletedBooksModalOpen(false);
                      handleOpenDetailModal(item);
                    }}
                    className="pt-3 first:pt-0 space-y-2 p-3 rounded-2xl hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-indigo-950 group-hover:text-indigo-800">{item.title}</span>
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
