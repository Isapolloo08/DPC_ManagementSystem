import { ViewportOverlay } from "../components/common/ViewportOverlay";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { StudyTopic, StudyTopicsSummary, StudyTopicDetailResponse, BibleStudyGroup } from "../types";
import {
  Library, BookOpen, BookMarked, Award, CheckCircle2,
  Plus, Edit2, Trash2, Search,
  Clock, X, ChevronRight,
  Users, AlertCircle, RefreshCw,
  MapPin, Loader2, PanelRightClose, PanelRight,
  GitMerge, Archive
} from "lucide-react";
import { useSocketEvent } from "../socket";
import { CurriculumPageSkeleton, CardGridSkeleton } from "../components/common/SkeletonLoader";

export const CurriculumPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "Leader" || user?.role_name === "IT Admin";
  const { showToast, deleteWithUndo } = useToast();
  const [loading, setLoading] = useState(true);
  const [studyTopicsSummary, setStudyTopicsSummary] = useState<StudyTopicsSummary | null>(null);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [allGroups, setAllGroups] = useState<BibleStudyGroup[]>([]);

  // Filters & Search
  const [studyTopicSearch, setStudyTopicSearch] = useState("");

  // Modals & Details View
  const [selectedDetailTopic, setSelectedDetailTopic] = useState<StudyTopic | null>(null);
  const [topicDetailData, setTopicDetailData] = useState<StudyTopicDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [detailGroupTab, setDetailGroupTab] = useState<"all" | "completed" | "ongoing" | "merged">("all");
  const [isStudyTopicModalOpen, setIsStudyTopicModalOpen] = useState(false);
  const [editingStudyTopic, setEditingStudyTopic] = useState<StudyTopic | null>(null);
  const [deleteConfirmTopic, setDeleteConfirmTopic] = useState<StudyTopic | null>(null);

  // Clean, focused Form State (Book Title, Total Chapters, Summary Notes)
  const [formData, setFormData] = useState({
    title: "",
    total_chapters: 1,
    summary_notes: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  // Real-time automatic sync via Socket.IO
  useSocketEvent("study_topics:changed", () => {
    loadData();
  });
  useSocketEvent("groups:changed", () => {
    loadData();
  });

 const loadData = async () => {
    guideData.clearError();
    setLoading(true);
    try {
      const [studyRes, groupsRes] = await Promise.all([
        api.getStudyTopics(),
        api.getGroups().catch(() => [])
      ]);
      setStudyTopicsSummary(studyRes);
      setStudyTopics(studyRes.topics || []);
      setAllGroups(groupsRes);

      // Auto-load details for first topic into right container if none selected
      if (studyRes.topics && studyRes.topics.length > 0 && !selectedDetailTopic) {
        handleOpenDetailModal(studyRes.topics[0]);
      } else if (selectedDetailTopic) {
        const updated = (studyRes.topics || []).find(t => t.id === selectedDetailTopic.id);
        if (updated) {
          setSelectedDetailTopic(updated);
        }
      }
    } catch (err: any) {
      console.error("Failed to load curriculum data:", err);
      guideData.reportError(err);
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

  // Cross-match small groups studying this book / topic
  const getGroupsForTopic = (topic: StudyTopic) => {
    const topicTitleLower = (topic.title || "").toLowerCase().trim();
    const words = topicTitleLower
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !["book", "study", "guide", "life", "test", "with", "from", "paul", "holy"].includes(w));

    const matchedGroups = allGroups.filter((g) => {
      if (g.curriculum) {
        const currLower = g.curriculum.toLowerCase().trim();
        if (currLower === topicTitleLower || currLower.includes(topicTitleLower) || topicTitleLower.includes(currLower)) return true;
        if (words.length > 0 && words.some((w) => currLower.includes(w))) return true;
      }
      return false;
    });

    const activeGroups = matchedGroups.filter(g => (g.status || "active") !== "merged");
    const mergedGroups = matchedGroups.filter(g => g.status === "merged");

    const completedGroups = activeGroups.filter(g => g.progress_stage === "completed");
    const ongoingGroups = activeGroups.filter(g => g.progress_stage !== "completed");

    return { activeGroups, completedGroups, ongoingGroups, mergedGroups, matchedGroups };
  };

  const handleOpenModal = (topic?: StudyTopic) => {
    if (topic) {
      setEditingStudyTopic(topic);
      setFormData({
        title: topic.title,
        total_chapters: topic.total_chapters || 1,
        summary_notes: topic.summary_notes || ""
      });
    } else {
      setEditingStudyTopic(null);
      setFormData({
        title: "",
        total_chapters: 1,
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

      const dup = studyTopics.find(t =>
        t.title.toLowerCase().trim() === formData.title.toLowerCase().trim() &&
        t.id !== editingStudyTopic?.id
      );
      if (dup) {
        showToast("A curriculum topic with this title already exists", "error");
        return;
      }

      const total = Number(formData.total_chapters);
      if (isNaN(total) || total < 1) {
        showToast("Total chapters must be at least 1", "error");
        return;
      }

      const payload = {
        title: formData.title.trim(),
        total_chapters: total,
        summary_notes: formData.summary_notes.trim() || undefined
      };

      if (editingStudyTopic) {
        await api.updateStudyTopic(editingStudyTopic.id, payload);
        showToast(`'${formData.title.trim()}' updated successfully!`);
      } else {
        await api.createStudyTopic(payload);
        showToast(`'${formData.title.trim()}' added to curriculum library!`);
      }

      setIsStudyTopicModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save study topic", "error");
    }
  };

  const handleDelete = () => {
    if (!deleteConfirmTopic) return;
    const topicToDelete = deleteConfirmTopic;
    setDeleteConfirmTopic(null);

    const originalTopics = studyTopics;
    const originalDetail = selectedDetailTopic;

    deleteWithUndo({
      itemName: topicToDelete.title,
      itemType: "Book Study",
      onOptimisticDelete: () => {
        setStudyTopics((prev) => prev.filter((t) => t.id !== topicToDelete.id));
        if (selectedDetailTopic?.id === topicToDelete.id) {
          setSelectedDetailTopic(null);
        }
      },
      onRestore: () => {
        setStudyTopics(originalTopics);
        if (originalDetail?.id === topicToDelete.id) {
          setSelectedDetailTopic(originalDetail);
        }
      },
      onCommitDelete: async () => {
        await api.deleteStudyTopic(topicToDelete.id);
      }
    });
  };

  // Filtered Topics
  const filteredStudyTopics = useMemo(() => {
    return studyTopics.filter(topic => {
      const q = studyTopicSearch.toLowerCase().trim();
      return !q || (
        topic.title.toLowerCase().includes(q) ||
        (topic.summary_notes && topic.summary_notes.toLowerCase().includes(q))
      );
    });
  }, [studyTopics, studyTopicSearch]);

  // Dynamic Small Groups Stats (Focusing on Active Groups)
  const curriculumStats = useMemo(() => {
    const totalBooks = studyTopics.length;
    const totalChapters = studyTopics.reduce((acc, t) => acc + (t.total_chapters || 0), 0);
    const activeGroupsWithCurriculum = allGroups.filter(g => g.curriculum && (g.status || "active") !== "merged");
    const groupsDone = activeGroupsWithCurriculum.filter(g => g.progress_stage === "completed").length;
    const groupsOngoing = activeGroupsWithCurriculum.filter(g => g.progress_stage !== "completed").length;

    return {
      totalBooks,
      totalChapters,
      totalGroups: activeGroupsWithCurriculum.length,
      groupsDone,
      groupsOngoing
    };
  }, [studyTopics, allGroups]);

  const guideData = useGuideDataState("curriculum", { loading, count: filteredStudyTopics.length, filtered: Boolean(studyTopicSearch), retry: loadData });

  if (loading && studyTopics.length === 0) {
    return <CurriculumPageSkeleton />;
  }

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-medium uppercase tracking-wider backdrop-blur-md">
              <BookMarked className="w-3.5 h-3.5 text-amber-300" />
              <span>Discipleship & Scripture Curriculum</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Topics & Books of Study
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
            Manage books of the Bible and see in real time which small groups are <strong>Done</strong> and which are <strong>Ongoing</strong>.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          {canManage && (
            <button data-guide="curriculum-new"
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>Add Book / Topic Study</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 text-white transition-all shadow-2xs backdrop-blur-md cursor-pointer"
            title="Refresh curriculum list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Library */}
        <div className="bg-white/95 rounded-3xl p-5 border border-indigo-100/90 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-900">
              <Library className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>Total Books & Topics</span>
            </div>
            <div className="text-2xl font-medium text-charcoal tracking-tight">
              {curriculumStats.totalBooks}
            </div>
            <p className="text-[12px] text-muted font-medium">Curriculum Library</p>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo-700 rounded-2xl shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Total Chapters Across Library */}
        <div className="bg-white/95 rounded-3xl p-5 border border-indigo-100/90 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-900">
              <BookMarked className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>Total Chapters / Lessons</span>
            </div>
            <div className="text-2xl font-medium text-charcoal tracking-tight">
              {curriculumStats.totalChapters}
            </div>
            <p className="text-[12px] text-muted font-medium">Across All Books</p>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-700 rounded-2xl shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
        </div>

        {/* Small Groups Done */}
        <div className="bg-white/95 rounded-3xl p-5 border border-emerald-200/80 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Groups Completed (Done)</span>
            </div>
            <div className="text-2xl font-medium text-emerald-950 tracking-tight">
              {curriculumStats.groupsDone}
            </div>
            <p className="text-[12px] text-emerald-800 font-medium">Finished Curriculum</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Small Groups Ongoing */}
        <div className="bg-white/95 rounded-3xl p-5 border border-amber-200/80 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-950">
              <Users className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Groups In Progress (Ongoing)</span>
            </div>
            <div className="text-2xl font-medium text-charcoal tracking-tight">
              {curriculumStats.groupsOngoing}
            </div>
            <p className="text-[12px] text-amber-800 font-medium">Active Group Studies</p>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-700 rounded-2xl shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with Inspector Toggle */}
      <div className="bg-white/95 rounded-3xl p-4 sm:p-5 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-charcoal">Curriculum Books</span>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-medium">
            {filteredStudyTopics.length} of {studyTopics.length}
          </span>
        </div>

        {/* Search Bar & Inspector Toggle */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input data-guide="curriculum-search"
              type="text"
              placeholder="Search book or notes..."
              value={studyTopicSearch}
              onChange={(e) => setStudyTopicSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-indigo-100/90 bg-ivory-light text-xs focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium placeholder:text-muted transition-all"
            />
          </div>

          {selectedDetailTopic && (
            <button data-guide="curriculum-inspector"
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${isInspectorOpen
                ? "bg-indigo-50 text-indigo-950 border-indigo-200 shadow-2xs hover:bg-indigo-100/70"
                : "bg-white text-charcoal/70 border-gray-200 hover:bg-gray-50"
                }`}
              title={isInspectorOpen ? "Close Side Inspector" : "Open Side Inspector"}
            >
              {isInspectorOpen ? <PanelRightClose className="w-4 h-4 text-indigo-700" /> : <PanelRight className="w-4 h-4 text-muted" />}
              <span className="hidden sm:inline">{isInspectorOpen ? "Hide Groups Panel" : "Show Groups Panel"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout: Master Grid + Group Status Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Study Topics Cards */}
        <div className={selectedDetailTopic && isInspectorOpen ? "lg:col-span-7 2xl:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
          {loading && studyTopics.length === 0 ? (
            <CardGridSkeleton count={6} columns={selectedDetailTopic && isInspectorOpen ? 2 : 3} />
          ) : filteredStudyTopics.length === 0 ? (
            <div className="text-center py-16 bg-white/95 rounded-3xl border border-dashed border-indigo-200/80 space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-charcoal">No curriculum books found</p>
                <p className="text-xs text-muted max-w-sm mx-auto">No books match your current search.</p>
              </div>
              <button data-guide="curriculum-new"
                onClick={() => handleOpenModal()}
                className="px-5 py-2.5 rounded-2xl bg-amber-400 text-indigo-950 text-xs font-medium shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
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
                const { activeGroups, completedGroups, ongoingGroups, mergedGroups, matchedGroups } = getGroupsForTopic(topic);

                return (
                  <div
                    key={topic.id}
                    onClick={() => {
                      handleOpenDetailModal(topic);
                      setIsInspectorOpen(true);
                    }}
                    className={`group relative rounded-3xl border p-5 sm:p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 ${isSelected
                      ? "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md scale-[1.01]"
                      : "bg-white/95 border-indigo-100/90 hover:border-indigo-300 hover:shadow-md"
                      }`}
                  >
                    <div className="space-y-3.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-indigo-50 text-indigo-950 border border-indigo-200/70 shadow-2xs flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3 text-indigo-700" />
                          <span>Book Study</span>
                        </span>

                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[12px] font-medium">
                          {topic.total_chapters} {topic.total_chapters === 1 ? "Chapter" : "Chapters"}
                        </span>
                      </div>

                      {/* Title & Notes */}
                      <div>
                        <h3 className={`text-base sm:text-lg font-semibold tracking-tight leading-snug transition-colors ${isSelected ? "text-indigo-950" : "text-charcoal group-hover:text-indigo-900"
                          }`}>
                          {topic.title}
                        </h3>
                        {topic.summary_notes && (
                          <p className="text-xs text-charcoal/65 line-clamp-2 mt-1.5 leading-relaxed font-normal">
                            {topic.summary_notes}
                          </p>
                        )}
                      </div>

                      {/* Small Groups Done vs Ongoing Status Tracker */}
                      <div className="p-3 bg-gray-50/90 rounded-2xl border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-charcoal/80">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-700" />
                            <span>Small Groups Status</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="text-charcoal/70 font-medium">
                              {activeGroups.length} Active {activeGroups.length === 1 ? "Group" : "Groups"}
                            </span>
                            {mergedGroups.length > 0 && (
                              <span className="text-purple-700 font-medium bg-purple-100/80 px-1.5 py-0.2 rounded text-[12px] border border-purple-200">
                                +{mergedGroups.length} merged
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Done & Ongoing Badges */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div className={`p-2 rounded-xl border flex items-center justify-between ${completedGroups.length > 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                            : "bg-white border-gray-100 text-muted"
                            }`}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${completedGroups.length > 0 ? "text-emerald-600" : "text-charcoal/30"}`} />
                              <span className="text-[12px] font-medium truncate">Done</span>
                            </div>
                            <span className={`text-xs font-medium px-1.5 py-0.2 rounded-md ${completedGroups.length > 0 ? "bg-emerald-600 text-white" : "bg-gray-100 text-muted"}`}>
                              {completedGroups.length}
                            </span>
                          </div>

                          <div className={`p-2 rounded-xl border flex items-center justify-between ${ongoingGroups.length > 0
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-white border-gray-100 text-muted"
                            }`}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${ongoingGroups.length > 0 ? "bg-amber-500 animate-pulse" : "bg-charcoal/30"}`} />
                              <span className="text-[12px] font-medium truncate">Ongoing</span>
                            </div>
                            <span className={`text-xs font-medium px-1.5 py-0.2 rounded-md ${ongoingGroups.length > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-muted"}`}>
                              {ongoingGroups.length}
                            </span>
                          </div>
                        </div>

                        {/* Mini group badges preview if any */}
                        {matchedGroups.length > 0 ? (
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                            {[...activeGroups, ...mergedGroups].slice(0, 3).map((g) => {
                              const isM = g.status === "merged";
                              const isDone = !isM && completedGroups.some(cg => cg.id === g.id);
                              return (
                                <span
                                  key={g.id}
                                  className={`px-2 py-0.5 rounded-lg text-[12px] font-medium whitespace-nowrap truncate max-w-[110px] ${isM
                                    ? "bg-purple-100 text-purple-900 border border-purple-200"
                                    : isDone
                                      ? "bg-emerald-100/80 text-emerald-900"
                                      : "bg-amber-100/80 text-amber-900"
                                    }`}
                                >
                                  {isM && <Archive aria-hidden="true" className="inline-block w-3 h-3 mr-1 align-[-0.125em]" />}{g.name}
                                </span>
                              );
                            })}
                            {matchedGroups.length > 3 && (
                              <span className="text-[12px] font-medium text-muted">
                                +{matchedGroups.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[12px] text-charcoal/45 italic text-center pt-0.5">
                            No small groups assigned yet
                          </p>
                        )}
                      </div>

                      {/* Select & View Action Tag */}
                      <div className={`flex items-center justify-between pt-1 text-xs font-medium transition-colors ${isSelected ? "text-indigo-700" : "text-indigo-900/80 group-hover:text-indigo-900"
                        }`}>
                        <span className="flex items-center gap-1.5">
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                              <span>Inspecting Groups & Details</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-3.5 h-3.5 text-indigo-900/60" />
                              <span>Click to View Groups Status</span>
                            </>
                          )}
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "translate-x-1" : "group-hover:translate-x-1"}`} />
                      </div>
                    </div>

                    {/* Quick Card Action Buttons: Edit, Delete */}
                    {canManage && (
                      <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(topic);
                          }}
                          className="p-2 hover:bg-indigo-50 rounded-xl text-muted hover:text-indigo-700 transition-colors cursor-pointer"
                          title="Edit book"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmTopic(topic);
                          }}
                          className="p-2 hover:bg-rose-50 rounded-xl text-muted hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete book"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Group Status Inspector & Book Details Panel */}
        {selectedDetailTopic && isInspectorOpen && (() => {
          const topicData = topicDetailData?.topic || selectedDetailTopic;
          const { activeGroups, completedGroups, ongoingGroups, mergedGroups, matchedGroups } = getGroupsForTopic(topicData);

          const displayedGroups = detailGroupTab === "completed"
            ? completedGroups
            : detailGroupTab === "ongoing"
              ? ongoingGroups
              : detailGroupTab === "merged"
                ? mergedGroups
                : activeGroups;

          return (
            <>
              {/* Backdrop for mobile */}
              <ViewportOverlay
                onClick={() => setIsInspectorOpen(false)}
                className="lg:hidden z-40 bg-indigo-950/60 backdrop-blur-xs animate-in fade-in duration-200"
              />

              {/* Inspector Container */}
              <div className="lg:col-span-5 2xl:col-span-4 lg:sticky lg:top-6 fixed inset-y-0 right-0 z-50 lg:z-auto w-full max-w-md lg:max-w-none bg-white lg:bg-transparent shadow-2xl lg:shadow-none p-4 sm:p-6 lg:p-0 overflow-y-auto animate-in slide-in-from-right duration-200">
                <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-indigo-100/90 shadow-sm space-y-5">
                  {/* Inspector Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-gray-100 gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-indigo-50 text-indigo-950 border border-indigo-200/70 shadow-2xs">
                          Book of Study
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[12px] font-medium">
                          {topicData.total_chapters} {topicData.total_chapters === 1 ? "Chapter" : "Chapters"}
                        </span>
                      </div>

                      <h2 data-guide="curriculum-details" className="text-xl font-semibold text-indigo-950 tracking-tight leading-snug">
                        {topicData.title}
                      </h2>
                    </div>

                    <button
                      onClick={() => setIsInspectorOpen(false)}
                      className="p-2 rounded-2xl text-muted hover:text-charcoal hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      title="Close Inspector"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Live sync loader */}
                  {loadingDetail && (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-medium animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Loading groups and study data...</span>
                    </div>
                  )}

                  {/* Summary Notes */}
                  {topicData.summary_notes && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-charcoal/70">Overview & Study Notes:</h4>
                      <p className="text-xs text-charcoal/80 leading-relaxed bg-gray-50/90 p-3.5 rounded-2xl border border-gray-100">
                        {topicData.summary_notes}
                      </p>
                    </div>
                  )}

                  {/* Groups Done vs Ongoing Detailed Breakdown */}
                  <div className="space-y-3.5 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="font-semibold text-sm text-charcoal flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-indigo-700" />
                          <span>Small Groups Tracking</span>
                        </h4>
                        <p className="text-[12px] text-muted">Groups studying this book</p>
                      </div>

                      {/* Segmented Filter: Active, Ongoing, Done, Merged */}
                      <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1 shrink-0 flex-wrap">
                        <button
                          onClick={() => setDetailGroupTab("all")}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "all" ? "bg-white text-indigo-900 shadow-2xs" : "text-muted hover:text-charcoal"
                            }`}
                        >
                          Active ({activeGroups.length})
                        </button>
                        <button
                          onClick={() => setDetailGroupTab("ongoing")}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "ongoing" ? "bg-white text-amber-800 shadow-2xs" : "text-muted hover:text-charcoal"
                            }`}
                        >
                          Ongoing ({ongoingGroups.length})
                        </button>
                        <button
                          onClick={() => setDetailGroupTab("completed")}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "completed" ? "bg-white text-emerald-800 shadow-2xs" : "text-muted hover:text-charcoal"
                            }`}
                        >
                          Done ({completedGroups.length})
                        </button>
                        {mergedGroups.length > 0 && (
                          <button
                            onClick={() => setDetailGroupTab("merged")}
                            className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "merged" ? "bg-white text-purple-900 shadow-2xs" : "text-purple-700/80 hover:text-purple-900"
                              }`}
                          >
                            Merged ({mergedGroups.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group Status Cards List */}
                    {displayedGroups.length === 0 ? (
                      <div className="text-center p-6 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 space-y-1.5">
                        <Users className="w-6 h-6 text-charcoal/30 mx-auto" />
                        <p className="text-xs font-medium text-charcoal/70">
                          {detailGroupTab === "completed"
                            ? "No active small groups have completed this book yet."
                            : detailGroupTab === "ongoing"
                              ? "No active small groups are currently ongoing with this book."
                              : detailGroupTab === "merged"
                                ? "No merged/archived groups found for this book."
                                : "No active small groups are assigned to this book yet."}
                        </p>
                        <p className="text-[12px] text-muted">
                          To link a group, set this book as their curriculum in Small Groups.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 no-scrollbar">
                        {displayedGroups.map((grp) => {
                          const isMerged = grp.status === "merged";
                          const isGroupDone = !isMerged && completedGroups.some((cg) => cg.id === grp.id);
                          const hasSourceMerge = !isMerged && Boolean(grp.source_group_names);

                          return (
                            <div
                              key={grp.id}
                              className={`p-3 rounded-2xl border text-xs space-y-2 transition-all ${isMerged
                                ? "bg-purple-50/50 border-purple-200/80 hover:border-purple-300"
                                : isGroupDone
                                  ? "bg-emerald-50/60 border-emerald-200 hover:border-emerald-300"
                                  : "bg-amber-50/60 border-amber-200 hover:border-amber-300"
                                }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-charcoal text-xs truncate">{grp.name}</span>
                                    {grp.ministry_name && (
                                      <span
                                        className="px-2 py-0.2 rounded-md text-[12px] font-medium text-white shrink-0"
                                        style={{ backgroundColor: grp.ministry_color || "#2C3968" }}
                                      >
                                        {grp.ministry_name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[12px] text-charcoal/70 mt-0.5">
                                    Leader: <strong className="text-charcoal font-medium">{grp.leader_name}</strong>
                                  </div>
                                </div>

                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-medium shrink-0 ${isMerged
                                  ? "bg-purple-100 text-purple-900 border border-purple-200 shadow-2xs"
                                  : isGroupDone
                                    ? "bg-emerald-600 text-white shadow-2xs"
                                    : "bg-amber-500 text-white shadow-2xs"
                                  }`}>
                                  {isMerged ? (
                                    <>
                                      <GitMerge className="w-3 h-3 text-purple-700" />
                                      <span>Merged Archive</span>
                                    </>
                                  ) : isGroupDone ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Done</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      <span>Ongoing</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Merged Group Information Notice */}
                              {isMerged && grp.merged_into_group_name && (
                                <div className="text-[12px] text-purple-900 bg-purple-100/70 p-2 rounded-xl border border-purple-200 flex items-center gap-1.5 font-medium leading-tight">
                                  <GitMerge className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                  <span>Merged into: <strong className="font-medium">{grp.merged_into_group_name}</strong></span>
                                </div>
                              )}

                              {/* Resulting Merged Group Notice */}
                              {hasSourceMerge && (
                                <div className="text-[12px] text-teal-950 bg-teal-50 p-2 rounded-xl border border-teal-200 flex items-center gap-1.5 font-medium leading-tight">
                                  <GitMerge className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                  <span>Merged from: <strong className="font-medium">{grp.source_group_names}</strong></span>
                                </div>
                              )}

                              {/* Group Details: Schedule, Location, Members */}
                              <div className="flex items-center justify-between text-[12px] text-muted pt-1.5 border-t border-black/5 flex-wrap gap-1">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>{grp.meeting_day}s {grp.meeting_time}</span>
                                </div>
                                {grp.location && (
                                  <div className="flex items-center gap-1 truncate max-w-[140px]">
                                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="truncate">{grp.location}</span>
                                  </div>
                                )}
                                {grp.current_member_count !== undefined && (
                                  <div className={`flex items-center gap-1 font-medium ${isMerged ? "text-purple-900" : "text-indigo-900"}`}>
                                    <Users className="w-3 h-3" />
                                    <span>{grp.current_member_count} Members</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Primary & Secondary Inspector Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3.5 border-t border-gray-100">
                    <button
                      onClick={() => handleOpenModal(topicData)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-medium text-xs transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Edit Book</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmTopic(topicData)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* ==================================================== */}
      {/* MODAL: ADD / EDIT BOOK OF STUDY */}
      {/* ==================================================== */}
      {isStudyTopicModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div data-modal-header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo flex items-center justify-center font-medium">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">
                    {editingStudyTopic ? "Edit Book of Study" : "Add Book of Study"}
                  </h3>
                  <p className="text-[12px] text-muted">
                    Configure book title, total chapters, and summary notes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudyTopicModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-muted hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form data-guide="curriculum-form" onSubmit={handleSaveStudyTopic} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Book / Study Title *</label>
                <input data-guide="curriculum-title"
                  type="text"
                  required
                  placeholder="e.g. Gospel of John, Romans, Discipleship 101..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                />
              </div>

              {/* Total Chapters */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Total Chapters / Lessons</label>
                <input data-guide="curriculum-lessons"
                  type="number"
                  min="1"
                  required
                  value={formData.total_chapters}
                  onChange={(e) => setFormData({ ...formData, total_chapters: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                />
              </div>

              {/* Summary Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Summary Notes / Objectives</label>
                <textarea data-guide="curriculum-notes"
                  rows={3}
                  placeholder="Key themes, outline, study guides or reflections..."
                  value={formData.summary_notes}
                  onChange={(e) => setFormData({ ...formData, summary_notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none resize-none font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div data-modal-footer className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsStudyTopicModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button data-guide="curriculum-save"
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs"
                >
                  {editingStudyTopic ? "Save Changes" : "Add Book to Curriculum"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ==================================================== */}
      {deleteConfirmTopic && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div data-modal-header className="space-y-4"><div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-charcoal">Delete Book Study?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to remove <strong>{deleteConfirmTopic.title}</strong> from the curriculum library?
              </p>
            </div></div>
            <div data-modal-footer className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTopic(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium transition-all shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}
    </div>
  );
};
