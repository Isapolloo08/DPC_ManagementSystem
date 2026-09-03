import React, { useState } from "react";
import { BibleStudyGroup, BibleStudyMember } from "../../types";
import { UserCheck, Calendar, Check, CheckCircle2, BookOpen } from "lucide-react";

interface LeaderBibleStudyProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  onSaveAttendanceSession: (date: string, checkedMemberIds: number[]) => void;
}

export const LeaderBibleStudy: React.FC<LeaderBibleStudyProps> = ({
  activeGroup,
  groupDisciples,
  onSaveAttendanceSession
}) => {
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkedMembers, setCheckedMembers] = useState<Record<number, boolean>>({});
  const [sessionSavedSuccess, setSessionSavedSuccess] = useState(false);

  const handleSave = () => {
    const presentIds = Object.keys(checkedMembers)
      .filter(id => checkedMembers[Number(id)])
      .map(id => Number(id));

    onSaveAttendanceSession(sessionDate, presentIds);
    setSessionSavedSuccess(true);
    setTimeout(() => setSessionSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-charcoal/50 py-8 text-center italic">
                No members in this group yet. Add members in the "Members" tab.
              </p>
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
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 text-amber-300" />
              <span>Save Session Attendance</span>
            </button>
          </div>
        </div>

        {/* Right 1-Col: Group Settings & Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-charcoal">Group Information</h4>
                <p className="text-[11px] text-charcoal/50">Schedule and location parameters</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-charcoal/50 block text-[10px] font-bold uppercase">Group Name</span>
                <span className="font-black text-charcoal text-sm">{activeGroup?.name}</span>
              </div>

              <div>
                <span className="text-charcoal/50 block text-[10px] font-bold uppercase">Meeting Schedule</span>
                <span className="font-bold text-charcoal">{activeGroup?.meeting_day}s at {activeGroup?.meeting_time}</span>
              </div>

              <div>
                <span className="text-charcoal/50 block text-[10px] font-bold uppercase">Location / Meeting Venue</span>
                <span className="font-bold text-charcoal">{activeGroup?.location}</span>
              </div>

              <div>
                <span className="text-charcoal/50 block text-[10px] font-bold uppercase">Active Curriculum</span>
                <span className="font-bold text-indigo">{activeGroup?.curriculum || "General Scripture Study"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
