import React from "react";
import { BibleStudyGroup, BibleStudyMember, StudyTopic, SaturdayDutyScheduleItem, SundayDutyScheduleItem } from "../../types";
import {
  Users, Clock, BookmarkCheck, MessageSquare, MapPin,
  UserCheck, Plus, BookOpen, ArrowRight,
  CalendarCheck, Utensils, AlertCircle, Sparkles
} from "lucide-react";
import { TodayBibleReadingWidget } from "../../components/common/TodayBibleReadingWidget";

interface LeaderDashboardProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  studyTopics: StudyTopic[];
  designatedDuties?: SaturdayDutyScheduleItem[];
  designatedDishwashing?: SundayDutyScheduleItem[];
  isMemberView?: boolean;
  onNavigateTab: (tab: "dashboard" | "members" | "biblestudy") => void;
}

export const LeaderDashboard: React.FC<LeaderDashboardProps> = ({
  activeGroup,
  groupDisciples,
  studyTopics,
  designatedDuties = [],
  designatedDishwashing = [],
  isMemberView = false,
  onNavigateTab
}) => {
  return (
    <div className="space-y-6">
      {/* Daily Bible Reading Today Widget */}
      <TodayBibleReadingWidget />

      {/* If No Group Designated Banner */}
      {!activeGroup && (
        <div className="p-6 bg-gradient-to-r from-sky-50 via-indigo-50 to-sky-50 rounded-3xl border border-sky-200 text-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">
                {isMemberView ? "No Enrolled Life Group Yet" : "No Led Life Group Designated Yet"}
              </h3>
              <p className="text-xs text-slate-600">
                {isMemberView
                  ? "You are not currently enrolled as an attendee in any Life Group fellowship."
                  : "You do not currently have a Life Group assigned to lead."}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 pl-13">
            {isMemberView
              ? "Join a Bible study small group to connect with fellow church members, study Scripture together, and share prayer requests."
              : "Once an Administrator or Ministry Coordinator designates your Life Group, your assigned members, meeting attendance roll-call, and curriculum will appear here."}
          </p>
        </div>
      )}

      {/* Quick Metrics Grid (Only when group is designated) */}
      {activeGroup && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isMemberView ? (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Group Leader</span>
                <Users className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 mt-1 truncate">
                {activeGroup.leader_name || "Assigned Leader"}
              </div>
              <p className="text-[10px] text-sky-700 font-bold mt-0.5 truncate">{activeGroup.leader_contact || "Group Leader"}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Group Members</span>
                <Users className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {groupDisciples.length} <span className="text-xs font-normal text-slate-400">/ {activeGroup.max_capacity || 12} max</span>
              </div>
              <p className="text-[10px] text-sky-700 font-bold mt-0.5">{activeGroup.category || "General"}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Meeting Schedule</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-1">
              {activeGroup.meeting_day || "Wednesday"}
            </div>
            <p className="text-[10px] text-emerald-700 font-bold mt-0.5">{activeGroup.meeting_time || "7:00 PM"}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Active Curriculum</span>
              <BookmarkCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-1 truncate">
              {activeGroup.curriculum || "General Study"}
            </div>
            <p className="text-[10px] text-indigo-700 font-bold mt-0.5">{studyTopics.length} Study Topics</p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                {isMemberView ? "Fellow Members" : "Group Prayers"}
              </span>
              <MessageSquare className="w-4 h-4 text-amber-600" />
            </div>

            <p className="text-[10px] text-amber-700 font-bold mt-0.5">
              {isMemberView ? "Active attendees" : "Active requests"}
            </p>
          </div>
        </div>
      )}

      {/* Group Meeting Details & Next Session Card */}
      {activeGroup && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-sky-50 text-sky-800 text-xs font-bold border border-sky-100">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>Location: {activeGroup.location}</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">{activeGroup.name}</h3>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              {activeGroup.description || "Weekly Bible study group focused on spiritual growth, biblical literacy, fellowship, and mutual discipleship."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isMemberView && (
              <button
                onClick={() => onNavigateTab("biblestudy")}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-amber-300" />
                <span>Take Meeting Attendance</span>
              </button>
            )}
            <button
              onClick={() => onNavigateTab("members")}
              className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-indigo-700" />
              <span>{isMemberView ? "View Roster" : "Manage Disciples"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Designated Rosters & Church Service Assignments (Only in Leader View) */}
      {!isMemberView && (designatedDuties.length > 0 || designatedDishwashing.length > 0) && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Your Designated Church Service & Duty Rosters</h4>
              <p className="text-[11px] text-slate-500">Upcoming Saturday Sanctuary and Sunday Fellowship Duties assigned to you</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Saturday Duty */}
            {designatedDuties.map((d, idx) => (
              <div key={`duty-${d.duty_date}-${d.team?.id || idx}`} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-black text-[10px] flex items-center gap-1">
                    <CalendarCheck className="w-3 h-3 text-indigo-700" />
                    Saturday Duty
                  </span>
                  <span className="text-xs font-bold text-indigo-950">{d.duty_date ? new Date(d.duty_date).toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" }) : "Scheduled"}</span>
                </div>
                <div className="font-bold text-xs text-slate-900">{d.team?.name || "Sanctuary Duty Team"}</div>
                <p className="text-[11px] text-slate-600">{d.team?.tasks_checklist || "Sanctuary cleaning, audio check, restrooms sanitization"}</p>
              </div>
            ))}

            {/* Sunday Dishwashing */}
            {designatedDishwashing.map((d, idx) => (
              <div key={`dish-${d.duty_date}-${d.team?.id || idx}`} className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 font-black text-[10px] flex items-center gap-1">
                    <Utensils className="w-3 h-3 text-teal-700" />
                    Sunday Dishwashing
                  </span>
                  <span className="text-xs font-bold text-teal-950">{d.duty_date ? new Date(d.duty_date).toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" }) : "Scheduled"}</span>
                </div>
                <div className="font-bold text-xs text-slate-900">{d.team?.name || "Fellowship Kitchen Crew"}</div>
                <p className="text-[11px] text-slate-600">{d.team?.tasks_checklist || "Plate washing, sanitize, drying rack storage, kitchen wipedown"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column: Members List Preview & Curriculum Progress */}
      {activeGroup && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Group Members Roster */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {isMemberView ? `Fellow Members (${groupDisciples.length})` : `Group Members (${groupDisciples.length})`}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isMemberView ? `Enrolled members in ${activeGroup.name}` : `Assigned members in ${activeGroup.name}`}
                  </p>
                </div>
              </div>

              {!isMemberView && (
                <button
                  onClick={() => onNavigateTab("members")}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {groupDisciples.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">
                  No members assigned to this group yet. Click "Group Members" tab to add.
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
                          <div className="font-bold text-xs text-slate-900">{displayName}</div>
                          <div className="text-[10px] text-slate-500">{d.contact_phone || "No phone listed"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Curriculum Chapter Progress */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Curriculum & Bible Topics</h4>
                  <p className="text-[11px] text-slate-500">Track chapter reading and discussions</p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab("biblestudy")}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
              >
                <span>Curriculum</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {studyTopics.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">
                  No curriculum topics assigned.
                </p>
              ) : (
                studyTopics.slice(0, 4).map((topic) => {
                  return (
                    <div key={topic.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-slate-900">{topic.title}</div>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {topic.total_chapters} Chapters
                        </span>
                      </div>

                      {topic.summary_notes && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {topic.summary_notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-slate-500 text-[10px] italic">
                          Leader: {activeGroup.leader_name || "Leader"}
                        </span>
                        <button
                          onClick={() => onNavigateTab("biblestudy")}
                          className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Details &rarr;</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
