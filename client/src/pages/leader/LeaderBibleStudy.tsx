import { AlertTriangle as UIAlertTriangle } from "lucide-react";
import { ModalPanel } from "../../components/common/ModalPanel";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { BibleStudyGroup, BibleStudyMember, StudyTopic } from "../../types";
import { api } from "../../api";
import { TimePickerInput } from "../../components/common/TimePickerInput";
import { ConfirmationModal, ModalType } from "../../components/common/ConfirmationModal";
import { BibleStudyRescheduleModal } from "../../components/biblestudy/BibleStudyRescheduleModal";
import { useAuth } from "../../context/AuthContext";
import { StudyProgressFields } from "../../components/biblestudy/StudyProgressFields";
import { LessonNoticeField } from "../../components/biblestudy/LessonNoticeField";
import {
  UserCheck, Calendar, Check, CheckCircle2, BookOpen,
  Edit, BookmarkCheck, MapPin,
  Clock, ShieldCheck, X,
  CalendarClock
} from "lucide-react";

interface LeaderBibleStudyProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  onOpenRollCall: () => void;
  onGroupUpdated?: () => void;
}

export const LeaderBibleStudy: React.FC<LeaderBibleStudyProps> = ({
  activeGroup,
  groupDisciples,
  onOpenRollCall,
  onGroupUpdated
}) => {
  const { user } = useAuth();
  const canManageBooks = ["Coordinator", "Pastor", "Admin", "IT Admin"].includes(user?.role_name || "");
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);

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

  // Edit Study & Book Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  useEffect(() => {
    api.getStudyTopics().then(result => setStudyTopics(result.topics || result.all || [])).catch(() => setStudyTopics([]));
  }, [activeGroup, isEditModalOpen]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Reschedule Modal State
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isSavingReschedule, setIsSavingReschedule] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    is_rescheduled: true,
    rescheduled_date: "",
    rescheduled_time_start: "7:00 PM",
    rescheduled_time_end: "8:30 PM",
    reschedule_reason: ""
  });

  const [formData, setFormData] = useState({
    name: "",
    curriculum: "",
    current_chapter: "Chapter 1",
    progress_stage: "in_progress",
    progress_notes: "",
    meeting_day: "Wednesday",
    meeting_time_start: "7:00 PM",
    meeting_time_end: "8:30 PM",
    location: "",
    description: ""
  });


  // Church Rooms Lookups from Database
  const [churchRooms, setChurchRooms] = useState<string[]>([]);
  const [isCustomLoc, setIsCustomLoc] = useState<boolean>(false);
  const [customLocText, setCustomLocText] = useState<string>("");

  useEffect(() => {
    api.getLookups("event_location", true)
      .then(res => {
        if (res && Array.isArray(res)) {
          setChurchRooms(res.map((r: any) => r.name).filter(Boolean));
        }
      })
      .catch(() => setChurchRooms([]));
  }, []);

  // Parse time on modal open
  useEffect(() => {
    if (activeGroup) {
      let start = "7:00 PM";
      let end = "8:30 PM";
      if (activeGroup.meeting_time) {
        if (activeGroup.meeting_time.includes("-")) {
          const parts = activeGroup.meeting_time.split("-");
          start = parts[0]?.trim() || "7:00 PM";
          end = parts[1]?.trim() || "";
        } else if (activeGroup.meeting_time.toLowerCase().includes("to")) {
          const parts = activeGroup.meeting_time.split(/to/i);
          start = parts[0]?.trim() || "7:00 PM";
          end = parts[1]?.trim() || "";
        } else {
          start = activeGroup.meeting_time.trim();
          end = "";
        }
      }

      const isCustom = Boolean(activeGroup.location && !churchRooms.includes(activeGroup.location));
      setIsCustomLoc(isCustom);
      setCustomLocText(isCustom ? (activeGroup.location || "") : "");

      setFormData({
        name: activeGroup.name,
        curriculum: activeGroup.curriculum || "",
        current_chapter: activeGroup.current_chapter || "Chapter 1",
        progress_stage: activeGroup.progress_stage || "in_progress",
        progress_notes: activeGroup.progress_notes || "",
        meeting_day: activeGroup.meeting_day || "Wednesday",
        meeting_time_start: start,
        meeting_time_end: end,
        location: activeGroup.location || "",
        description: activeGroup.description || ""
      });
    }
  }, [activeGroup, isEditModalOpen, churchRooms]);



  const handleSaveGroupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;

    if (!formData.name.trim()) {
      showAlert("Group Name Required", "Please enter a group name.", "warning");
      return;
    }

    try {
      setIsSaving(true);
      const formattedMeetingTime = formData.meeting_time_end
        ? `${formData.meeting_time_start} - ${formData.meeting_time_end}`
        : formData.meeting_time_start;

      await api.updateGroup(activeGroup.id, {
        name: formData.name.trim(),
        ...(canManageBooks ? { curriculum: formData.curriculum.trim() || null } : {}),
        current_chapter: formData.current_chapter,
        progress_stage: formData.progress_stage,
        progress_notes: formData.progress_notes.trim(),
        meeting_day: formData.meeting_day,
        meeting_time: formattedMeetingTime,
        location: formData.location ? formData.location.trim() : null,
        description: formData.description ? formData.description.trim() : null
      });

      setSaveSuccessMsg("Small group study details and schedule updated successfully!");
      if (onGroupUpdated) onGroupUpdated();
      setTimeout(() => {
        setSaveSuccessMsg(null);
        setIsEditModalOpen(false);
      }, 1000);
    } catch (err: any) {
      showAlert("Update Failed", err.message || "Failed to update study details", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenReschedule = () => {
    if (!activeGroup) return;
    setIsRescheduleModalOpen(true);
  };

  const handleRevertReschedule = async () => {
    if (!activeGroup) return;
    try {
      await api.rescheduleGroup(activeGroup.id, { is_rescheduled: false });
      if (onGroupUpdated) onGroupUpdated();
    } catch (err: any) {
      showAlert("Revert Failed", err.message || "Failed to revert schedule", "danger");
    }
  };

  const getProgressStageBadge = (stage?: string) => {
    switch (stage) {
      case "intro":
        return {
          label: "Intro / Starting Out",
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          dot: "bg-emerald-500"
        };
      case "midway":
        return {
          label: "Mid-way (Kalahati)",
          bg: "bg-amber-50 text-amber-900 border-amber-200",
          dot: "bg-amber-500"
        };
      case "application":
        return {
          label: "Discussion & Reflection",
          bg: "bg-indigo-50 text-indigo-900 border-indigo-200",
          dot: "bg-indigo-500"
        };
      case "review":
        return { label: "Review / Q&A", bg: "bg-sky-50 text-sky-900 border-sky-200", dot: "bg-sky-500" };
      case "exam":
        return { label: "Exam / Assessment", bg: "bg-amber-50 text-amber-900 border-amber-200", dot: "bg-amber-500" };
      case "completed":
        return { label: "Completed Study", bg: "bg-emerald-50 text-emerald-900 border-emerald-200", dot: "bg-emerald-500" };
      case "chapter_completed":
        return {
          label: "Chapter Finished",
          bg: "bg-sky-50 text-sky-900 border-sky-200",
          dot: "bg-sky-500"
        };
      default:
        return {
          label: "In Progress",
          bg: "bg-indigo-50 text-indigo-900 border-indigo-200",
          dot: "bg-indigo-500"
        };
    }
  };

  if (!activeGroup) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center space-y-3">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">No Life Group Designated Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          You are logged in as a Leader, but no Life Group has been assigned to you. Weekly roll-call attendance, session scheduling, and curriculum tracking will be enabled once your group is designated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reschedule Alert Banner for Leader */}
      {activeGroup.is_rescheduled && (
        <div className="p-4 bg-amber-50 rounded-3xl border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-medium shrink-0 mt-0.5">
              <CalendarClock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-amber-950">Next Session Rescheduled!</h4>
                <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  Temporary
                </span>
              </div>
              <p className="text-xs text-amber-900/90 font-medium mt-0.5">
                Moved to: {activeGroup.rescheduled_date ? new Date(activeGroup.rescheduled_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : "TBD"} ({activeGroup.rescheduled_time || "Time TBD"})
              </p>
              {activeGroup.reschedule_reason && (
                <p className="text-[12px] text-amber-800/80 mt-0.5 italic">
                  "{activeGroup.reschedule_reason}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleOpenReschedule}
              className="px-3.5 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-medium text-xs transition-colors cursor-pointer"
            >
              Edit Resched
            </button>
            <button
              onClick={handleRevertReschedule}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-medium text-xs transition-colors cursor-pointer"
            >
              Revert
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-guide="my-group-rollcall" className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-charcoal">Weekly Small Group Attendance</h3>
              <p className="ui-help mt-1">Choose a session, record the lesson, and mark attendance in the roll-call form.</p>
            </div>
            <button type="button" onClick={onOpenRollCall} data-guide="my-group-save"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer">
              <UserCheck className="w-4 h-4" />Take Weekly Roll-Call
            </button>
          </div>
          <p className="ui-help">{groupDisciples.length} disciples enrolled • {activeGroup.meeting_day} • {activeGroup.meeting_time}</p>
          {groupDisciples.length ? <div className="space-y-2">
            {groupDisciples.map(disciple => <div key={disciple.id} className="p-3 rounded-xl border border-gray-200 text-xs text-charcoal">
              {disciple.member_name || `${disciple.first_name || ""} ${disciple.last_name || ""}`.trim() || "Member"}
            </div>)}
          </div> : <p className="ui-help text-center py-6">No disciples enrolled yet in this group.</p>}
        </div>

        {/* Right 1-Col: Group Settings & Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-medium">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-charcoal">Group Information</h4>
                <p className="text-[12px] text-muted">Schedule & study progress</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block text-[12px] font-medium uppercase">Group Name</span>
                <span className="font-medium text-charcoal text-sm">{activeGroup?.name || "No Assigned Group"}</span>
              </div>

              {/* UNIFIED STUDY TRACK & PACING HUB */}
              <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
                    <div className="truncate">
                      <span className="font-medium text-xs text-charcoal">
                        {activeGroup?.curriculum || "General Scripture Study"}
                      </span>
                      <span className="text-[12px] text-indigo-900 font-medium ml-1.5">
                        • {activeGroup?.current_chapter || "Chapter 1"}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${getProgressStageBadge(activeGroup?.progress_stage).bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getProgressStageBadge(activeGroup?.progress_stage).dot}`}></span>
                    <span>{getProgressStageBadge(activeGroup?.progress_stage).label}</span>
                  </span>
                </div>

                {activeGroup?.progress_notes ? (
                  <div className="bg-white/95 p-2 rounded-xl border border-indigo-100 text-[12px] text-charcoal/80 flex items-start gap-1.5 mt-1">
                    <BookmarkCheck className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      <span className="font-medium text-indigo-950 text-[12px] uppercase tracking-wider block">Lesson Notice & Specific Location:</span>
                      <span className="whitespace-pre-wrap break-words">{activeGroup.progress_notes}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[12px] text-muted italic block">No lesson notice logged</span>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center gap-2 text-charcoal font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo shrink-0" />
                  <span>Meets every <strong>{activeGroup?.meeting_day}</strong> at {activeGroup?.meeting_time}</span>
                </div>
                <div className="flex items-center gap-2 text-charcoal font-medium">
                  <MapPin className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                  <span className="truncate">{activeGroup?.location || "Not specified"}</span>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex-1 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-300" />
                  <span>Update Progress & Schedule</span>
                </button>

                <button
                  onClick={handleOpenReschedule}
                  className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${activeGroup?.is_rescheduled
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
                    : "bg-ivory-light hover:bg-amber-50 text-amber-900 border-amber-200"
                    }`}
                  title="Reschedule next meeting"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{activeGroup?.is_rescheduled ? <>Resched <UIAlertTriangle aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /></> : "Reschedule"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: UPDATE BIBLE STUDY BOOK, CHAPTER PROGRESS & MEETING TIME */}
      {/* ========================================================================= */}
      {isEditModalOpen && activeGroup && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4.5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-800 flex items-center justify-center font-medium">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">Update Study Progress & Schedule</h3>
                  <p className="text-xs text-muted truncate max-w-xs">{activeGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-muted hover:text-charcoal hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form data-guide="leader-study-form" onSubmit={handleSaveGroupDetails} className="space-y-4 text-xs">
              <p className="ui-help">Update the group's current study progress and regular schedule. Record attendance separately for each session.</p>
              <StudyProgressFields
                value={{ book: formData.curriculum, chapter: formData.current_chapter, stage: formData.progress_stage }}
                onChange={value => setFormData(previous => ({ ...previous, curriculum: value.book, current_chapter: value.chapter, progress_stage: value.stage }))}
                topics={studyTopics}
                fallbackBook={activeGroup.curriculum}
                fallbackChapters={activeGroup.curriculum_total_chapters}
                readOnlyBook={!canManageBooks}
                disabled={isSaving}
              />
              <LessonNoticeField value={formData.progress_notes}
                onChange={value => setFormData(previous => ({ ...previous, progress_notes: value }))} disabled={isSaving} />

              {/* Schedule: Meeting Day, Time In (Start Time), Time Out (End Time / end_time) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Meeting Day *</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs h-[41px]"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div>
                  <TimePickerInput
                    label="Time In (Start Time) *"
                    value={formData.meeting_time_start}
                    onChange={(val) => setFormData({ ...formData, meeting_time_start: val })}
                    placeholder="e.g. 7:00 PM"
                    required
                  />
                </div>

                <div>
                  <TimePickerInput
                    label="Time Out (End Time) *"
                    value={formData.meeting_time_end}
                    onChange={(val) => setFormData({ ...formData, meeting_time_end: val })}
                    placeholder="e.g. 8:30 PM"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-charcoal/70 text-xs">Location / Meeting Venue</label>
                  <span className="text-[12px] text-indigo-700 font-medium">Database Rooms</span>
                </div>
                <select
                  value={isCustomLoc ? "__custom__" : formData.location}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomLoc(true);
                      setFormData({ ...formData, location: customLocText });
                    } else {
                      setIsCustomLoc(false);
                      setFormData({ ...formData, location: e.target.value });
                    }
                  }}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-medium text-charcoal cursor-pointer"
                >
                  <option value="">-- Select Church Room / Venue --</option>
                  {churchRooms.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  {formData.location && !churchRooms.includes(formData.location) && (
                    <option value={formData.location}>{formData.location} (Current Venue)</option>
                  )}
                  <option value="__custom__">+ Custom / Off-Site Location...</option>
                </select>

                {isCustomLoc && (
                  <input
                    type="text"
                    placeholder="e.g. Bro John's Residence (Daet), Google Meet, Cafe Rooftop"
                    value={customLocText}
                    onChange={(e) => {
                      setCustomLocText(e.target.value);
                      setFormData({ ...formData, location: e.target.value });
                    }}
                    className="w-full mt-2 bg-white p-2.5 rounded-xl border border-indigo-300 focus:outline-none focus:border-indigo text-xs font-medium animate-in fade-in"
                  />
                )}
              </div>

              {/* Footer Actions */}
              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>{isSaving ? "Saving..." : "Save Study Changes"}</span>
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESCHEDULE NEXT SESSION (WITH ROOM & DAY AVAILABILITY INSPECTOR) */}
      {/* ========================================================================= */}
      <BibleStudyRescheduleModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        group={activeGroup}
        onSaved={() => {
          if (onGroupUpdated) onGroupUpdated();
        }}
        showToast={(msg, type) => {
          showAlert(type === "error" ? "Reschedule Notice" : "Schedule Updated", msg, type === "error" ? "danger" : "success");
        }}
      />

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
