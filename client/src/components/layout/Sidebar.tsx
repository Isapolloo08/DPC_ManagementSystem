import { ViewportOverlay } from "../common/ViewportOverlay";
import './sidebar.css';
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ChurchLogo } from "../common/ChurchLogo";
import {
  LayoutDashboard, Users, HeartHandshake, UserCheck, Calendar, MessageSquare,
  Heart, BarChart3, ShieldAlert, BookOpen, BookMarked, BookmarkCheck, ShieldCheck, LogOut, Sliders, UserCog, CalendarCheck,
  X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Utensils, Sun, Bell, ClipboardList, Church
} from "lucide-react";

export type NavTab =
  | "plannedvisits"
  | "dashboard"
  | "biblereading"
  | "leaderportal"
  | "leader-dashboard"
  | "leader-members"
  | "leader-biblestudy"
  | "attendance"
  | "attendancelog"
  | "servicecalendar"
  | "members"
  | "biblestudy"
  | "curriculum"
  | "duty"
  | "dishwashing"
  | "events"
  | "sundaycycle"
  | "communications"
  | "reports"
  | "users"
  | "audit"
  | "settings"
  | "notifications"
  | "profile";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenProfile?: () => void;
}

// Keep related pages together across roles without changing their access.
const NAVIGATION_ORDER: NavTab[] = [
  "dashboard", "leader-dashboard",
  "members", "leader-members", "plannedvisits",
  "attendance", "attendancelog", "servicecalendar",
  "biblestudy", "leaderportal", "leader-biblestudy", "curriculum", "biblereading",
  "events", "sundaycycle",
  "duty", "dishwashing",
  "communications", "notifications",
  "reports", "users", "audit", "settings", "profile",
];

