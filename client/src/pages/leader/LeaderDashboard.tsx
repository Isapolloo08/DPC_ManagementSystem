import React from "react";
import { BibleStudyGroup, BibleStudyMember, PrayerRequest, StudyTopic } from "../../types";
import { 
  Users, Clock, BookmarkCheck, MessageSquare, MapPin, 
  UserCheck, Plus, HeartHandshake, BookOpen, ArrowRight 
} from "lucide-react";

interface LeaderDashboardProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  prayers: PrayerRequest[];
  studyTopics: StudyTopic[];
  onNavigateTab: (tab: "dashboard" | "members" | "biblestudy") => void;
  onOpenPrayerModal: (member?: BibleStudyMember) => void;
  onAdvanceChapter: (topic: StudyTopic) => void;
}

export const LeaderDashboard: React.FC<LeaderDashboardProps> = ({
  activeGroup,
  groupDisciples,
  prayers,
  studyTopics,
  onNavigateTab,
  onOpenPrayerModal,
  onAdvanceChapter
}) => {
  return (
    <div className="space-y-6">
      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-charcoal/60 uppercase">Group Disciples</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-charcoal mt-1">
            {groupDisciples.length} <span className="text-xs font-normal text-charcoal/50">/ {activeGroup?.max_capacity || 12} max</span>
          </div>
          <p className="text-[10px] text-sky-700 font-bold mt-0.5">{activeGroup?.category || "General"}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-charcoal/60 uppercase">Meeting Schedule</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-charcoal mt-1">
            {activeGroup?.meeting_day || "Wednesday"}
          </div>
          <p className="text-[10px] text-emerald-700 font-bold mt-0.5">{activeGroup?.meeting_time || "7:00 PM"}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-charcoal/60 uppercase">Active Curriculum</span>
            <BookmarkCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-charcoal mt-1 truncate">
            {activeGroup?.curriculum || "Gospel of John"}
          </div>
          <p className="text-[10px] text-indigo-700 font-bold mt-0.5">{studyTopics.length} Study Topics</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-charcoal/60 uppercase">Group Prayers</span>
            <MessageSquare className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-charcoal mt-1">
            {prayers.length}
          </div>
          <p className="text-[10px] text-amber-700 font-bold mt-0.5">Active requests</p>
        </div>
      </div>

      {/* Group Meeting Details & Next Session Card */}
      {activeGroup && (
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-sky-50 text-sky-800 text-xs font-bold border border-sky-100">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>Location: {activeGroup.location}</span>
            </div>
            <h3 className="text-xl font-black text-charcoal">{activeGroup.name}</h3>
            <p className="text-xs text-charcoal/70 max-w-xl leading-relaxed">
              {activeGroup.description || "Weekly Bible study group focused on spiritual growth, biblical literacy, fellowship, and mutual discipleship."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigateTab("biblestudy")}
              className="px-4 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-amber-300" />
              <span>Take Meeting Attendance</span>
            </button>

            <button
              onClick={() => onOpenPrayerModal()}
              className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>Post Group Prayer</span>
            </button>
          </div>
        </div>
      )}

      {/* 2-Column: Disciples List Preview & Curriculum Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Group Disciples Roster */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-charcoal">Group Disciples ({groupDisciples.length})</h4>
                <p className="text-[11px] text-charcoal/50">Assigned disciples under your care</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab("members")}
              className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {groupDisciples.length === 0 ? (
              <p className="text-xs text-charcoal/50 py-6 text-center italic">
                No disciples assigned to this group yet. Click "Members" tab to add.
              </p>
            ) : (
              groupDisciples.slice(0, 5).map((d) => {
                const displayName = d.member_name || `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Member";
                const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "M";

                return (
                  <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-900 flex items-center justify-center font-black text-xs">
                        {initials}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-charcoal">{displayName}</div>
                        <div className="text-[10px] text-charcoal/50">{d.contact_phone || "No phone listed"}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenPrayerModal(d)}
                      className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-amber-50 text-charcoal/70 hover:text-amber-800 text-[11px] font-bold border border-gray-100 transition-all flex items-center gap-1"
                    >
                      <HeartHandshake className="w-3 h-3 text-amber-600" />
                      <span>Pray</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Curriculum Chapter Progress */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-charcoal">Curriculum & Bible Topics</h4>
                <p className="text-[11px] text-charcoal/50">Track chapter reading and discussions</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab("biblestudy")}
              className="text-xs font-bold text-indigo hover:text-indigo-900 flex items-center gap-1"
            >
              <span>Curriculum</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {studyTopics.length === 0 ? (
              <p className="text-xs text-charcoal/50 py-6 text-center italic">
                No curriculum topics assigned.
              </p>
            ) : (
              studyTopics.slice(0, 4).map((topic) => {
                const pct = topic.total_chapters > 0 
                  ? Math.round((topic.completed_chapters / topic.total_chapters) * 100)
                  : 0;

                return (
                  <div key={topic.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-charcoal">{topic.title}</div>
                      <span className="text-[10px] font-bold text-indigo bg-indigo-50 px-2 py-0.5 rounded-md">
                        {topic.completed_chapters} / {topic.total_chapters} Ch. ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-sky-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-charcoal/50 text-[10px] italic">
                        Lead: {topic.lead_teacher || activeGroup?.leader_name || "Leader"}
                      </span>
                      <button
                        onClick={() => onAdvanceChapter(topic)}
                        className="text-xs font-bold text-indigo hover:underline flex items-center gap-1"
                      >
                        <span>+1 Chapter</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
