import type { NavTab } from "../layout/Sidebar";
import type { GuideStep, TaskGuide } from "./guideContent";
import type { GuideDataSnapshot } from "./GuideDataContext";

export interface GuideSupport {
  resource: string;
  label: string;
  target: string;
  empty: string;
  preparation: string;
  contact: string;
  setupGuides: string[];
  sample: [string, string][];
}
const support = (resource: string, label: string, target: string, empty: string, preparation: string, setupGuides: string[], sample: [string, string][]): GuideSupport => ({
  resource, label, target, empty, preparation, setupGuides, sample,
  contact: "Ask your church coordinator or administrator to check the records and your access. Return to this page and refresh after the setup is complete.",
});
const assigned = support("assigned-groups", "Group assignment", "my-group-empty",
  "No Bible study group is assigned to your account yet. Group tabs and roll call become available after an assignment.",
  "An authorized coordinator must select your account as the group's leader or assistant, or link your member record as a disciple. Creating a group alone does not assign every user.",
  ["assign-group", "create-group"], [["Group", "Sample Faith Group"], ["Leader", "Sample Leader"], ["Disciples", "Ana Santos, Ben Reyes"], ["Curriculum", "Faith Foundations"], ["Meeting", "Wednesday, 7:00 PM"]]);
export const guideSupport: Partial<Record<NavTab, GuideSupport>> = {
  leaderportal: assigned, "leader-members": assigned, "leader-biblestudy": assigned,
  members: support("members", "Member directory", "member-search", "There are no member records in this directory yet.", "Register the first member or import existing application forms. Check for duplicates and review required fields before saving.", ["add-member", "import-members"], [["Member", "Ana Santos"], ["Ministry", "Youth"], ["Household", "Sample Santos Family"], ["Status", "Active"]]),
  biblestudy: support("groups", "Bible study groups", "groups-search", "No Bible study groups are available yet.", "Create a group with its leader, curriculum and schedule, then enroll its disciples.", ["create-group"], assigned.sample),
  attendance: support("attendance-roster", "Attendance roster", "attendance-service", "No members are available in the current attendance scope.", "Confirm the Sunday service date and ministry scope. Registered members are needed before individual attendance or Batch Roll Call can be recorded.", ["add-member", "service-create"], [["Service", "Sample Sunday worship"], ["Member", "Ana Santos"], ["Ministry", "Youth"], ["Attendance", "Unmarked → Present"]]),
  attendancelog: support("attendance-history", "Attendance history", "log-from", "No attendance records match this period.", "Widen the date range and clear restrictive filters. Attendance history appears after a service or group session has been recorded.", ["attendance", "batch-attendance"], [["Service date", "Sample Sunday"], ["Member", "Ana Santos"], ["Status", "Present"], ["Type", "Sunday worship"]]),
  servicecalendar: support("services", "Worship services", "service-filters", "No worship services match this calendar view.", "Check the calendar period and filters. An authorized coordinator can create the service date needed for attendance.", ["service-create"], [["Service", "Sunday Worship"], ["Date", "Sample Sunday"], ["Status", "Held"], ["Notes", "Morning worship"]]),
  curriculum: support("curriculum", "Books and study topics", "curriculum-search", "No study books or topics are available yet.", "Add a book or study topic with its lesson count before assigning it to a Bible study group.", ["curriculum-create"], [["Title", "Faith Foundations"], ["Lessons", "8"], ["Current lesson", "Chapter 1"], ["Notes", "Introduction to faith"]]),
  duty: support("duty-teams", "Saturday duty teams", "duty-teams", "No Saturday duty teams are available yet.", "Create a team, assign its leader and members, and review its rotation order. A rotation needs teams before dates can be swapped.", ["duty-team"], [["Team", "Sample Sanctuary Team"], ["Leader", "Ana Santos"], ["Order", "1"], ["Duty", "Sanctuary cleaning"]]),
  dishwashing: support("washing-teams", "Dishwashing teams", "washing-filters", "No dishwashing teams are available yet.", "Create a roster team from the permitted members, ministries or Bible study groups. Review its leader and rotation before changing assignments.", ["washing-team"], [["Team", "Sample Fellowship Team"], ["Leader", "Ben Reyes"], ["Order", "1"], ["Duty", "Sunday dishwashing"]]),
  events: support("calendar-events", "Calendar activities", "calendar-search", "No activities match the current calendar view.", "Check the date, ministry and activity-type filters. Coordinators can schedule a church event; study meetings and duty dates come from their respective sections.", ["celebration-create", "create-group", "duty-team"], [["Activity", "Sample Church Fellowship"], ["Date", "Sample Sunday"], ["Location", "Fellowship hall"], ["Type", "Church event"]]),
  sundaycycle: support("celebrations", "Events and celebrations", "celebration-year", "No events or celebrations match this view.", "Check the year and filters, then create the recurring celebration or one-time event the church needs.", ["celebration-create"], [["Event", "Sample Thanksgiving Service"], ["Schedule", "Annual"], ["Location", "Sanctuary"], ["Status", "Scheduled"]]),
  communications: support("announcements", "Church announcements", "announcements-list", "There are no announcements to read in this scope yet.", "Check the ministry audience. Authorized staff can publish a notice; other users can return when a notice has been published.", ["publish-announcement"], [["Title", "Sample Fellowship Notice"], ["Audience", "All church"], ["Message", "Join the fellowship after Sunday worship."], ["Author", "Sample Coordinator"]]),
  notifications: support("notifications", "Notifications", "notifications-all", "No notifications match this view.", "Check All versus Unread. Notifications appear automatically from church activity and notification rules; do not create an artificial record just to complete a guide.", [], [["Subject", "Sample group meeting reminder"], ["Status", "Unread"], ["Related record", "Sample Faith Group"], ["Action", "View related activity"]]),
  users: support("users", "User accounts", "users-search", "No accounts match this view.", "Clear account and role filters first. Create an account only when a real person needs access, then check their role and member link.", ["user-create"], [["Account", "Sample Leader"], ["Role", "Leader"], ["Ministry", "Youth"], ["Member link", "Ana Santos"]]),
  audit: support("audit", "Audit history", "audit-search", "No audit entries match this view.", "Expand the date range and clear the operator or action filters. Audit entries are generated by actual activity, so there is no manual add action.", [], [["Action", "Member updated"], ["Operator", "Sample Coordinator"], ["Record", "Ana Santos"], ["Change", "Contact details updated"]]),
  reports: support("reports", "Analytics", "reports-period", "Analytics are not available yet.", "Check the reporting period. Meaningful totals require member records and recorded attendance; empty charts do not mean a request failed.", ["add-member", "attendance"], [["Members", "24"], ["Attendance", "18 present"], ["Groups", "3"], ["Households", "8"]]),
  settings: support("settings", "Church settings", "settings-general", "Church settings need to be configured.", "Review the church identity and maintain the reference lists available to your role.", ["church-settings", "reference-settings"], [["Church", "Sample Presbyterian Church"], ["Ministry", "Youth"], ["Location", "Fellowship hall"], ["Membership status", "Active"]]),
  profile: support("profile", "My profile", "profile-personal", "Your profile is not available.", "Refresh your account information and sign in again if your session has expired.", [], [["Name", "Ana Santos"], ["Email", "ana@example.test"], ["Role", "Member"], ["Ministry", "Youth"]]),
  dashboard: support("dashboard", "Church overview", "dashboard-ministries", "No activity has been recorded yet.", "Start with members and Bible study groups, then record real attendance and schedules.", ["add-member", "create-group", "attendance"], [["Members", "24"], ["Groups", "3"], ["Households", "8"], ["Next activity", "Sunday worship"]]),
  biblereading: support("reading", "Bible reading plan", "reading-today", "The reading plan is not available.", "Check the schedule calibration and refresh the reading plan.", ["reading"], [["Reading", "Genesis 1–3"], ["Day", "1 of 365"], ["Chapters", "3"], ["Schedule", "Weekday"]]),
};
guideSupport["leader-dashboard"] = guideSupport.dashboard;

