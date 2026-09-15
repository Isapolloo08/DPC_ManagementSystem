import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useSocketConnection, } from "../../socket";
import { ChurchLogo } from "../common/ChurchLogo";
import { WindowControls } from "./WindowControls";
import { Bell, UserCog } from "lucide-react";



const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "dashboard": { title: "Executive Dashboard", subtitle: "Church overview, attendance & KPIs" },
  "leaderportal": { title: "My Bible Study Group", subtitle: "Small group fellowship & spiritual growth" },
  "leader-dashboard": { title: "My Bible Study Group", subtitle: "Small group fellowship & spiritual growth" },
  "leader-members": { title: "Lead Group Disciples", subtitle: "Assigned discipleship roster & care" },
  "leader-biblestudy": { title: "Meeting & Curriculum", subtitle: "Curriculum & meeting attendance" },
  "attendance": { title: "Sunday Attendance", subtitle: "Live divine worship service kiosks" },
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
  "profile": { title: "My Profile & Account", subtitle: "Personal details, security & church engagement" }
};

interface NavbarProps {
  currentTab?: string;
  onToggleSidebar?: () => void;
  onOpenProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab = "dashboard", onToggleSidebar, onOpenProfile }) => {
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
    <header className="bg-indigo text-white border-b border-indigo-800/60 shadow-xs select-none relative">
      {/* Top-Right Window Controls (Fixed at top-right desktop window corner) */}
      <div
        className="absolute top-0 right-0 z-50 pointer-events-auto"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <WindowControls />
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
                className="md:hidden p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                aria-label="Toggle navigation menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Mobile-only compact logo & brand title */}
            <div className="flex items-center gap-2 min-w-0 md:hidden">
              <ChurchLogo variant="badge" className="w-7 h-7 shrink-0" />
              <div className="min-w-0 truncate font-bold text-xs text-white">
                Daet Presbyterian <span className="text-amber-400 font-serif italic text-[10px]">ChMS</span>
              </div>
            </div>

            {/* Desktop Active View Title & Subtitle */}
            <div className="hidden md:block min-w-0">
              <h2 className="font-bold text-base lg:text-lg tracking-tight text-white flex items-center gap-2 truncate">
                <span>{currentTabMeta.title}</span>
              </h2>
              <p className="text-[11px] text-indigo-200/80 leading-none truncate mt-0.5">
                {currentTabMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Right: User Profile & Status Badges (Completely non-draggable and 100% responsive) */}
          <div
            className="flex items-center gap-2 sm:gap-3 shrink-0"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {/* Real-time Socket.IO Live Indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide border transition-all ${isConnected
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}
              title={isConnected ? "Real-time Socket.IO connected across all church terminals" : "Connecting to real-time server..."}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
              <span className="hidden lg:inline">{isConnected ? "Live Sync" : "Syncing..."}</span>
            </div>

            {/* Notification Indicator */}
            <div className="relative p-2 rounded-full hover:bg-indigo-700/60 text-indigo-200 hover:text-white cursor-pointer transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose rounded-full"></span>
            </div>

            {/* User Pill (Interactive -> Opens Profile Management) */}
            {user && (
              <button
                type="button"
                onClick={onOpenProfile}
                title="Manage Account Profile & Security Settings"
                className="group flex items-center gap-2 pl-2.5 pr-2.5 py-1 rounded-2xl border border-indigo-700/80 bg-indigo-900/40 hover:bg-indigo-800/80 hover:border-amber-400/50 transition-all cursor-pointer shadow-xs text-left active:scale-98"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-indigo-950 font-black flex items-center justify-center text-xs shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                  {user.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                </div>
                <div className="hidden sm:block text-left min-w-0">
                  <div className="text-xs font-bold leading-tight text-white truncate max-w-[110px] lg:max-w-[140px] group-hover:text-amber-300 transition-colors">
                    {user.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-sage-400 shrink-0"></span>
                    <span className="text-[10px] text-amber-300/90 font-medium truncate">{user.role_name}</span>
                  </div>
                </div>
                <UserCog className="w-3.5 h-3.5 text-indigo-300 group-hover:text-amber-400 shrink-0 ml-0.5 transition-colors hidden md:block" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
