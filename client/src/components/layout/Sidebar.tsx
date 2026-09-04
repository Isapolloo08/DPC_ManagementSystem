import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ChurchLogo } from "../common/ChurchLogo";
import { 
  LayoutDashboard, Users, UserCheck, Calendar, MessageSquare, 
  Heart, BarChart3, ShieldAlert, Sparkles, BookOpen, BookMarked, LogOut, Sliders, UserCog, CalendarCheck,
  X, ChevronLeft, ChevronRight, Utensils
} from "lucide-react";

export type NavTab = 
  | "dashboard"
  | "leaderportal"
  | "leader-dashboard"
  | "leader-members"
  | "leader-biblestudy"
  | "attendance"
  | "members"
  | "biblestudy"
  | "curriculum"
  | "duty"
  | "dishwashing"
  | "events"
  | "communications"
  | "reports"
  | "users"
  | "audit"
  | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isLeader = user?.role_name === "Leader";
  const isCoordinator = user?.role_name === "Coordinator";

  // Dedicated navigation for Small Group / Discipleship Leaders (Leader Folder Only)
  const leaderNavItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "leader-dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-sky-500" />, badge: "Leader" },
    { id: "leader-members", label: "Members (Disciples)", icon: <Users className="w-4 h-4 shrink-0 text-sky-500" />, badge: "Roster" },
    { id: "leader-biblestudy", label: "Bible Study Groups", icon: <BookOpen className="w-4 h-4 shrink-0 text-sky-500" />, badge: "Groups" },
  ];

  // Standard full church management navigation for Admin, Coordinator, Volunteer, Member
  const defaultNavItems: { id: NavTab; label: string; icon: React.ReactNode; roles?: string[]; badge?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: "attendance", label: "Sunday Attendance", icon: <UserCheck className="w-4 h-4 shrink-0" />, badge: "Live" },
    { id: "members", label: "Members & Families", icon: <Users className="w-4 h-4 shrink-0" /> },
    { id: "biblestudy", label: "Bible Study Groups", icon: <BookOpen className="w-4 h-4 shrink-0" />, badge: "Groups" },
    { id: "curriculum", label: "Topics & Books of Study", icon: <BookMarked className="w-4 h-4 shrink-0" />, badge: "Books" },
    { id: "duty", label: "Saturday Duty Roster", icon: <CalendarCheck className="w-4 h-4 shrink-0" />, roles: ["Admin"], badge: "Duty" },
    { id: "dishwashing", label: "Dishwashing Roster", icon: <Utensils className="w-4 h-4 shrink-0 text-amber-500" />, roles: ["Admin"], badge: "Cycle" },
    { id: "events", label: "Events & Calendar", icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: "communications", label: "Announcements & Prayer", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
    { id: "reports", label: "Analytics & Trends", icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: "users", label: "User Management", icon: <UserCog className="w-4 h-4 shrink-0" />, roles: ["Admin"], badge: "Admin" },
    { id: "settings", label: "Settings & Lookups", icon: <Sliders className="w-4 h-4 shrink-0" />, roles: ["Admin"], badge: "CRUD" },
    { id: "audit", label: "System Audit Logs", icon: <ShieldAlert className="w-4 h-4 shrink-0" />, roles: ["Admin"] },
  ];

  const activeNavItems = isLeader ? leaderNavItems : defaultNavItems;

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onClose) {
      onClose();
    }
  };

  const ministryList = (isCoordinator && user?.ministries && user.ministries.length > 0 
    ? [
        { name: "Kinder", age: "3-5 yrs", color: "bg-[#E07A5F]" },
        { name: "Elementary", age: "6-12 yrs", color: "bg-[#D9A441]" },
        { name: "Highschool", age: "13-16 yrs", color: "bg-[#B85C56]" },
        { name: "Youth", age: "17-21 yrs", color: "bg-[#6E8B74]" },
        { name: "Young Adult", age: "22-35 yrs", color: "bg-[#2C3968]" },
        { name: "Junior Adult", age: "36-55 yrs", color: "bg-[#4A5568]" },
        { name: "Old Adult", age: "56+ yrs", color: "bg-[#8D5B4C]" },
      ].filter(m => user.ministries.some(um => um.name.toLowerCase().includes(m.name.toLowerCase())))
    : [
        { name: "Kinder", age: "3-5 yrs", color: "bg-[#E07A5F]" },
        { name: "Elementary", age: "6-12 yrs", color: "bg-[#D9A441]" },
        { name: "Highschool", age: "13-16 yrs", color: "bg-[#B85C56]" },
        { name: "Youth", age: "17-21 yrs", color: "bg-[#6E8B74]" },
        { name: "Young Adult", age: "22-35 yrs", color: "bg-[#2C3968]" },
        { name: "Junior Adult", age: "36-55 yrs", color: "bg-[#4A5568]" },
        { name: "Old Adult", age: "56+ yrs", color: "bg-[#8D5B4C]" },
      ]
  );

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Off-canvas drawer (Front Full-Height Column) */}
      <aside className={`
        fixed md:sticky top-0 left-0 z-50 md:z-30
        h-screen
        bg-white border-r border-indigo-100 flex flex-col shadow-2xl md:shadow-xs
        overflow-hidden shrink-0 transition-all duration-300 ease-in-out
        ${isOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}
        ${isCollapsed ? "md:w-20" : "md:w-64"}
      `}>
        {/* STICKY TOP HEADER: Church Brand Logo & Name */}
        <div className="p-3.5 pb-3 border-b border-indigo-100/80 bg-white shrink-0 z-10">
          {isCollapsed ? (
            /* COLLAPSED HEADER: Logo is the Un-collapse button; hovering reveals the right arrow icon */
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="group relative w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center shadow-md text-charcoal transition-all hover:scale-105 hover:shadow-lg cursor-pointer"
                title="Expand sidebar (Click to un-collapse)"
              >
                {/* Professional Church Logo */}
                <ChurchLogo className="w-6 h-6 text-indigo-950 transition-all duration-200 group-hover:opacity-0 group-hover:scale-75" />
                
                {/* Hover State: Arrow Icon smoothly appearing */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-amber-400 rounded-xl">
                  <ChevronRight className="w-6 h-6 text-indigo-950 stroke-[3]" />
                </div>
              </button>
            </div>
          ) : (
            /* EXPANDED HEADER: Church Logo, Name, and Collapse Button */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <ChurchLogo variant="badge" className="w-10 h-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13px] text-charcoal tracking-tight flex items-center gap-1">
                    <span className="truncate">Daet Presbyterian</span>
                    <span className="text-amber-600 font-serif italic text-xs shrink-0">ChMS</span>
                  </div>
                  <p className="text-[10px] text-charcoal/50 leading-tight truncate">
                    Camarines Norte Youth Center
                  </p>
                </div>
              </div>

              {/* Desktop Collapse Button in the top of the sidebar */}
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="hidden md:flex items-center justify-center p-1.5 rounded-xl hover:bg-indigo-50 text-charcoal/50 hover:text-indigo transition-all cursor-pointer shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-charcoal/60 hover:text-charcoal cursor-pointer md:hidden shrink-0"
                title="Close Navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* SCROLLABLE MIDDLE NAVIGATION CONTAINER */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-4">
          {/* Navigation Items */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-charcoal/50 mb-1.5 truncate">
                {isLeader ? "Leader Workspace" : "Main Navigation"}
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
                  className={`w-full flex items-center ${isCollapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2"} rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo text-white shadow-sm font-bold"
                      : "text-charcoal/80 hover:bg-indigo-50/70 hover:text-indigo font-medium"
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5 min-w-0 pr-1"}`}>
                    <span className={isActive ? "text-amber-400" : "text-indigo/70"}>
                      {item.icon}
                    </span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded shrink-0 ${
                      isActive 
                        ? "bg-amber text-charcoal" 
                        : "bg-indigo-50 text-indigo border border-indigo-100/80"
                    }`}>
                      {item.badge}
                    </span>
                  )}
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
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-charcoal/50 mb-2.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-indigo" />
                {isCoordinator && user?.ministries && user.ministries.length > 0 
                  ? "Designated Ministry" 
                  : "7 Active Ministries"}
              </p>
              <div className="space-y-1.5 px-3">
                {ministryList.map((m) => (
                  <div key={m.name} className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg ${
                    isCoordinator ? "bg-indigo-50/70 border border-indigo-100 font-bold" : "py-0.5"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${m.color}`}></span>
                      <span className="text-charcoal font-bold">{m.name} Ministry</span>
                    </div>
                    <span className={`text-[10px] ${isCoordinator ? "bg-white text-indigo px-1.5 py-0.5 rounded shadow-2xs font-bold" : "text-charcoal/50"}`}>
                      {m.age}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STICKY BOTTOM FOOTER: Logout Action & Info Card */}
        <div className="p-3.5 pt-2 border-t border-indigo-100/80 bg-white shrink-0 space-y-2 z-10">
          <button
            onClick={logout}
            title="Sign Out of Account"
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose text-charcoal/70 text-xs font-bold transition-all shadow-2xs active:scale-98 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose shrink-0" />
            {!isCollapsed && <span>Sign Out of Account</span>}
          </button>

          {!isCollapsed && (
            <div className="bg-ivory rounded-xl p-3 border border-amber/20 text-xs text-charcoal/80">
              <div className="flex items-center gap-2 font-semibold text-indigo mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber" />
                <span>Sunday Live System</span>
              </div>
              <p className="text-[11px] text-charcoal/70 leading-relaxed">
                Integrated check-in, family grouping, and cross-ministry RBAC.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
