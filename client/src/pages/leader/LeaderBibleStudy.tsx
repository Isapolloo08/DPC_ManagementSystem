import React, { useState, useEffect, useMemo, useRef } from "react";
import { BibleStudyGroup, BibleStudyMember } from "../../types";
import { api } from "../../api";
import { TimePickerInput } from "../../components/common/TimePickerInput";
import {
  UserCheck, Calendar, Check, CheckCircle2, BookOpen,
  Edit, Bookmark, BookmarkCheck, Sparkles, MapPin,
  Clock, ShieldCheck, X, ChevronDown, Layers,
  CalendarClock
} from "lucide-react";

interface LeaderBibleStudyProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  onSaveAttendanceSession: (date: string, checkedMemberIds: number[]) => void;
  onGroupUpdated?: () => void;
}

export const LeaderBibleStudy: React.FC<LeaderBibleStudyProps> = ({
  activeGroup,
  groupDisciples,
  onSaveAttendanceSession,
  onGroupUpdated
}) => {
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkedMembers, setCheckedMembers] = useState<Record<number, boolean>>({});
  const [sessionSavedSuccess, setSessionSavedSuccess] = useState(false);

  // Edit Study & Book Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  // Curriculum Searchable Dropdown State
  const [curriculumQuery, setCurriculumQuery] = useState("");
  const [isCurriculumDropdownOpen, setIsCurriculumDropdownOpen] = useState(false);
  const curriculumRef = useRef<HTMLDivElement>(null);

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
  }, [activeGroup, isEditModalOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (curriculumRef.current && !curriculumRef.current.contains(e.target as Node)) {
        setIsCurriculumDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const churchCurricula = [
    { title: "Gospel of John", type: "bible_book", category: "New Testament" },
    { title: "Book of Romans", type: "bible_book", category: "New Testament" },
    { title: "Gospel of Matthew", type: "bible_book", category: "New Testament" },
    { title: "Gospel of Mark", type: "bible_book", category: "New Testament" },
    { title: "Gospel of Luke", type: "bible_book", category: "New Testament" },
    { title: "Acts of the Apostles", type: "bible_book", category: "New Testament" },
    { title: "Genesis: Beginnings of Faith", type: "bible_book", category: "Old Testament" },
    { title: "Psalms of Worship & Praise", type: "bible_book", category: "Old Testament" },
    { title: "Proverbs: Daily Wisdom", type: "bible_book", category: "Old Testament" },
    { title: "Ephesians: Riches of Grace", type: "bible_book", category: "New Testament" },
    { title: "Philippians: Joy in Christ", type: "bible_book", category: "New Testament" },
    { title: "Hebrews: Supreme Christ", type: "bible_book", category: "New Testament" },
    { title: "James: Practical Faith", type: "bible_book", category: "New Testament" },
    { title: "Discipleship 101: Foundations", type: "curriculum", category: "Topical Track" },
    { title: "Sacred Marriage by Gary Thomas", type: "curriculum", category: "Family & Marriage" },
    { title: "The Cost of Discipleship", type: "curriculum", category: "Discipleship Track" },
    { title: "Life of Prayer & Fasting", type: "curriculum", category: "Spiritual Disciplines" }
  ];

  const filteredCurricula = useMemo(() => {
    const q = curriculumQuery.toLowerCase().trim();
    if (!q) return churchCurricula;
    return churchCurricula.filter(c =>
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [curriculumQuery]);

  const handleSaveAttendance = () => {
    const presentIds = Object.keys(checkedMembers)
      .filter(id => checkedMembers[Number(id)])
      .map(id => Number(id));

    onSaveAttendanceSession(sessionDate, presentIds);
    setSessionSavedSuccess(true);
    setTimeout(() => setSessionSavedSuccess(false), 3000);
  };

  const handleSaveGroupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;

    try {
      setIsSaving(true);
      const formattedMeetingTime = formData.meeting_time_end
        ? `${formData.meeting_time_start} - ${formData.meeting_time_end}`
        : formData.meeting_time_start;

      await api.updateGroup(activeGroup.id, {
        name: formData.name,
        curriculum: formData.curriculum,
        current_chapter: formData.current_chapter,
        progress_stage: formData.progress_stage,
        progress_notes: formData.progress_notes,
        meeting_day: formData.meeting_day,
        meeting_time: formattedMeetingTime,
        location: formData.location,
        description: formData.description
      });

      setSaveSuccessMsg("✓ Small group study details and schedule updated successfully!");
      if (onGroupUpdated) onGroupUpdated();
      setTimeout(() => {
        setSaveSuccessMsg(null);
        setIsEditModalOpen(false);
      }, 1000);
    } catch (err: any) {
      alert(err.message || "Failed to update study details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenReschedule = () => {
    if (!activeGroup) return;
    let start = "7:00 PM";
    let end = "8:30 PM";
    if (activeGroup.rescheduled_time) {
      if (activeGroup.rescheduled_time.includes("-")) {
        const parts = activeGroup.rescheduled_time.split("-");
        start = parts[0]?.trim() || "7:00 PM";
        end = parts[1]?.trim() || "";
      } else {
        start = activeGroup.rescheduled_time.trim();
        end = "";
      }
    } else if (activeGroup.meeting_time) {
      if (activeGroup.meeting_time.includes("-")) {
        const parts = activeGroup.meeting_time.split("-");
        start = parts[0]?.trim() || "7:00 PM";
        end = parts[1]?.trim() || "";
      }
    }

    const defaultDate = activeGroup.rescheduled_date || new Date(Date.now() + 86400000).toISOString().split("T")[0];

    setRescheduleData({
      is_rescheduled: activeGroup.is_rescheduled !== undefined ? Boolean(activeGroup.is_rescheduled) : true,
      rescheduled_date: defaultDate,
      rescheduled_time_start: start,
      rescheduled_time_end: end,
      reschedule_reason: activeGroup.reschedule_reason || ""
    });
    setIsRescheduleModalOpen(true);
  };

  const handleSaveReschedule = async (e?: React.FormEvent, forceRevert = false) => {
    if (e) e.preventDefault();
    if (!activeGroup) return;

    try {
      setIsSavingReschedule(true);
      const isRescheduled = forceRevert ? false : rescheduleData.is_rescheduled;
      const formattedTime = rescheduleData.rescheduled_time_end
        ? `${rescheduleData.rescheduled_time_start} - ${rescheduleData.rescheduled_time_end}`
        : rescheduleData.rescheduled_time_start;

      await api.rescheduleGroup(activeGroup.id, {
        is_rescheduled: isRescheduled,
        rescheduled_date: isRescheduled ? rescheduleData.rescheduled_date : null,
        rescheduled_time: isRescheduled ? formattedTime : null,
        reschedule_reason: isRescheduled ? rescheduleData.reschedule_reason : null
      });

      if (onGroupUpdated) onGroupUpdated();
      setIsRescheduleModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to update reschedule status");
    } finally {
      setIsSavingReschedule(false);
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
      case "completed":
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

  return (
    <div className="space-y-6">
      {/* Reschedule Alert Banner for Leader */}
      {activeGroup?.is_rescheduled && (
        <div className="p-4 bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 rounded-3xl border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
              <CalendarClock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm text-amber-950">Next Session Rescheduled!</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  Temporary
                </span>
              </div>
              <p className="text-xs text-amber-900/90 font-bold mt-0.5">
                Moved to: {activeGroup.rescheduled_date ? new Date(activeGroup.rescheduled_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : "TBD"} ({activeGroup.rescheduled_time || "Time TBD"})
              </p>
              {activeGroup.reschedule_reason && (
                <p className="text-[11px] text-amber-800/80 mt-0.5 italic">
                  "{activeGroup.reschedule_reason}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleOpenReschedule}
              className="px-3.5 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-xs transition-colors cursor-pointer"
            >
              Edit Resched
            </button>
            <button
              onClick={() => handleSaveReschedule(undefined, true)}
              disabled={isSavingReschedule}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Revert
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Cols: Weekly Meeting Attendance Logger */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-charcoal">
                  Weekly Small Group Attendance Roll-Call
                </h3>
                <p className="text-[11px] text-charcoal/50">
                  Check off disciples present for this week's Bible study session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo" />
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="text-xs font-bold text-charcoal border border-gray-200 px-2.5 py-1 rounded-xl outline-none cursor-pointer"
              />
            </div>
          </div>

          {sessionSavedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Attendance successfully recorded for {sessionDate}!</span>
            </div>
          )}

          {/* Attendance Checkbox List */}
          <div className="space-y-2">
            {groupDisciples.length === 0 ? (
              <div className="text-center py-10 bg-ivory-light rounded-2xl border border-dashed border-gray-200 space-y-2">
                <Users className="w-8 h-8 text-charcoal/30 mx-auto" />
                <p className="text-xs font-bold text-charcoal/70">No disciples enrolled yet in this group</p>
                <p className="text-[11px] text-charcoal/50 max-w-xs mx-auto">
                  Click on the "Members" tab to add disciples to this Small Group.
                </p>
              </div>
            ) : (
              groupDisciples.map((d) => {
                const isChecked = Boolean(checkedMembers[d.id]);
                const displayName = d.member_name || `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Member";

                return (
                  <div
                    key={d.id}
                    onClick={() => setCheckedMembers(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                        : "bg-gray-50/60 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                        isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-300 bg-white"
                      }`}>
                        {isChecked && <Check className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-charcoal">{displayName}</div>
                        <div className="text-[10px] text-charcoal/50">{d.contact_phone || "Member"}</div>
                      </div>
                    </div>

                    <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                      isChecked ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-charcoal/50"
                    }`}>
                      {isChecked ? "Present" : "Absent"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-charcoal/60">
              {Object.values(checkedMembers).filter(Boolean).length} / {groupDisciples.length} Disciples Present
            </span>

            <button
              onClick={handleSaveAttendance}
              className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4 text-amber-300" />
              <span>Save Session Attendance</span>
            </button>
          </div>
        </div>

        {/* Right 1-Col: Group Settings & Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-charcoal">Group Information</h4>
                <p className="text-[11px] text-charcoal/50">Schedule & study progress</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-charcoal/50 block text-[10px] font-bold uppercase">Group Name</span>
                <span className="font-black text-charcoal text-sm">{activeGroup?.name || "No Assigned Group"}</span>
              </div>

              {/* UNIFIED STUDY TRACK & PACING HUB */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 via-ivory to-amber-50/40 rounded-2xl border border-indigo-100 space-y-2.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
                    <div className="truncate">
                      <span className="font-black text-xs text-charcoal">
                        {activeGroup?.curriculum || "General Scripture Study"}
                      </span>
                      <span className="text-[11px] text-indigo-900 font-bold ml-1.5">
                        • {activeGroup?.current_chapter || "Chapter 1"}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${getProgressStageBadge(activeGroup?.progress_stage).bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getProgressStageBadge(activeGroup?.progress_stage).dot}`}></span>
                    <span>{getProgressStageBadge(activeGroup?.progress_stage).label}</span>
                  </span>
                </div>

                {activeGroup?.progress_notes ? (
                  <div className="bg-white/95 p-2 rounded-xl border border-indigo-100 text-[11px] text-charcoal/80 flex items-start gap-1.5 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      <span className="font-bold text-indigo-950 text-[10px] uppercase tracking-wider block">Current Notice:</span>
                      <span>{activeGroup.progress_notes}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-charcoal/40 italic block">No lesson notice logged</span>
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
                  className="flex-1 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-300" />
                  <span>Update Book & Progress</span>
                </button>

                <button
                  onClick={handleOpenReschedule}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                    activeGroup?.is_rescheduled
                      ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
                      : "bg-ivory-light hover:bg-amber-50 text-amber-900 border-amber-200"
                  }`}
                  title="Reschedule next meeting"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{activeGroup?.is_rescheduled ? "Resched ⚠️" : "Reschedule"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: UPDATE BIBLE STUDY BOOK, CHAPTER PROGRESS & MEETING TIME */}
      {/* ========================================================================= */}
      {isEditModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4.5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-800 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-charcoal">Update Bible Study & Curriculum</h3>
                  <p className="text-xs text-charcoal/60 truncate max-w-xs">{activeGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveGroupDetails} className="space-y-4 text-xs">
              {/* Book / Study Topic Searchable Dropdown */}
              <div ref={curriculumRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-charcoal/70 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>Book / Study Topic *</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 font-semibold">Select or type custom</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search Bible book or topic (e.g. Gospel of John, Romans, Discipleship 101)"
                    value={formData.curriculum}
                    onFocus={() => {
                      setCurriculumQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onClick={() => {
                      setCurriculumQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setFormData({ ...formData, curriculum: e.target.value });
                      setCurriculumQuery(e.target.value);
                      setIsCurriculumDropdownOpen(true);
                    }}
                    className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-charcoal"
                  />
                  {formData.curriculum && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, curriculum: "" }));
                        setCurriculumQuery("");
                        setIsCurriculumDropdownOpen(true);
                      }}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsCurriculumDropdownOpen(!isCurriculumDropdownOpen)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-indigo p-0.5 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isCurriculumDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {isCurriculumDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-indigo-50/80 text-[10px] font-bold text-indigo-950 uppercase tracking-wider sticky top-0 z-10">
                      Bible Books & Curricula ({filteredCurricula.length})
                    </div>
                    {filteredCurricula.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, curriculum: item.title }));
                          setCurriculumQuery("");
                          setIsCurriculumDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-50/70 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-charcoal group-hover:text-indigo text-xs flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-indigo-100 text-indigo-800 ml-5">
                            {item.category}
                          </span>
                        </div>
                        {formData.curriculum === item.title && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Study Chapter Progress & Notice Section */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 to-ivory rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Current Chapter & Study Progress</span>
                  </label>
                  <span className="text-[10px] text-charcoal/50">Where the group is studying</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal/70 mb-1">
                      What Chapter / Lesson na sila? *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chapter 1, Introduction, Lesson 3"
                      value={formData.current_chapter}
                      onChange={(e) => setFormData({ ...formData, current_chapter: e.target.value })}
                      className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-charcoal"
                    />
                    {/* Quick Chips */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {["Intro", "Ch 1", "Ch 2", "Ch 3", "Ch 4", "Ch 5", "Review"].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setFormData({ ...formData, current_chapter: chip === "Intro" ? "Introduction" : chip.replace("Ch", "Chapter") })}
                          className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 border border-gray-200 text-[10px] font-semibold text-charcoal/70 hover:text-indigo transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal/70 mb-1">
                      Study Stage (Nasaan sila banda?)
                    </label>
                    <select
                      value={formData.progress_stage}
                      onChange={(e) => setFormData({ ...formData, progress_stage: e.target.value })}
                      className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-semibold text-charcoal h-[41px]"
                    >
                      <option value="intro">🟢 Intro / Just Starting (No. 1 pa lang)</option>
                      <option value="midway">🟡 Mid-way (Kalahati pa lang ng Chapter)</option>
                      <option value="application">🟠 Discussion & Reflection Questions</option>
                      <option value="completed">🔵 Chapter Completed / Ready for Next</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-charcoal/70 mb-1">
                    Lesson Notice & Specific Location (Saan Banda Sila)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Maglagay ng notice o detalye (e.g., 'Nasa Chapter 1 verses 1-17 palang kami, natapos ang overview', 'Nasa Question #3 ng study guide')..."
                    value={formData.progress_notes}
                    onChange={(e) => setFormData({ ...formData, progress_notes: e.target.value })}
                    className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>
              </div>

              {/* Schedule: Meeting Day, Time In (Start Time), Time Out (End Time / end_time) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Meeting Day *</label>
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
                <label className="block font-bold text-charcoal/70 mb-1">Location / Meeting Venue</label>
                <input
                  type="text"
                  placeholder="e.g. Sanctuary Library Room 201, Online Zoom"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>{isSaving ? "Saving..." : "Save Study Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESCHEDULE NEXT SESSION (LEADER PORTAL) */}
      {/* ========================================================================= */}
      {isRescheduleModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-amber-200 space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <CalendarClock className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-black text-base text-charcoal">Reschedule Bible Study Session</h3>
                  <p className="text-xs text-charcoal/60 truncate max-w-xs">{activeGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsRescheduleModalOpen(false)}
                className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Regular Schedule Reference Banner */}
            <div className="p-3 bg-ivory rounded-2xl border border-amber-200/60 text-xs flex items-center justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-charcoal/50 uppercase block">Regular Weekly Schedule</span>
                <span className="font-bold text-charcoal">
                  Every {activeGroup.meeting_day} at {activeGroup.meeting_time}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-charcoal/50 uppercase block">Meeting Location</span>
                <span className="font-bold text-charcoal">{activeGroup.location}</span>
              </div>
            </div>

            <form onSubmit={(e) => handleSaveReschedule(e, false)} className="space-y-4 text-xs">
              {/* Status Mode Selector */}
              <div>
                <label className="block font-bold text-charcoal/70 mb-1.5">
                  Reschedule Status:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setRescheduleData({ ...rescheduleData, is_rescheduled: true })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      rescheduleData.is_rescheduled
                        ? "bg-amber-50/90 border-amber-400 ring-1 ring-amber-400 text-amber-950 font-bold"
                        : "bg-ivory-light border-gray-200 text-charcoal/70 hover:border-gray-300"
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      {rescheduleData.is_rescheduled && <div className="w-2 h-2 rounded-full bg-amber-600"></div>}
                    </div>
                    <div>
                      <div className="text-xs font-bold">⚠️ Reschedule Active</div>
                      <div className="text-[10px] text-amber-800/80 font-normal mt-0.5">Move next meeting to a new date/time</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setRescheduleData({ ...rescheduleData, is_rescheduled: false })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      !rescheduleData.is_rescheduled
                        ? "bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-400 text-emerald-950 font-bold"
                        : "bg-ivory-light border-gray-200 text-charcoal/70 hover:border-gray-300"
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      {!rescheduleData.is_rescheduled && <div className="w-2 h-2 rounded-full bg-emerald-600"></div>}
                    </div>
                    <div>
                      <div className="text-xs font-bold">✓ Regular Schedule</div>
                      <div className="text-[10px] text-emerald-800/80 font-normal mt-0.5">Follow normal meeting schedule</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditional Reschedule Inputs */}
              {rescheduleData.is_rescheduled && (
                <div className="space-y-3.5 p-3.5 bg-gradient-to-br from-amber-50/60 to-ivory rounded-2xl border border-amber-200/80 animate-in fade-in">
                  {/* New Date Picker */}
                  <div>
                    <label className="block font-bold text-amber-950 mb-1">
                      New Rescheduled Meeting Date *
                    </label>
                    <input
                      type="date"
                      required={rescheduleData.is_rescheduled}
                      value={rescheduleData.rescheduled_date}
                      onChange={(e) => setRescheduleData({ ...rescheduleData, rescheduled_date: e.target.value })}
                      className="w-full bg-white p-2.5 rounded-xl border border-amber-300 focus:outline-none focus:border-amber-500 font-bold text-charcoal text-xs cursor-pointer"
                    />
                  </div>

                  {/* Time In & Time Out using TimePickerInput */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <TimePickerInput
                        label="New Time In (Start Time) *"
                        value={rescheduleData.rescheduled_time_start}
                        onChange={(val) => setRescheduleData({ ...rescheduleData, rescheduled_time_start: val })}
                        placeholder="e.g. 6:30 PM"
                        required
                      />
                    </div>
                    <div>
                      <TimePickerInput
                        label="New Time Out (End Time)"
                        value={rescheduleData.rescheduled_time_end}
                        onChange={(val) => setRescheduleData({ ...rescheduleData, rescheduled_time_end: val })}
                        placeholder="e.g. 8:00 PM"
                      />
                    </div>
                  </div>

                  {/* Quick Reason Chips */}
                  <div>
                    <label className="block font-bold text-amber-950 mb-1">
                      Reason / Notice for Disciples *
                    </label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {[
                        "🌧️ Typhoon / Bad Weather",
                        "✈️ Leader Travel / Ministry Duty",
                        "⛪ Church-Wide Event / Holiday",
                        "👥 Member Request & Agreement",
                        "🏠 Venue Maintenance / Setup"
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setRescheduleData({ ...rescheduleData, reschedule_reason: chip })}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-[10px] font-semibold text-amber-950 transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={2}
                      required={rescheduleData.is_rescheduled}
                      placeholder="e.g. 'Naurong po ang ating meeting sa Friday dahil may church conference sa Miyerkules. Kitakits sa Friday 6:30 PM!'..."
                      value={rescheduleData.reschedule_reason}
                      onChange={(e) => setRescheduleData({ ...rescheduleData, reschedule_reason: e.target.value })}
                      className="w-full bg-white p-2.5 rounded-xl border border-amber-300 focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRescheduleModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  {activeGroup.is_rescheduled && (
                    <button
                      type="button"
                      onClick={() => handleSaveReschedule(undefined, true)}
                      disabled={isSavingReschedule}
                      className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                      title="Clear reschedule and revert to regular schedule"
                    >
                      Clear Reschedule
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSavingReschedule}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSavingReschedule
                      ? "Saving..."
                      : rescheduleData.is_rescheduled
                      ? "Save Rescheduled Session"
                      : "Save Regular Schedule"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
