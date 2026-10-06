import React, { useMemo, useState } from "react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { WEEKDAYS, formatScheduleTime, parseScheduleTime, suggestBibleStudySchedules, type ScheduleParticipant, type ScheduleSuggestion } from "../../utils/bibleStudyScheduleSuggestions";

interface Props {
  members: ScheduleParticipant[];
  leader: ScheduleParticipant | null;
  initialDuration: number;
  onClose: () => void;
  onApply: (suggestion: ScheduleSuggestion) => void;
}

export function ScheduleSuggestionsModal({ members, leader, initialDuration, onClose, onApply }: Props) {
  const [duration, setDuration] = useState([30, 60, 90, 120].includes(initialDuration) ? initialDuration : 90);
  const [days, setDays] = useState(WEEKDAYS);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("21:00");
  const start = parseScheduleTime(startTime), end = parseScheduleTime(endTime);
  const invalid = start === null || end === null || end - start < duration;
  const suggestions = useMemo(() => invalid ? [] : suggestBibleStudySchedules(members, leader,
    { duration, days, start: start!, end: end! }), [members, leader, duration, days, start, end, invalid]);
  return <Dialog title="Find Best Schedule" onClose={onClose}
    description="Best fit based on recorded class/work schedules. These are treated as busy times; no recorded conflict does not guarantee attendance."
    footer={<Button onClick={onClose}>Close</Button>}>
    <div className="space-y-4 text-xs">
      <p className="text-muted">Comparing {members.length} selected members. Leader: {leader?.name || "Not selected"}.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="space-y-1 block">Session duration
          <select className="ui-input w-full" value={duration} onChange={event => setDuration(Number(event.target.value))}>
            {[30, 60, 90, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
          </select>
        </label>
        <label className="space-y-1 block">Earliest start
          <input className="ui-input w-full" type="time" value={startTime} onChange={event => setStartTime(event.target.value)} />
        </label>
        <label className="space-y-1 block">Latest end
          <input className="ui-input w-full" type="time" value={endTime} onChange={event => setEndTime(event.target.value)} />
        </label>
      </div>
      <fieldset>
        <legend className="font-medium mb-2">Preferred days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(day => <label key={day} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2 cursor-pointer">
            <input type="checkbox" checked={days.includes(day)} onChange={event => setDays(previous => event.target.checked ? [...previous, day] : previous.filter(item => item !== day))} />
            {day.slice(0, 3)}
          </label>)}
        </div>
      </fieldset>
      <div aria-live="polite">
        {invalid ? <p className="ui-error" role="alert">Choose a time range long enough for the session.</p>
          : !days.length ? <p className="ui-help">Select at least one preferred day.</p>
          : !suggestions.length ? <p className="ui-help">No reliable suggestions for these preferences. Add readable class/work schedules to member profiles, or try other days, a wider time range, or a shorter session. You can still set the group schedule manually.</p>
          : <ol className="space-y-3">
            {suggestions.map((suggestion, index) => <li key={`${suggestion.day}-${suggestion.start}`} className="border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal">{index + 1}. {suggestion.day}, {formatScheduleTime(suggestion.start)} – {formatScheduleTime(suggestion.end)}</p>
                  {index === 0 && <p className="text-indigo font-medium mt-1">Best fit</p>}
                </div>
                <Button size="sm" variant={index === 0 ? "primary" : "secondary"} onClick={() => onApply(suggestion)}>Use this schedule</Button>
              </div>
              <p>{suggestion.clear.length} no recorded conflict · {suggestion.conflicts.length} with conflicts · {suggestion.unknown.length} unknown</p>
              <p className="text-muted">Leader: {suggestion.leaderStatus === "clear" ? "No recorded conflict" : "Availability unknown — confirm with the leader"}</p>
              <details>
                <summary className="cursor-pointer text-indigo font-medium">View member details</summary>
                <div className="space-y-2 mt-2 break-words">
                  <p><strong>No recorded conflict:</strong> {suggestion.clear.map(member => member.name).join(", ") || "None"}</p>
                  <p><strong>With conflicts:</strong> {suggestion.conflicts.map(member => member.name).join(", ") || "None"}</p>
                  <p><strong>Unknown / unreadable schedule:</strong> {suggestion.unknown.map(member => member.name).join(", ") || "None"}</p>
                </div>
              </details>
            </li>)}
          </ol>}
      </div>
    </div>
  </Dialog>;
}
