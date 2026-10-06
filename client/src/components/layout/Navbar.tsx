import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useSocketConnection, } from "../../socket";
import { ChurchLogo } from "../common/ChurchLogo";
import { WindowControls } from "./WindowControls";
import { UserCog, Compass } from "lucide-react";
import { NotificationBell } from "../notifications/NotificationBell";
import { ThemeSelector } from "../common/ThemeSelector";
import { DashboardDateButton } from "./DashboardDateButton";
import { isGuideSandbox } from "../help/sandbox/runtime";



const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "dashboard": { title: "Executive Dashboard", subtitle: "Church overview, attendance & KPIs" },
  "leaderportal": { title: "My Bible Study Group", subtitle: "Small group fellowship & spiritual growth" },
  "leader-dashboard": { title: "My Bible Study Group", subtitle: "Small group fellowship & spiritual growth" },
  "leader-members": { title: "Lead Group Disciples", subtitle: "Assigned discipleship roster & care" },
  "leader-biblestudy": { title: "Meeting & Curriculum", subtitle: "Curriculum & meeting attendance" },
  "attendance": { title: "Attendance & Check-In", subtitle: "Sunday divine worship & special event check-in kiosks" },
  "members": { title: "Members & Households", subtitle: "7 ministries directory & membership cards" },
  "biblestudy": { title: "Bible Study Groups", subtitle: "Discipleship life groups & schedules" },
  "curriculum": { title: "Topics & Books of Study", subtitle: "Discipleship curriculum tracker" },
  "duty": { title: "Saturday Duty Roster", subtitle: "Weekly rotating church cleaning teams" },
  "dishwashing": { title: "Dishwashing Roster", subtitle: "Weekly after-fellowship washing cycle" },
  "events": { title: "Events & Master Calendar", subtitle: "Church schedules & fellowships" },
  "communications": { title: "Announcements", subtitle: "Church board & ministry bulletins" },
  "reports": { title: "Analytics & Trends", subtitle: "Attendance reports & demographic statistics" },
  "users": { title: "User Management", subtitle: "System access & role permissions" },
  "settings": { title: "Settings & Lookups", subtitle: "System lookup configurations" },
  "audit": { title: "System Audit Logs", subtitle: "Administrative activity history" },
  "profile": { title: "My Profile & Account", subtitle: "Personal details, security & church engagement" },
  "notifications": { title: "Notifications", subtitle: "Church alerts, schedule updates & follow-ups" }
};

