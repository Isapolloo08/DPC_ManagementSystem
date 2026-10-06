import type { NavTab } from "../layout/Sidebar";

export interface GuideStep {
  title: string;
  text: string;
  target?: string;
  missing?: string;
  details?: string[];
  // Only open forms, read-only readers, or view tabs. Never submit a record.
  reveal?: string | string[];
  dismiss?: string;
  tab?: NavTab;
  roles?: string[];
}

export interface TaskGuide {
  id: string;
  title: string;
  description: string;
  tab: NavTab;
  roles: string[];
  steps: GuideStep[];
}

const managers = ["Admin", "IT Admin", "Pastor", "Coordinator"];
const everyone = [...managers, "Leader", "Volunteer", "Member"];

export const taskGuides: TaskGuide[] = [
  {
    id: "add-member", title: "Add a member", description: "Register a person and place them in the right ministry.", tab: "members", roles: managers,
    steps: [
      { title: "Open the member form", text: "Check the directory first to avoid duplicates. Then choose Add Member.", target: "member-add", details: ["Search for the person's full name before creating another record.", "Choose Next step to open the application form and go to the name field."] },
      { title: "Enter their details", text: "Enter the full name and birthday. Check the ministry, membership status, and the required fields marked with *. You can scroll through the form.", target: "member-name", reveal: "member-add", missing: "Choose Add Member to see this field.", details: ["Use the person's complete name and correct date of birth for their age-based ministry.", "Add contact details and address, then select the household and check its parents or guardian and family members.", "Complete every required field marked with * before saving."] },
      { title: "Set birthday and ministry", text: "Enter the correct date of birth, then review the age-based ministry assignment and membership status. Complete the age-specific application fields shown for this person.", target: "member-birthday", reveal: "member-add", missing: "Open the member application first." },
      { title: "Set household and address", text: "Choose the existing family household when available and check the address. Create a household only if the family does not already have one.", target: "member-household", reveal: "member-add", missing: "Enter the birthday and open the household section of the application." },
      { title: "Enter contact information", text: "Enter the contact phone and email and check whose number should be used for follow-up.", target: "member-contact", reveal: "member-add", missing: "Open the member application and scroll to the contact fields." },
      { title: "Review parents and family", text: "Check the parent or guardian and family details reflected from the household. Complete the education, occupation, medical, and other required fields shown for this ministry.", target: "member-family", reveal: "member-add", missing: "Set the birthday and household first; the available family fields depend on the member's ministry." },
      { title: "Review and save", text: "Review the application, then choose Save Application Record. If a field needs attention, correct it and try again.", target: "member-save", reveal: "member-add", missing: "Open the member form and complete the required details first.", details: ["Review the spelling, birthday, contact information, and household links.", "Choose Save Application Record yourself. Moving through the guide does not submit the form.", "Wait for the success message; correct any highlighted fields if saving fails."] },
      { title: "Check the result", text: "Wait for the success message, then find the person in the directory. Finishing this guide does not save the form.", target: "member-search", missing: "Save the application or close the member form to return to the directory.", details: ["Search for the saved name and open the member's profile.", "Verify their ministry, household, and family details before finishing."] },
    ],
  },
  {
    id: "attendance", title: "Record Sunday attendance", description: "Choose the service, find a person, and record attendance.", tab: "attendance", roles: [...managers, "Volunteer"],
    steps: [
      { title: "Choose Sunday worship", text: "Choose Sunday Worship Check-In. Special events have their own attendance list.", target: "attendance-sunday", details: ["Use the Sunday worship tab for regular services.", "Choose the correct service date in the next step before marking anyone present."] },
      { title: "Select the correct service", text: "Use the date selector to choose today's or a past Sunday service. Upcoming services are preview only and cannot be edited.", target: "attendance-service", reveal: "attendance-sunday", details: ["Confirm the service date before changing anyone's attendance.", "Use Special Event Check-In for event attendance; its roster is separate from Sunday worship."] },
      { title: "Find the person", text: "Search by name, family, or security tag. Check the ministry and status filters if the person is missing.", target: "attendance-search", reveal: "attendance-sunday", missing: "Choose Sunday Worship Check-In to see the search box.", details: ["Match the full name and ministry to the person attending.", "Clear restrictive filters if the person does not appear in the results."] },
      { title: "Record and verify", text: "Use the person's attendance action to mark them present or check them in. In Fast Roll Call, select people and use Save Roll Call. Wait for confirmation and check the displayed status.", target: "attendance-roster", reveal: "attendance-sunday", missing: "Choose Sunday Worship Check-In and wait for the roster to load.", details: ["Review the selected service and people before using the attendance action.", "The guide does not mark anyone present or save a roll call for you.", "Check the updated status after the page confirms that attendance was saved."] },
    ],
  },
  {
    id: "create-group", title: "Create a Bible study group", description: "Set a leader, study topic, meeting schedule, and members.", tab: "biblestudy", roles: managers,
    steps: [
      { title: "Open a new group", text: "Choose New Bible Study Group. To update a group instead, open its details and choose Edit.", target: "group-create" },
      { title: "Set up the group", text: "Enter a group name. Select its ministry, leader, study topic, meeting schedule, and location. Add the members who will attend.", target: "group-name", reveal: "group-create", missing: "Choose New Bible Study Group to open the form.", details: ["Give the group a recognizable name and choose the correct ministry.", "Assign its leader and curriculum, then set the meeting day, time, and location.", "Check the member list and capacity before moving to the save step."] },
      { title: "Choose study material", text: "Choose the curriculum or book for this group and verify its chapter or lesson information. Set the group category and ministry as appropriate.", target: "group-topic", reveal: "group-create", missing: "Open the new group form first." },
      { title: "Assign the group leader", text: "Search and select the leader or enter the permitted leader details. Verify their contact information before continuing.", target: "group-leader", reveal: "group-create", missing: "Open the new group form first." },
      { title: "Set the meeting schedule", text: "Choose the meeting day and start/end times, then set the room or custom off-site location.", target: "group-schedule", reveal: "group-create", missing: "Open the new group form first." },
      { title: "Select the disciples", text: "Search unenrolled members, use ministry filters, and select the people joining this group. Check capacity, the selected list, and group notes.", target: "group-members", reveal: "group-create", missing: "Open the new group form first." },
      { title: "Create and verify", text: "Review the required fields and choose Create Small Group. Wait for the success message, then find the group in the list.", target: "group-save", reveal: "group-create", missing: "Complete the new group form first.", details: ["Confirm the leader, disciples, curriculum, and meeting schedule.", "Choose Create Small Group yourself; the guide only takes you to the button.", "After saving, open the group from the directory to verify its details."] },
    ],
  },
  {
    id: "my-group", title: "Manage my Bible study group", description: "Find your group and log a meeting's attendance.", tab: "leaderportal", roles: [...managers, "Leader"],
    steps: [
      { title: "Choose your group", text: "Use the group switcher to select a group you lead. If no group is assigned, ask a coordinator to assign you as its leader.", target: "my-group-switcher", missing: "A group you lead must be assigned before these controls appear." },
      { title: "Open meetings", text: "Choose Curriculum & Roll-Call to see the group's sessions and attendance controls.", target: "my-group-meetings", missing: "Select a group you lead first." },
      { title: "Take roll call", text: "In Weekly Small Group Attendance Roll-Call, choose the session date and check the disciples who are present.", target: "my-group-rollcall", reveal: "my-group-meetings", missing: "Choose Curriculum & Roll-Call to see the attendance list.", details: ["Confirm that the selected group and meeting date are correct.", "Check each disciple who attended and review the list before saving."] },
      { title: "Save attendance", text: "Choose Save Session Attendance. Wait for the success message and check the session record.", target: "my-group-save", reveal: "my-group-meetings", missing: "Choose Curriculum & Roll-Call to see the save button.", details: ["Save using the page's button; Next step and Finish guide do not record attendance.", "Check the confirmation and session history after saving."] },
    ],
  },
  {
    id: "reading", title: "Follow my Bible reading plan", description: "Read today's chapters, explore the schedule, and understand its progress.", tab: "biblereading", roles: everyone,
    steps: [
      { title: "Find today's reading", text: "Today's Reading Assignment shows the date, day number, and chapters assigned for today.", target: "reading-today", details: ["Read the passage title and chapter chips to see all assigned chapters.", "The plan schedules 3 chapters Monday through Saturday and 5 on Sunday.", "Choose Next step to open today's passage reader."] },
      { title: "Read the assigned chapters", text: "Use the chapter buttons in the passage reader to move through today's assignment.", target: "reading-chapters", reveal: "reading-open", details: ["Choose a chapter or use the reader's previous and next controls.", "Use the font-size controls if you need larger text.", "The reader also provides links to read the NIV passage online."] },
      { title: "Explore the daily schedule", text: "The 365-Day Daily Schedule Plan lists each day's date and assigned passages.", target: "reading-filters", reveal: "reading-calendar", dismiss: "reading-close", details: ["Select a month or search by book name, such as Genesis or Matthew.", "Filter by testament or choose Covered Up to Today and Upcoming Readings.", "Open a day's card to read its assigned chapters."] },
      { title: "Understand the photo sheet", text: "The Photo Sheet Grid arranges the books and chapters like the church's printed reading guide.", target: "reading-grid", reveal: "reading-photo", dismiss: "reading-close", details: ["Chapters are automatically marked according to the schedule up to today's date.", "The marks and totals describe scheduled coverage; they do not confirm your personal completion.", "Click a chapter to read it. The mark-style controls change how the scheduled marks look."] },
      { title: "Adjust or print the plan", text: "Use Calibrate Schedule if the displayed passages differ from the church's reading benchmark.", target: "reading-calibrate", dismiss: "reading-close", details: ["Open Calibrate Schedule and review its preview before applying an adjustment.", "Use Printable Guide for the daily list or Print Sheet in the photo view for the chapter grid.", "Finish guide closes these instructions without changing the schedule or printing."] },
    ],
  },
  {
    id: "duty", title: "Check my duty schedule", description: "See which team serves and when.", tab: "duty", roles: everyone,
    steps: [
      { title: "Find your team", text: "Look for your group or ministry in Duty Teams. Check the team leader, members, and assigned tasks.", target: "duty-teams", reveal: "duty-teams-tab", missing: "If no duty teams appear, ask a coordinator to check your team's assignment.", details: ["Find your team by its name and check the leader and member list.", "Review the responsibilities so your team knows what to prepare."] },
      { title: "Plan ahead", text: "Saturday Rotation Cycle shows the upcoming cleaning dates and assigned teams.", target: "duty-schedule", reveal: "duty-schedule-tab", details: ["Find the Saturday you will serve and confirm the assigned team.", "Review later weeks before arranging a swap with your coordinator."] },
      { title: "Check Sunday washing duty", text: "Dishwashing Roster has a separate Sunday rotation after fellowship.", target: "dishwashing-schedule", tab: "dishwashing", reveal: "dishwashing-schedule-tab", details: ["Check the Sunday date, assigned unit, and roster lead.", "Use Saturday Duty Roster in the navigation menu to return to cleaning assignments."] },
    ],
  },
  {
    id: "announcements", title: "Read church announcements", description: "Keep up with church and ministry updates.", tab: "communications", roles: everyone,
    steps: [
      { title: "Read the latest updates", text: "The communications board shows pinned notices and the latest church announcements.", target: "announcements-list", details: ["Read the full message shown on each announcement card.", "Pinned notices are marked at the top; check the ministry audience before acting on an update."] },
      { title: "Check dates and instructions", text: "Check the author, published date, audience, and meeting instructions in the announcement.", target: "announcements-list", details: ["Look for the event date, time, location, and any preparation requested in the message.", "If the board is empty, check back later for new church or ministry updates."] },
    ],
  },
];

