import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { Badge } from "../components/common/Badge";
import { DialogPanel } from "../components/common/DialogPanel";
import './curriculum.css';
import { usePageControls, useDebouncedValue } from "../hooks/useListPagination";
import { StatCard } from "../components/common/StatCard";
import { PageHeader } from "../components/common/PageHeader";
import { ListSkeleton } from "../components/common/SkeletonLoader";
import { Button } from "../components/common/Button";
import { ViewportOverlay } from "../components/common/ViewportOverlay";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo, useRef } from "react";
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
  const canManage = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";
  const { showToast, deleteWithUndo } = useToast();
  const [loading, setLoading] = useState(true);
  const [studyTopicsSummary, setStudyTopicsSummary] = useState<StudyTopicsSummary | null>(null);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [allGroups, setAllGroups] = useState<BibleStudyGroup[]>([]);

  // Filters & Search
  const [studyTopicSearch, setStudyTopicSearch] = useState("");
  const debouncedSearch = useDebouncedValue(studyTopicSearch);
  const { page, pageSize, setPage, setPageSize } = usePageControls(debouncedSearch);
  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const [hasLoaded, setHasLoaded] = useState(false);

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
    summary_notes: "",
    has_discussion: true, has_review: true, has_exam: false
  });

  useEffect(() => {
    loadData();
  }, [page, pageSize, debouncedSearch]);
  useEffect(() => () => { listSequence.current++; }, []);

  // Real-time automatic sync via Socket.IO
  useSocketEvent("study_topics:changed", () => {
    loadData();
  });
  useSocketEvent("groups:changed", () => {
    loadData();
  });

 const loadData = async () => {
    const sequence = ++listSequence.current;
    guideData.clearError();
    setLoading(true);
    try {
      const studyRes = await api.getStudyTopics({ page, limit: pageSize, search: debouncedSearch });
      const groupsRes = studyRes.pagination ? [] : await api.getGroups().catch(() => []);
      if (sequence !== listSequence.current) return;
      if (studyRes.pagination && studyRes.pagination.page !== page) setPage(studyRes.pagination.page);
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
      if (sequence !== listSequence.current) return;
      console.error("Failed to load curriculum data:", err);
      guideData.reportError(err);
      showToast(err.message || "Failed to load curriculum data", "error");
    } finally {
      if (sequence === listSequence.current) { setHasLoaded(true); setLoading(false); }
    }
  };

  const handleOpenDetailModal = async (topic: StudyTopic) => {
    const sequence = ++detailSequence.current;
    setSelectedDetailTopic(topic);
    setTopicDetailData(null);
    setDetailGroupTab("all");
    setLoadingDetail(true);
    try {
      const res = await api.getStudyTopic(topic.id);
      if (sequence !== detailSequence.current) return;
      setTopicDetailData(res);
      if (res.topic) {
        setSelectedDetailTopic(res.topic);
      }
    } catch (err: any) {
      if (sequence !== detailSequence.current) return;
      console.error("Failed to load topic details:", err);
      showToast(err.message || "Failed to fetch topic details", "error");
    } finally {
      if (sequence === detailSequence.current) setLoadingDetail(false);
    }
  };

  // Cross-match small groups studying this book / topic
  const getGroupsForTopic = (topic: StudyTopic) => {
    const topicTitleLower = (topic.title || "").toLowerCase().trim();
    const words = topicTitleLower
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !["book", "study", "guide", "life", "test", "with", "from", "paul", "holy"].includes(w));

    const source = selectedDetailTopic?.id === topic.id && topicDetailData?.all_groups ? topicDetailData.all_groups : topic.group_preview || allGroups;
    const matchedGroups = source.filter((g) => {
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

    const counts = topic.group_counts || { active: activeGroups.length, completed: completedGroups.length, ongoing: ongoingGroups.length, merged: mergedGroups.length };
    return { activeGroups, completedGroups, ongoingGroups, mergedGroups, matchedGroups, counts };
  };

  const handleOpenModal = (topic?: StudyTopic) => {
    if (topic) {
      setEditingStudyTopic(topic);
      setFormData({
        title: topic.title,
        total_chapters: topic.total_chapters || 1,
        summary_notes: topic.summary_notes || "",
        has_discussion: topic.has_discussion ?? true,
        has_review: topic.has_review ?? true,
        has_exam: topic.has_exam ?? true
      });
    } else {
      setEditingStudyTopic(null);
      setFormData({
        title: "",
        total_chapters: 1,
        summary_notes: "",
        has_discussion: true, has_review: true, has_exam: false
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
        summary_notes: formData.summary_notes.trim() || undefined,
        has_discussion: formData.has_discussion,
        has_review: formData.has_review,
        has_exam: formData.has_exam
      };

      if (editingStudyTopic) {
        await api.updateStudyTopic(editingStudyTopic.id, payload);
        // Publish the saved fields to both entry points before refreshing the list.
        detailSequence.current++;
        setLoadingDetail(false);
        setStudyTopics(previous => previous.map(topic => topic.id === editingStudyTopic.id ? { ...topic, ...payload } : topic));
        setSelectedDetailTopic(previous => previous?.id === editingStudyTopic.id ? { ...previous, ...payload } : previous);
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
    if (studyTopicsSummary?.pagination) return studyTopics;
    return studyTopics.filter(topic => {
      const q = studyTopicSearch.toLowerCase().trim();
      return !q || (
        topic.title.toLowerCase().includes(q) ||
        (topic.summary_notes && topic.summary_notes.toLowerCase().includes(q))
      );
    });
  }, [studyTopics, studyTopicSearch, studyTopicsSummary]);
  const resultTotal = studyTopicsSummary?.pagination?.total ?? filteredStudyTopics.length;
  const visibleTopics = studyTopicsSummary?.pagination ? filteredStudyTopics : filteredStudyTopics.slice((page - 1) * pageSize, page * pageSize);

  // Dynamic Small Groups Stats (Focusing on Active Groups)
  const curriculumStats = useMemo(() => {
    if (studyTopicsSummary?.summary) return studyTopicsSummary.summary;
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
  }, [studyTopics, allGroups, studyTopicsSummary]);

  const guideData = useGuideDataState("curriculum", { loading, count: filteredStudyTopics.length, filtered: Boolean(studyTopicSearch), retry: loadData });

  if (loading && !hasLoaded) {
    return <CurriculumPageSkeleton />;
  }

  return (
    <div className="curriculum-page directory-design space-y-6">

      {/* Header Banner */}
      <PageHeader className="page-header--compact" icon={<BookMarked />} title={<>Topics & Books of Study</>}
        description={<>Manage books of the Bible and see in real time which small groups are <strong>Done</strong> and which are <strong>Ongoing</strong>.</>}
        actions={<><div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          {canManage && (
            <Button data-guide="curriculum-new" onClick={() => handleOpenModal()} variant="primary">
              <Plus className="w-4 h-4 " />
              <span>Add Book / Topic Study</span>
            </Button>
          )}

          <Button onClick={loadData} disabled={loading} title="Refresh curriculum list" aria-label="Refresh curriculum list" variant="secondary" size="icon">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div></>} />

      {/* Curriculum summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Books & Topics" value={curriculumStats.totalBooks} icon={<BookOpen />} description="Curriculum Library" />
        <StatCard label="Total Chapters / Lessons" value={curriculumStats.totalChapters} icon={<BookMarked />} tone="amber" description="Across All Books" />
        <StatCard label="Groups Completed (Done)" value={curriculumStats.groupsDone} icon={<Award />} tone="emerald" description="Finished Curriculum" />
        <StatCard label="Groups In Progress (Ongoing)" value={curriculumStats.groupsOngoing} icon={<Users />} tone="amber" description="Active Group Studies" />
      </div>

      {/* Filter and Search Bar with Inspector Toggle */}
      <FilterPanel title="Curriculum filters" summary={studyTopicSearch || "All curriculum books and topics"} actions={selectedDetailTopic && (
            <button data-guide="curriculum-inspector"
              aria-label={isInspectorOpen ? "Close Side Inspector" : "Open Side Inspector"}
              aria-expanded={isInspectorOpen}
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
          )}>
        <div className="filter-panel-layout bg-white/95 rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-charcoal">Curriculum Books</span>
          <Badge variant="neutral" className="rounded-full">
            {filteredStudyTopics.length} of {studyTopics.length}
          </Badge>
        </div>

        {/* Search Bar & Inspector Toggle */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input data-guide="curriculum-search"
              aria-label="Search books and notes"
              type="text"
              placeholder="Search book or notes..."
              value={studyTopicSearch}
              onChange={(e) => setStudyTopicSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-indigo-100/90 bg-ivory-light text-xs focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium placeholder:text-muted transition-all"
            />
          </div>


        </div>
      </div>
      </FilterPanel>

      {/* Main Content Layout: Master Grid + Group Status Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Study Topics Cards */}
        <div className={selectedDetailTopic && isInspectorOpen ? "lg:col-span-7 2xl:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
          {loading && studyTopics.length === 0 ? (
            <CardGridSkeleton count={6} columns={selectedDetailTopic && isInspectorOpen ? 2 : 3} />
          ) : filteredStudyTopics.length === 0 ? (
            <div className="text-center py-16 bg-white/95 rounded-2xl border border-dashed border-indigo-200/80 space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-charcoal">No curriculum books found</p>
                <p className="text-xs text-muted max-w-sm mx-auto">No books match your current search.</p>
              </div>
              {canManage && <Button data-guide="curriculum-new" variant="primary"
                onClick={() => handleOpenModal()}
              >
                + Add Book / Topic Study
              </Button>}
            </div>
          ) : (
            <div className={`grid gap-5 ${selectedDetailTopic && isInspectorOpen
              ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              }`}>
              {visibleTopics.map(topic => {
                const isSelected = selectedDetailTopic?.id === topic.id;
                const { activeGroups, completedGroups, ongoingGroups, mergedGroups, matchedGroups, counts } = getGroupsForTopic(topic);

                return (
                  <article key={topic.id} className="curriculum-book-card" data-selected={isSelected}
                    aria-label={topic.title} onClick={() => { handleOpenDetailModal(topic); setIsInspectorOpen(true); }}>
                    <div className="curriculum-book-labels">
                      <Badge variant="info"><BookOpen size={14} aria-hidden="true" />Book of Study</Badge>
                      <Badge>{topic.total_chapters} {topic.total_chapters === 1 ? "Chapter" : "Chapters"}</Badge>
                    </div>
                    <div className="curriculum-book-copy">
                      <h3 title={topic.title}>{topic.title}</h3>
                      {topic.summary_notes && <p title={topic.summary_notes}>{topic.summary_notes}</p>}
                    </div>
                    <div className="curriculum-group-summary">
                      <div className="curriculum-group-summary-heading">
                        <span><Users size={14} aria-hidden="true" />Small Groups Status</span>
                        <span>{counts.active} Active {counts.active === 1 ? "Group" : "Groups"}</span>
                      </div>
                      <div className="curriculum-group-counts">
                        <Badge variant="success"><CheckCircle2 size={14} aria-hidden="true" />Done <strong>{counts.completed}</strong></Badge>
                        <Badge variant="warning"><Clock size={14} aria-hidden="true" />Ongoing <strong>{counts.ongoing}</strong></Badge>
                      </div>
                      {counts.active > 0 && <div className="curriculum-progress" role="progressbar" aria-label={topic.title + " completed groups"}
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(counts.completed / counts.active * 100)}
                        title={counts.completed + " of " + counts.active + " groups completed"}>
                        <span style={{ width: Math.min(100, counts.completed / counts.active * 100) + "%" }} />
                      </div>}
                      <div className="curriculum-group-chips">
                        {[...activeGroups, ...mergedGroups].slice(0, 3).map(g => <Badge key={g.id}
                          title={g.status === "merged" && g.merged_into_group_name ? g.name + " — Merged into " + g.merged_into_group_name : g.name}>
                          {g.status === "merged" && <Archive size={12} aria-hidden="true" />}<span className="curriculum-chip-name">{g.name}</span>
                        </Badge>)}
                        {counts.merged > 0 && <Badge title={mergedGroups.map(g => g.merged_into_group_name ? g.name + ": Merged into " + g.merged_into_group_name : g.name + ": Merged archive").join("; ") || "Merged groups archived under this book"}>
                          +{counts.merged} merged
                        </Badge>}
                        {(counts.active + counts.merged) > 3 && <span>+{counts.active + counts.merged - 3} more</span>}
                        {(counts.active + counts.merged) === 0 && <span>No small groups assigned yet</span>}
                      </div>
                    </div>
                    <footer className="curriculum-book-footer">
                      <Button variant="ghost" size="sm" aria-label={"Inspect groups for " + topic.title}
                        onClick={event => { event.stopPropagation(); handleOpenDetailModal(topic); setIsInspectorOpen(true); }}>
                        {isSelected ? <CheckCircle2 size={14} aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
                        {isSelected ? "Inspecting Groups & Details" : "View Groups Status"}
                      </Button>
                      {canManage && <div className="curriculum-book-actions">
                        <Button size="sm" variant="ghost" className="curriculum-icon-action" title="Edit book" aria-label={"Edit " + topic.title}
                          onClick={event => { event.stopPropagation(); handleOpenModal(topic); }}><Edit2 size={16} aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" className="curriculum-icon-action curriculum-icon-delete" title="Delete book" aria-label={"Delete " + topic.title}
                          onClick={event => { event.stopPropagation(); setDeleteConfirmTopic(topic); }}><Trash2 size={16} aria-hidden="true" /></Button>
                      </div>}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
          {resultTotal > pageSize && <div className="mt-4"><Pagination label="books" page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} /></div>}
        </div>

        {/* Right Side: Group Status Inspector & Book Details Panel */}
        {selectedDetailTopic && isInspectorOpen && (() => {
          const topicData = selectedDetailTopic;
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
              <aside aria-label="Book of Study details" className="curriculum-inspector lg:col-span-5 2xl:col-span-4">
                <div className="curriculum-inspector-panel">
                  {/* Inspector Header */}
                  <div className="curriculum-inspector-header flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="info">
                          Book of Study
                        </Badge>
                        <Badge>
                          {topicData.total_chapters} {topicData.total_chapters === 1 ? "Chapter" : "Chapters"}
                        </Badge>
                      </div>

                      <h2 data-guide="curriculum-details" className="text-xl font-semibold text-indigo-950 tracking-tight leading-snug">
                        {topicData.title}
                      </h2>
                    </div>

                    <button
                      onClick={() => setIsInspectorOpen(false)}
                      className="p-2 rounded-2xl text-muted hover:text-charcoal hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      title="Close Inspector"
                      aria-label="Close Inspector"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="curriculum-inspector-scroll"><div className="curriculum-inspector-body" tabIndex={0} aria-label="Book notes and group list">
                  {/* Live sync loader */}
                  {loadingDetail && (
                    <ListSkeleton count={3} label="Loading groups and study data..." />
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

                      {/* Active includes ongoing and done groups; merged archives remain separate. */}
                      <div className="curriculum-group-tabs flex items-center gap-1 flex-wrap" aria-label="Filter study groups">
                        <button
                          onClick={() => setDetailGroupTab("all")}
                          aria-pressed={detailGroupTab === "all"}
                          title="All non-merged groups studying this book, including ongoing and completed groups. Merged archives have a separate tab."
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "all" ? "bg-white text-indigo-900 shadow-2xs" : "text-muted hover:text-charcoal"
                            }`}
                        >
                          Active ({activeGroups.length})
                        </button>
                        <button
                          onClick={() => setDetailGroupTab("ongoing")}
                          aria-pressed={detailGroupTab === "ongoing"}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "ongoing" ? "bg-white text-amber-800 shadow-2xs" : "text-muted hover:text-charcoal"
                            }`}
                        >
                          Ongoing ({ongoingGroups.length})
                        </button>
                        <button
                          onClick={() => setDetailGroupTab("completed")}
                          aria-pressed={detailGroupTab === "completed"}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${detailGroupTab === "completed" ? "bg-white text-emerald-800 shadow-2xs" : "text-muted hover:text-charcoal"
                            }`}
                        >
                          Done ({completedGroups.length})
                        </button>
                        {mergedGroups.length > 0 && (
                          <button
                            onClick={() => setDetailGroupTab("merged")}
                            aria-pressed={detailGroupTab === "merged"}
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
                      <div className="space-y-2.5">
                        {displayedGroups.map((grp) => {
                          const isMerged = grp.status === "merged";
                          const isGroupDone = !isMerged && completedGroups.some((cg) => cg.id === grp.id);
                          const hasSourceMerge = !isMerged && Boolean(grp.source_group_names);

                          return (
                            <div
                              key={grp.id}
                              className="curriculum-group-card text-xs space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-charcoal text-xs truncate" title={grp.name}>{grp.name}</span>
                                    {grp.ministry_name && (
                                      <Badge title={grp.ministry_name}>
                                        {grp.ministry_name}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[12px] text-charcoal/70 mt-0.5">
                                    Leader: <strong className="text-charcoal font-medium">{grp.leader_name}</strong>
                                  </div>
                                </div>

                                <Badge className="shrink-0" variant={isMerged ? "neutral" : isGroupDone ? "success" : "warning"}>
                                  {isMerged ? (
                                    <>
                                      <GitMerge className="w-3 h-3" aria-hidden="true" />
                                      <span>Merged Archive</span>
                                    </>
                                  ) : isGroupDone ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Done</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3 h-3" aria-hidden="true" />
                                      <span>Ongoing</span>
                                    </>
                                  )}
                                </Badge>
                              </div>

                              {/* Merged Group Information Notice */}
                              {isMerged && grp.merged_into_group_name && (
                                <div className="curriculum-merge-note" title={"Merged into " + grp.merged_into_group_name}>
                                  <GitMerge className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>Merged into: <strong className="font-medium">{grp.merged_into_group_name}</strong></span>
                                </div>
                              )}

                              {/* Resulting Merged Group Notice */}
                              {hasSourceMerge && (
                                <div className="curriculum-merge-note" title={"Merged from " + grp.source_group_names}>
                                  <GitMerge className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
                                  <div className="flex items-center gap-1 truncate max-w-[140px]" title={grp.location}>
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

                  </div></div>
                  {/* Inspector actions stay visible while notes and groups scroll. */}
                  <div className="curriculum-inspector-footer">
                    <Button
                      onClick={() => handleOpenModal(topicData)}
                      variant="secondary"
                    >
                      <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit Book</span>
                    </Button>
                    <Button
                      onClick={() => setDeleteConfirmTopic(topicData)}
                      variant="destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
              </aside>
            </>
          );
        })()}
      </div>

      {/* ==================================================== */}
      {/* MODAL: ADD / EDIT BOOK OF STUDY */}
      {/* ==================================================== */}
      {isStudyTopicModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="curriculum-dialog bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
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
                aria-label="Close book form" title="Close book form"
                className="curriculum-icon-action hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form id="curriculum-book-form" data-guide="curriculum-form" onSubmit={handleSaveStudyTopic} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label htmlFor="study-book-title" className="text-xs font-medium text-charcoal">Book / Study Title *</label>
                <input data-guide="curriculum-title"
                  id="study-book-title"
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
                <label htmlFor="study-book-chapters" className="text-xs font-medium text-charcoal">Total Chapters / Lessons</label>
                <input data-guide="curriculum-lessons"
                  id="study-book-chapters"
                  type="number"
                  min="1"
                  required
                  value={formData.total_chapters}
                  onChange={(e) => setFormData({ ...formData, total_chapters: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                />
              </div>

              <fieldset className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                <legend className="px-1 text-xs font-medium text-charcoal">Optional study stages</legend>
                <p className="text-xs text-muted">Choose the activities used in this book or topic.</p>
                {([
                  ["has_discussion", "Discussion & Reflection"],
                  ["has_review", "Review / Q&A"],
                  ["has_exam", "Exam / Assessment"],
                ] as const).map(([field, label]) => <label key={field} className="flex items-center gap-2 text-xs text-charcoal cursor-pointer py-1">
                  <input type="checkbox" checked={formData[field]} onChange={event => setFormData(previous => ({ ...previous, [field]: event.target.checked }))} className="accent-[var(--accent)]" />
                  <span>{label}</span>
                </label>)}
                <p className="text-[11px] text-muted leading-relaxed">Introduction, In progress, Mid-way, and Chapter finished are always available. Saved sessions keep their recorded stages.</p>
              </fieldset>

              {/* Summary Notes */}
              <div className="space-y-1">
                <label htmlFor="study-book-notes" className="text-xs font-medium text-charcoal">Summary Notes / Objectives</label>
                <textarea data-guide="curriculum-notes"
                  id="study-book-notes"
                  rows={3}
                  placeholder="Key themes, outline, study guides or reflections..."
                  value={formData.summary_notes}
                  onChange={(e) => setFormData({ ...formData, summary_notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none resize-none font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div data-modal-footer className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <Button variant="secondary"
                  type="button"
                  onClick={() => setIsStudyTopicModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button data-guide="curriculum-save" variant="primary"
                  type="submit"
                  form="curriculum-book-form"
                >
                  {editingStudyTopic ? "Save Changes" : "Add Book to Curriculum"}
                </Button>
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
          <DialogPanel onClose={() => setDeleteConfirmTopic(null)} aria-labelledby="delete-study-title" className="curriculum-dialog bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 text-center">
            <div data-modal-header className="space-y-4"><div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 id="delete-study-title" className="font-semibold text-base text-charcoal">Delete Book of Study?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to remove <strong>{deleteConfirmTopic.title}</strong> from the curriculum library?
              </p>
            </div></div>
            <div data-modal-footer className="flex items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setDeleteConfirmTopic(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                variant="destructive"
              >
                Yes, Delete
              </Button>
            </div>
          </DialogPanel>
        </div>,
        document.body
      )}
    </div>
  );
};
