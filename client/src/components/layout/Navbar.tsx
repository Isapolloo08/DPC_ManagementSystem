import React from "react";
import { useAuth } from "../../context/AuthContext";
import { ChurchLogo } from "../common/ChurchLogo";
import { Shield, ChevronDown, Bell, LogOut } from "lucide-react";

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "dashboard": { title: "Executive Dashboard", subtitle: "Church overview, attendance & KPIs" },
  "leaderportal": { title: "Leader Portal", subtitle: "Small group & disciple care" },
  "leader-dashboard": { title: "Leader Dashboard", subtitle: "Life group discipleship overview" },
  "leader-members": { title: "Disciples Roster", subtitle: "Assigned life group members" },
  "leader-biblestudy": { title: "Bible Study Groups", subtitle: "Curriculum & meeting progress" },
  "attendance": { title: "Sunday Attendance", subtitle: "Live divine worship service kiosks" },
  "members": { title: "Members & Households", subtitle: "7 ministries directory & membership cards" },
  "biblestudy": { title: "Bible Study Groups", subtitle: "Discipleship life groups & schedules" },
  "curriculum": { title: "Topics & Books of Study", subtitle: "Discipleship curriculum tracker" },
  "duty": { title: "Saturday Duty Roster", subtitle: "Weekly rotating church cleaning teams" },
  "dishwashing": { title: "Dishwashing Roster", subtitle: "Weekly after-fellowship washing cycle" },
  "events": { title: "Events & Master Calendar", subtitle: "Church schedules & fellowships" },
  "communications": { title: "Announcements & Prayer", subtitle: "Church board & prayer requests" },
  "reports": { title: "Analytics & Trends", subtitle: "Attendance reports & demographic statistics" },
  "users": { title: "User Management", subtitle: "System access & role permissions" },
  "settings": { title: "Settings & Lookups", subtitle: "System lookup configurations" },
  "audit": { title: "System Audit Logs", subtitle: "Administrative activity history" }
};

interface NavbarProps {
  currentTab?: string;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab = "dashboard", onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const currentTabMeta = TAB_TITLES[currentTab] || { title: "DPC Management System", subtitle: "Church portal" };

  return (
    <header className="bg-indigo text-white border-b border-indigo-800/60 shadow-xs">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Mobile hamburger toggle & Desktop active view title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                aria-label="Toggle navigation menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Mobile-only compact logo & brand title */}
            <div className="flex items-center gap-2 min-w-0 md:hidden">
              <ChurchLogo variant="badge" className="w-8 h-8 shrink-0" />
              <div className="min-w-0 truncate font-bold text-sm text-white">
                Daet Presbyterian <span className="text-amber-400 font-serif italic text-xs">ChMS</span>
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

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Indicator */}
            <div className="relative p-2 rounded-full hover:bg-indigo-700/60 text-indigo-200 hover:text-white cursor-pointer transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose rounded-full"></span>
            </div>

            {/* User Pill & Logout */}
            {user && (
              <div className="flex items-center gap-3 pl-2 border-l border-indigo-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-400 text-charcoal font-bold flex items-center justify-center text-xs shadow-inner">
                    {user.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold leading-tight text-white">{user.name}</div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-sage-400"></span>
                      <span className="text-[10px] text-amber-300 font-medium">{user.role_name}</span>
                      {user.ministries.length > 0 && (
                        <span className="text-[10px] text-indigo-200">
                          • {user.ministries.map(m => m.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose hover:text-white text-indigo-200 text-xs font-bold transition-all active:scale-95 shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