export const welcomeSteps: GuideStep[] = [
  { title: "Your starting page", text: "This page shows the information available for your role. Use Start Here whenever you want help choosing your next task.", target: "workspace" },
  { title: "Find a section", text: "Use the navigation menu to open members, attendance, schedules, and other sections available to you. On a small screen, open it with the menu button.", target: "navigation", missing: "Open the navigation menu using the button at the top left." },
  { title: "Your account", text: "Choose your name or initials to view your profile and account settings.", target: "account" },
  { title: "Help whenever you need it", text: "Choose Start Here in the top bar to replay this tour, start a task, or open help for the current page.", target: "help-launcher" },
];

type PageHelp = { title: string; description: string; steps: string[] };
export const pageHelp: Record<NavTab, PageHelp> = {
  dashboard: { title: "Dashboard", description: "Your church or ministry overview, tailored to your role.", steps: ["Review the summaries and upcoming activities.", "Open a summary or shortcut to see its details.", "Choose Start Here for guided tasks."] },
  "leader-dashboard": { title: "Leader dashboard", description: "Your group's activity and discipleship overview.", steps: ["Review your assigned group's summaries.", "Open My Bible Study Group to manage sessions and disciples."] },
  members: { title: "Members & families", description: "Find member records and manage their church and family details.", steps: ["Search by name and use filters to narrow the directory.", "Open a person to see their profile, household, and attendance.", "Choose Add Member to register someone; check for duplicates first."] },
  attendance: { title: "Attendance & check-in", description: "Record Sunday worship or special event attendance.", steps: ["Choose Sunday Worship Check-In or Special Event Check-In.", "Select the correct service date or event.", "Find the person and use their attendance action. Fast Roll Call requires saving your selections.", "Check the success message and updated attendance status."] },
  attendancelog: { title: "Attendance log", description: "Review attendance that has already been recorded.", steps: ["Set the date range and available filters.", "Search for a person or service to inspect its records.", "Use Attendance Live to record attendance."] },
  servicecalendar: { title: "Service calendar", description: "Review worship service dates and their availability.", steps: ["Find the date you want to review.", "Open a service to inspect its details and status.", "Check the service calendar before choosing a date for attendance."] },
  biblestudy: { title: "Bible study groups", description: "Organize discipleship groups, their schedules, and study progress.", steps: ["Filter or search for a group and open its details.", "Choose New Bible Study Group to set up a group.", "Set its leader, members, study topic, and meeting schedule.", "Review active, completed, and archived groups in their respective lists."] },
  leaderportal: { title: "My Bible study group", description: "View groups connected to you and manage groups you lead.", steps: ["Select your group if a group switcher is available.", "Use the overview to review the group and its disciples.", "Group leaders can open Curriculum & Roll-Call to log attendance.", "If no group appears, ask a coordinator to check your assignment."] },
  "leader-members": { title: "Group disciples", description: "Review the people in your Bible study group.", steps: ["Select your group.", "Open its disciples list to view member details."] },
  "leader-biblestudy": { title: "Meetings & curriculum", description: "Manage study sessions and attendance for your group.", steps: ["Select your group and open Curriculum & Roll-Call.", "Choose a session date in Weekly Small Group Attendance Roll-Call.", "Check present disciples and choose Save Session Attendance."] },
  curriculum: { title: "Books & study topics", description: "Explore the material used by Bible study groups.", steps: ["Find a book or topic in the list.", "Open it to review its chapters or study details.", "Use these topics when setting up a group's curriculum."] },
  biblereading: { title: "Daily Bible reading", description: "Read assigned passages and review the church's automatic reading schedule.", steps: ["Find today's date and assigned chapters in Today's Reading Assignment.", "Open the passage reader and use its chapter controls.", "Explore the daily schedule or photo sheet. Scheduled chapters are marked automatically by date.", "Review the calibration preview if the plan differs from the church's benchmark."] },
  duty: { title: "Saturday duty roster", description: "See the teams assigned to church cleaning.", steps: ["Find your group or ministry in the schedule.", "Check the assigned date and team members.", "Review upcoming rotations so your team can prepare."] },
  dishwashing: { title: "Dishwashing roster", description: "See the teams assigned after Sunday fellowship.", steps: ["Find the Sunday you need.", "Review the assigned groups and team members.", "If your role can manage the roster, review changes before saving them."] },
  events: { title: "Calendar", description: "Find church activities and their dates.", steps: ["Navigate to the month or day you need.", "Open an activity to see its time and details.", "Use the available event controls if your role can manage activities."] },
  sundaycycle: { title: "Events & celebrations", description: "Review recurring church events and annual celebrations.", steps: ["Find the celebration or event cycle you need.", "Review its dates and details.", "Check related calendar activities before making schedule changes."] },
  communications: { title: "Announcements", description: "Read church and ministry updates.", steps: ["Review the latest announcements.", "Open an announcement for its full details and dates.", "If posting controls are available, check the audience and message before publishing."] },
  reports: { title: "Analytics & trends", description: "Understand attendance patterns and ministry summaries.", steps: ["Choose a reporting period and ministry scope.", "Review the charts and totals for that selection.", "Use any available export option to share the selected report."] },
  users: { title: "User management", description: "Manage who can sign in and what they can access.", steps: ["Find a user and review their role and ministry assignments.", "Use the available controls to add or update an account.", "Review access carefully before saving a role change."] },
  audit: { title: "System audit logs", description: "Review recorded administrative changes.", steps: ["Filter the history by the available date and action options.", "Review who made a change and when."] },
  settings: { title: "Settings & lookups", description: "Configure church details and the system's reference lists.", steps: ["Choose the settings section you need.", "Review the current values before editing and saving.", "Administrators can use the backup section to protect or restore data. Read each confirmation carefully."] },
  notifications: { title: "Notifications", description: "Review church alerts and schedule updates.", steps: ["Open a notification to read its details.", "Follow its link to the related group, event, or record.", "Use the available read controls to keep your list organized."] },
  profile: { title: "My profile & account", description: "Review your personal details and account settings.", steps: ["Review your profile and church information.", "Use the available edit or password controls to update your account.", "Save changes and wait for confirmation."] },
};