interface NavbarProps {
  currentTab?: string;
  isScrolled?: boolean;
  onToggleSidebar?: () => void;
  onOpenProfile?: () => void;
  onNavigate?: (tab: string, refId?: number | null) => void;
  onOpenHelp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab = "dashboard", isScrolled = false, onToggleSidebar, onOpenProfile, onNavigate, onOpenHelp }) => {
  const { user } = useAuth();
  const isConnected = useSocketConnection();
  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron || (window as any).__electron__);
  let currentTabMeta = TAB_TITLES[currentTab] || { title: "DPC Management System", subtitle: "Church portal" };
  if (currentTab === "dashboard") {
    if (user?.role_name?.toLowerCase() === "leader") {
      currentTabMeta = { title: "Leader Dashboard", subtitle: "Small group discipleship & weekly overview" };
    } else if (user?.role_name?.toLowerCase() === "volunteer") {
      currentTabMeta = { title: "Volunteer Hub", subtitle: "Ministry service, duty rosters & check-in" };
    }
  }

  return (
    <header data-scrolled={isScrolled} className={`text-charcoal border-b select-none relative transition-colors duration-300 motion-reduce:transition-none ${isScrolled
      ? "bg-ivory-light/95 border-gray-200/70 backdrop-blur-md"
      : "bg-transparent border-transparent"}`}>
      {/* Top-Right Window Controls (Fixed at top-right desktop window corner) */}
      <div
        className="absolute top-0 right-0 z-50 pointer-events-auto"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <WindowControls
          buttonClassName="w-11 sm:w-12 h-8 sm:h-9 flex items-center justify-center text-charcoal/70 hover:text-charcoal hover:bg-gray-200 transition-colors cursor-pointer"
          closeButtonClassName="w-12 sm:w-13 h-8 sm:h-9 flex items-center justify-center text-charcoal/70 hover:text-white hover:bg-red-600 transition-colors cursor-pointer group"
        />
      </div>

      {/* Main Navbar Row with explicit padding ensuring a solid gap before window controls */}
      <div
        className="w-full pl-3 sm:pl-6 lg:pl-8 pr-3 sm:pr-6 lg:pr-8"
        style={isElectron ? { paddingRight: "165px" } : undefined}
      >
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: Mobile hamburger toggle & Desktop active view title (Draggable) */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 h-full"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                className="md:hidden p-1.5 rounded-xl bg-white hover:bg-gray-100 text-charcoal transition-colors cursor-pointer shrink-0"
                aria-label="Toggle navigation menu"
                data-guide="navigation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Mobile-only compact logo & brand title */}
            <div className="flex items-center gap-2 min-w-0 md:hidden">
              <ChurchLogo className="w-7 h-7 shrink-0 rounded-lg drop-shadow-xs" />
              <div className="min-w-0 truncate font-medium text-xs text-charcoal">
                Daet Presbyterian <span className="text-amber-400 font-serif italic text-[12px]">ChMS</span>
              </div>
            </div>

            {/* Desktop Active View Title & Subtitle */}
            <div className="hidden md:block min-w-0">
              <h2 className="font-semibold text-sm tracking-tight text-charcoal flex items-center gap-2 truncate">
                <span>{currentTabMeta.title}</span>
              </h2>
              <p className="text-[12px] text-muted leading-none truncate mt-1">
                {currentTabMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Right: User Profile & Status Badges (Completely non-draggable and 100% responsive) */}
          <div
            className="flex items-center gap-2 sm:gap-3 shrink-0"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {currentTab === 'dashboard' && onNavigate && ['Admin', 'IT Admin', 'Pastor', 'Coordinator'].includes(user?.role_name || '') && <DashboardDateButton onOpenCalendar={() => onNavigate('events')} />}
            <ThemeSelector />
            {onOpenHelp && (
              <button type="button" onClick={onOpenHelp} data-guide="help-launcher" aria-label="Open Start Here" title="Start Here: tours and task guides" className="flex items-center gap-1.5 p-2 sm:px-3 rounded-xl border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-medium cursor-pointer shrink-0">
                <Compass className="w-4 h-4" aria-hidden="true" />
                <span className="hidden lg:inline">Start Here</span>
              </button>
            )}
            {/* Real-time Socket.IO Live Indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium tracking-wide border transition-all ${isConnected
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}
              title={isGuideSandbox() ? "Isolated practice workspace with sample data" : isConnected ? "Real-time Socket.IO connected across all church terminals" : "Connecting to real-time server..."}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
              <span className="hidden lg:inline">{isGuideSandbox() ? "Sample data" : isConnected ? "Live Sync" : "Syncing..."}</span>
            </div>

            {onNavigate && (user?.role_name === "Admin" || user?.role_name === "IT Admin" || user?.role_name === "Pastor") && (
              <NotificationBell onNavigate={onNavigate} />
            )}

            {/* User Pill (Interactive -> Opens Profile Management) */}
            {user && (
              <button
                type="button"
                onClick={onOpenProfile}
                title="Manage Account Profile & Security Settings"
                data-guide="account"
                className="group flex items-center gap-2 pl-2.5 pr-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-ivory transition-all cursor-pointer text-left active:scale-98"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500 text-indigo-950 font-medium flex items-center justify-center text-xs shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                  {user.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                </div>
                <div className="hidden sm:block text-left min-w-0">
                  <div className="text-xs font-medium leading-tight text-charcoal truncate max-w-[110px] lg:max-w-[140px] transition-colors">
                    {user.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-sage-400 shrink-0"></span>
                    <span className="text-[12px] text-muted font-medium truncate">{user.role_name}</span>
                  </div>
                </div>
                <UserCog className="w-3.5 h-3.5 text-muted group-hover:text-amber-600 shrink-0 ml-0.5 transition-colors hidden md:block" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