const navigationRank = (tab: NavTab) => {
  const rank = NAVIGATION_ORDER.indexOf(tab);
  return rank < 0 ? NAVIGATION_ORDER.length : rank;
};

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen = false, onClose, onOpenProfile }) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setCanScrollUp(scrollTop > 8);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 8);
  };

  useEffect(() => {
    checkScroll();
    const current = scrollRef.current;
    if (!current) return;

    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(current);
    window.addEventListener("resize", checkScroll);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkScroll);
    };
  }, [currentTab, isCollapsed]);

  const scrollUp = () => {
    scrollRef.current?.scrollBy({ top: -160, behavior: "smooth" });
  };

  const scrollDown = () => {
    scrollRef.current?.scrollBy({ top: 160, behavior: "smooth" });
  };

  const isSuperAdmin = user?.role_name === "Admin" || user?.role_name === "IT Admin";
  const isPastor = user?.role_name === "Pastor";
  const isCoordinator = user?.role_name === "Coordinator";
  const isLeader = user?.role_name === "Leader";
  const isVolunteer = user?.role_name === "Volunteer";
  const isMember = user?.role_name === "Member";

  // 1. Super Admin (Full System Access)
  const superAdminNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'plannedvisits', label: 'Planned visits', icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-600" /> },
    { id: "dashboard", label: "System Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-cyan-500" /> },
    { id: "biblereading", label: "Daily Bible Reading", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-600" /> },
    { id: "attendance", label: "Attendance Live", icon: <UserCheck className="w-4 h-4 shrink-0 text-indigo-600" /> },
    { id: "attendancelog", label: "Attendance Log", icon: <ClipboardList className="w-4 h-4 shrink-0 text-emerald-600" /> },
    { id: "servicecalendar", label: "Service Calendar", icon: <Church className="w-4 h-4 shrink-0 text-indigo-600" /> },
    { id: "members", label: "Members & Families", icon: <Users className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "leaderportal", label: "My Bible Study Group", icon: <BookmarkCheck className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "biblestudy", label: "Bible Study Groups", icon: <HeartHandshake className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "curriculum", label: "Curriculum Books/Topics", icon: <BookMarked className="w-4 h-4 shrink-0 text-amber-600" /> },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-teal-500" /> },
    { id: "events", label: "Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "sundaycycle", label: "Events & Celebrations", icon: <Sun className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "communications", label: "Announcements", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "reports", label: "Analytics & Trends", icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: "users", label: "User Management", icon: <UserCog className="w-4 h-4 shrink-0" /> },
    { id: "settings", label: "Settings & Backups", icon: <Sliders className="w-4 h-4 shrink-0" /> },
    { id: "audit", label: "System Audit Logs", icon: <ShieldAlert className="w-4 h-4 shrink-0" /> },
  ];

  // 2. Pastor (Executive Pastoral Oversight)
  const pastorNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'plannedvisits', label: 'Planned visits', icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-600" /> },
    { id: "dashboard", label: "Pastoral Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "biblereading", label: "Daily Bible Reading", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-600" /> },
    { id: "attendance", label: "Attendance Live", icon: <UserCheck className="w-4 h-4 shrink-0 text-indigo-600" /> },
    { id: "attendancelog", label: "Attendance Log", icon: <ClipboardList className="w-4 h-4 shrink-0 text-emerald-600" /> },
    { id: "servicecalendar", label: "Service Calendar", icon: <Church className="w-4 h-4 shrink-0 text-indigo-600" /> },
    { id: "members", label: "Members & Families", icon: <Users className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "leaderportal", label: "My Bible Study Group", icon: <BookmarkCheck className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "biblestudy", label: "Bible Study Groups", icon: <HeartHandshake className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "curriculum", label: "Curriculum Books/Topics", icon: <BookMarked className="w-4 h-4 shrink-0 text-amber-600" /> },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-teal-500" /> },
    { id: "events", label: "Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "sundaycycle", label: "Events & Celebrations", icon: <Sun className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "communications", label: "Announcements", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "reports", label: "Analytics & Trends", icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: "users", label: "User Management", icon: <UserCog className="w-4 h-4 shrink-0" /> },
    { id: "settings", label: "Settings & Lookups", icon: <Sliders className="w-4 h-4 shrink-0" /> },
    { id: "audit", label: "System Audit Logs", icon: <ShieldAlert className="w-4 h-4 shrink-0" /> },
  ];

  // 3. Coordinator (Ministry Leader / Dept Overseer)
  const coordinatorNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Ministry Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-emerald-600" /> },
    { id: "biblereading", label: "Daily Bible Reading", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-600" /> },
    { id: "attendance", label: "Attendance Live", icon: <UserCheck className="w-4 h-4 shrink-0 text-indigo-600" /> },
    { id: "attendancelog", label: "Attendance Log", icon: <ClipboardList className="w-4 h-4 shrink-0 text-emerald-600" /> },
    { id: "servicecalendar", label: "Service Calendar", icon: <Church className="w-4 h-4 shrink-0 text-indigo-600" /> },
    { id: "members", label: "Members & Families", icon: <Users className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "leaderportal", label: "My Bible Study Group", icon: <BookmarkCheck className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "biblestudy", label: "Bible Study Groups", icon: <HeartHandshake className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "curriculum", label: "Curriculum Books/Topics", icon: <BookMarked className="w-4 h-4 shrink-0 text-amber-600" /> },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-teal-500" /> },
    { id: "events", label: "Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "sundaycycle", label: "Events & Celebrations", icon: <Sun className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "communications", label: "Announcements", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
    { id: "reports", label: "Analytics & Trends", icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
  ];

  // 4. Dedicated navigation for Small Group / Discipleship Leaders
  const leaderNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Leader Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "biblereading", label: "Daily Bible Reading", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-500" /> },
    { id: "leaderportal", label: "My Bible Study Group", icon: <BookmarkCheck className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-teal-500" /> },
    { id: "events", label: "Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "sundaycycle", label: "Events & Celebrations", icon: <Sun className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "communications", label: "Announcements", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
  ];

  // 5. Dedicated navigation for Ministry Volunteers & Helpers
  const volunteerNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Volunteer Hub", icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-emerald-500" /> },
    { id: "biblereading", label: "Daily Bible Reading", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-600" /> },
    { id: "attendance", label: "Attendance Live", icon: <UserCheck className="w-4 h-4 shrink-0 text-sky-500" /> },
    { id: "attendancelog", label: "Attendance Log", icon: <ClipboardList className="w-4 h-4 shrink-0 text-emerald-600" /> },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-teal-500" /> },
    { id: "events", label: "Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "sundaycycle", label: "Events & Celebrations", icon: <Sun className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "communications", label: "Announcements", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
  ];

  // 6. Navigation for Church Members (View Only on Fellowship, Rosters, Curriculum & Bulletin)
  const memberNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "biblereading", label: "Daily Bible Reading", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-600" /> },
    { id: "leaderportal", label: "My Bible Study Group", icon: <BookmarkCheck className="w-4 h-4 shrink-0 text-indigo-500" /> },
    { id: "curriculum", label: "Curriculum Books/Topics", icon: <BookMarked className="w-4 h-4 shrink-0 text-amber-600" /> },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-teal-500" /> },
    { id: "events", label: "Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "sundaycycle", label: "Events & Celebrations", icon: <Sun className="w-4 h-4 shrink-0 text-amber-500" /> },
    { id: "communications", label: "Announcements", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
  ];

  const roleNavItems = isSuperAdmin
    ? superAdminNavItems
    : (isPastor
      ? pastorNavItems
      : (isCoordinator
        ? coordinatorNavItems
        : (isLeader
          ? leaderNavItems
          : (isVolunteer
            ? volunteerNavItems
            : memberNavItems))));

  const activeNavItems = [...roleNavItems].sort((a, b) => navigationRank(a.id) - navigationRank(b.id));

  const getSidebarTitle = () => {
    if (isSuperAdmin) return "Super Admin Console";
    if (isPastor) return "Pastoral Oversight Console";
    if (isCoordinator) return "Ministry Workspace";
    if (isLeader) return "Leader Workspace";
    if (isVolunteer) return "Volunteer Workspace";
    if (isMember) return "Member Fellowship";
    return "Main Navigation";
  };

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onClose) {
      onClose();
    }
  };

  const ministryList = (isCoordinator && user?.ministries && user.ministries.length > 0
    ? [
      { name: "Kinder", age: "3-5 yrs", color: "bg-[var(--ministry-kinder)]" },
      { name: "Elementary", age: "6-12 yrs", color: "bg-[var(--ministry-elementary)]" },
      { name: "Highschool", age: "13-16 yrs", color: "bg-[var(--ministry-highschool)]" },
      { name: "Youth", age: "17-21 yrs", color: "bg-[var(--ministry-youth)]" },
      { name: "Young Adult", age: "22-35 yrs", color: "bg-[var(--ministry-young-adult)]" },
      { name: "Junior Adult", age: "36-55 yrs", color: "bg-[var(--ministry-junior-adult)]" },
      { name: "Old Adult", age: "56+ yrs", color: "bg-[var(--ministry-old-adult)]" },
    ].filter(m => user.ministries.some(um => um.name.toLowerCase().includes(m.name.toLowerCase())))
    : [
      { name: "Kinder", age: "3-5 yrs", color: "bg-[var(--ministry-kinder)]" },
      { name: "Elementary", age: "6-12 yrs", color: "bg-[var(--ministry-elementary)]" },
      { name: "Highschool", age: "13-16 yrs", color: "bg-[var(--ministry-highschool)]" },
      { name: "Youth", age: "17-21 yrs", color: "bg-[var(--ministry-youth)]" },
      { name: "Young Adult", age: "22-35 yrs", color: "bg-[var(--ministry-young-adult)]" },
      { name: "Junior Adult", age: "36-55 yrs", color: "bg-[var(--ministry-junior-adult)]" },
      { name: "Old Adult", age: "56+ yrs", color: "bg-[var(--ministry-old-adult)]" },
    ]
  );

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isOpen && (
        <ViewportOverlay
          className="bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Off-canvas drawer (Front Full-Height Column) */}
      <aside data-guide="navigation" data-collapsed={isCollapsed} className={`shared-layout-sidebar
        fixed md:sticky top-0 left-0 z-50 md:z-30
        h-screen
        bg-white border-r border-indigo-100 flex flex-col shadow-2xl md:shadow-xs
        overflow-hidden shrink-0 transition-[width,transform] duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none
        ${isOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}
        ${isCollapsed ? "md:w-20" : "md:w-64"}
      `}>
        {/* STICKY TOP HEADER: Church Brand Logo & Name */}
        <div className="sidebar-brand p-3.5 pb-3 border-b border-indigo-100/80 bg-white shrink-0 z-10">
          {isCollapsed ? (
            /* COLLAPSED HEADER: Logo is the Un-collapse button; hovering reveals the right arrow icon */
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="group relative w-11 h-11 rounded-xl p-0.5 flex items-center justify-center shadow-md bg-amber-500/10 hover:bg-amber-500/20 text-charcoal transition-all hover:scale-105 hover:shadow-lg cursor-pointer overflow-hidden ring-1 ring-amber-500/20"
                title="Expand sidebar (Click to un-collapse)"
              >
                {/* Professional Church Logo */}
                <ChurchLogo className="w-full h-full object-contain rounded-lg transition-all duration-200 group-hover:opacity-0 group-hover:scale-75" />

                {/* Hover State: Arrow Icon smoothly appearing */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-amber-500 rounded-xl">
                  <ChevronRight className="w-6 h-6 text-white stroke-[3]" />
                </div>
              </button>
            </div>
          ) : (
            /* EXPANDED HEADER: Church Logo, Name, and Collapse Button */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <ChurchLogo className="w-10 h-10 shrink-0 drop-shadow-xs rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[13px] text-charcoal tracking-tight flex items-center gap-1">
                    <span className="truncate">Daet Presbyterian</span>
                    <span className="text-amber-600 font-serif italic text-xs shrink-0">ChMS</span>
                  </div>
                  <p className="text-[12px] text-muted leading-tight truncate">
                    Rooted in Faith • Growing in Grace
                  </p>
                </div>
              </div>

              {/* Desktop Collapse Button in the top of the sidebar */}
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="hidden md:flex items-center justify-center p-1.5 rounded-xl hover:bg-indigo-50 text-muted hover:text-indigo transition-all cursor-pointer shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-charcoal cursor-pointer md:hidden shrink-0"
                title="Close Navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* SCROLLABLE MIDDLE NAVIGATION CONTAINER */}
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Up Scroll Indicator */}
          <div className="sidebar-scroll-controls">
            {canScrollUp && (
              <button
                type="button"
                onClick={scrollUp}
                className="sidebar-scroll-button"
                title="Scroll Up"
                aria-label="Scroll Up"
              >
                <ChevronUp className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="sidebar-nav-scroll flex-1 overflow-y-auto no-scrollbar px-3.5 pb-3.5 space-y-4"
          >
            {/* Navigation Items */}
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="sidebar-section-title px-3 text-[12px] font-medium uppercase tracking-wider text-muted mb-2.5 truncate">
                  {getSidebarTitle()}
                </p>
              )}
              {activeNavItems.map((item) => {
                if ((item as any).roles && user && !(item as any).roles.includes(user.role_name)) {
                  return null;
                }

                const isActive = isLeader
                  ? (currentTab === item.id || (item.id === "leader-dashboard" && currentTab === "dashboard"))
                  : currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    title={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={`sidebar-nav-item w-full flex items-center ${isCollapsed ? "justify-center px-2 py-2" : "px-3 py-2 text-left"} rounded-xl text-xs cursor-pointer font-medium`}
                  >
                    <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5 min-w-0"}`}>
                      <span className="sidebar-nav-icon shrink-0">
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="min-w-0 whitespace-normal leading-snug">{item.label}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Ministry Legend (Scoped to Designated Ministry for Coordinators) */}
            {isCollapsed ? (
              <div className="pt-3 border-t border-indigo-50 flex flex-col items-center gap-2">
                {ministryList.map((m) => (
                  <span
                    key={m.name}
                    className={`w-3 h-3 rounded-full ${m.color} cursor-pointer hover:scale-125 transition-transform shadow-2xs`}
                    title={`${m.name} Ministry (${m.age})`}
                  />
                ))}
              </div>
            ) : (
              <div className="pt-4 border-t border-indigo-50">
                <p className="px-3 text-[12px] font-medium uppercase tracking-wider text-muted mb-2.5 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo" />
                  {isCoordinator && user?.ministries && user.ministries.length > 0
                    ? "Designated Ministry"
                    : "7 Active Ministries"}
                </p>
                <div className="space-y-1.5 px-3">
                  {ministryList.map((m) => (
                    <div key={m.name} className={`sidebar-ministry-row flex items-center justify-between text-xs py-1 px-2 rounded-lg ${isCoordinator ? "bg-indigo-50/70 border border-indigo-100 font-medium" : "py-0.5"
                      }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full ${m.color}`}></span>
                        <span className="text-charcoal font-medium truncate" title={`${m.name} Ministry`}>{m.name} Ministry</span>
                      </div>
                      <span className={`text-[12px] ${isCoordinator ? "bg-white text-indigo px-1.5 py-0.5 rounded shadow-2xs font-medium" : "text-muted"}`}>
                        {m.age}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Down Scroll Indicator */}
          <div className="sidebar-scroll-controls">
            {canScrollDown && (
              <button
                type="button"
                onClick={scrollDown}
                className="sidebar-scroll-button"
                title="Scroll Down"
                aria-label="Scroll Down"
              >
                <ChevronDown className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* STICKY BOTTOM FOOTER: Profile, Logout Action & Info Card */}
        <div className="p-3.5 pt-2 border-t border-indigo-100/80 bg-white shrink-0 space-y-2 z-10">
          <button
            onClick={() => handleTabClick("profile")}
            title="My Profile & Account Settings"
            className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all shadow-2xs active:scale-98 cursor-pointer ${currentTab === "profile"
              ? "bg-indigo text-white border-indigo shadow-md font-medium"
              : "border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-950"
              }`}
          >
            <UserCog className={`w-4 h-4 shrink-0 ${currentTab === "profile" ? "text-amber-400" : "text-indigo-700"}`} />
            {!isCollapsed && <span>My Profile & Settings</span>}
          </button>

          <button
            onClick={logout}
            title="Sign Out of Account"
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose text-charcoal/70 text-xs font-medium transition-all shadow-2xs active:scale-98 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose shrink-0" />
            {!isCollapsed && <span>Sign Out of Account</span>}
          </button>

          {!isCollapsed && (
            <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)] text-xs text-muted">
              <div className="flex items-center gap-2 font-medium text-indigo mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Sunday Live System</span>
              </div>
              <p className="text-[12px] text-charcoal/70 leading-relaxed">
                Integrated check-in, family grouping, and cross-ministry RBAC.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