// These tasks can create/configure their first record. Their forms remain usable
// when the directory is empty; record-dependent tasks require the setup flow.
const firstRecordTasks = new Set(["add-member", "import-members", "household", "application-family", "create-group", "service-create", "curriculum-create",
  "guest-checkin", "celebration-create", "duty-team", "duty-checklists", "washing-team", "washing-protocols", "publish-announcement", "user-create",
  "church-settings", "reference-settings", "email-settings", "backup", "backup-download", "restore-data", "purge-year", "profile", "reading", "analytics"]);

export function needsGuideSetup(guide: TaskGuide, snapshot?: GuideDataSnapshot): boolean {
  if (!snapshot) return false;
  if (snapshot.status === "loading" || snapshot.status === "error") return true;
  return snapshot.status !== "ready" && !firstRecordTasks.has(guide.id);
}

export function getSetupSteps(info: GuideSupport, snapshot: GuideDataSnapshot | undefined, canSetUp: boolean): GuideStep[] {
  if (snapshot?.status === "loading") return [{
    title: "Wait for the page to load", text: "The records are still loading. Keep this guide open; it will show the appropriate setup or walkthrough once the request finishes.",
  }];
  if (snapshot?.status === "error") return [{
    title: "Retry loading this page", text: "The request failed. This is different from an empty directory; retry before creating any records.",
    details: [snapshot.error || "Unable to load this page.", "Your guide stays open while you retry. A sample preview is also available."],
  }];
  if (snapshot?.status === "ready") return [{
    title: "Ready to continue", text: "The required information is now available. Choose Continue walkthrough to return to your original task.",
  }];
  return [
    { title: snapshot?.status === "filtered" ? "Check the current filters" : "Understand what is missing",
      text: snapshot?.status === "filtered" ? "No records match this scope or date range. This does not mean the whole database is empty. Adjust the page filters before creating another record." : info.empty,
      target: snapshot?.status === "filtered" || info.target === "my-group-empty" ? info.target : "workspace" },
    { title: canSetUp ? "Complete the required setup" : "Check with your coordinator", text: canSetUp ? info.preparation : info.contact, target: "workspace" },
    { title: "Refresh and continue", text: "After the records or assignment are ready, refresh this page. Then choose Continue walkthrough. You can preview the remaining steps with sample data while waiting.", target: info.target === "my-group-empty" ? "my-group-refresh" : "workspace" },
  ];
}
