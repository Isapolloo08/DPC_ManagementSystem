import React, { useState, useEffect, useCallback } from "react";
import { DPCLoadingScreen } from "./components/DPCLoadingScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ToastContainer } from "./components/common/ToastContainer";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar, NavTab } from "./components/layout/Sidebar";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { BibleReadingPage } from "./pages/BibleReadingPage";
import { MembersPage } from "./pages/MembersPage";
import { BibleStudyPage } from "./pages/BibleStudyPage";
import { CurriculumPage } from "./pages/CurriculumPage";
import { DutyPage } from "./pages/DutyPage";
import { EventsPage } from "./pages/EventsPage";
import { SundayEventsCyclePage } from "./pages/SundayEventsCyclePage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { CheckInPage } from "./pages/CheckInPage";
import { AttendanceLogPage } from "./pages/AttendanceLogPage";
import { ServiceCalendarPage } from "./pages/ServiceCalendarPage";
import { DishwashingPage } from "./pages/DishwashingPage";
import { LeaderPortalPage } from "./pages/leader";
import { ProfilePage } from "./pages/ProfilePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfileModal } from "./components/profile/ProfileModal";
import { SystemConfigurationModal } from "./components/common/SystemConfigurationModal";

const isTabAllowedForRole = (tab: NavTab, roleName?: string): boolean => {
  switch (roleName) {
    case "Admin":
    case "Pastor":
    case "IT Admin":
      return true;
    case "Coordinator":
      return !["users", "settings", "audit", "notifications"].includes(tab);
    case "Leader":
      return [
        "dashboard", "leader-dashboard", "biblereading", "leaderportal",
        "curriculum", "duty", "dishwashing", "events", "sundaycycle",
        "communications", "profile"
      ].includes(tab);
    case "Volunteer":
      return [
        "dashboard", "biblereading", "attendance", "attendancelog",
        "duty", "dishwashing", "events", "sundaycycle",
        "communications", "profile"
      ].includes(tab);
    case "Member":
      return [
        "biblereading", "leaderportal", "curriculum", "duty",
        "dishwashing", "events", "sundaycycle", "communications",
        "profile"
      ].includes(tab);
    default:
      return true;
  }
};

const getDefaultTabForRole = (roleName?: string): NavTab => {
  if (roleName === "Member") return "biblereading";
  return "dashboard";
};

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>(() => getDefaultTabForRole(user?.role_name));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [navigationRefId, setNavigationRefId] = useState<number | null>(null);

  const navigateToTab = (tab: string, refId?: number | null) => {
    let target = tab as NavTab;
    if ((user?.role_name === "Leader" || user?.role_name === "Member") && tab === "biblestudy") {
      target = "leaderportal";
    }
    if (!isTabAllowedForRole(target, user?.role_name)) {
      target = getDefaultTabForRole(user?.role_name);
    }
    setNavigationRefId(refId ?? null);
    setCurrentTab(target);
  };

  useEffect(() => {
    if (!isTabAllowedForRole(currentTab, user?.role_name)) {
      setCurrentTab(getDefaultTabForRole(user?.role_name));
    }
  }, [user?.role_name, currentTab]);

  const renderActiveView = () => {
    // Direct profile page access for any role
    if (currentTab === "profile") {
      return <ProfilePage />;
    }

    // Direct Bible reading page access for all roles
    if (currentTab === "biblereading") {
      return <BibleReadingPage />;
    }

    if (currentTab === "notifications") {
      return <NotificationsPage onNavigate={navigateToTab} />;
    }

    switch (currentTab) {
      case "dashboard":
      case "leader-dashboard":
        return <DashboardPage onNavigate={setCurrentTab} />;
      case "leaderportal":
      case "leader-members":
      case "leader-biblestudy":
        return <LeaderPortalPage onNavigateGeneralTab={setCurrentTab} />;
      case "attendance":
        return <CheckInPage />;
      case "attendancelog":
        return <AttendanceLogPage />;
      case "servicecalendar":
        return <ServiceCalendarPage />;
      case "members":
        return <MembersPage />;
      case "biblestudy":
        return <BibleStudyPage initialGroupId={navigationRefId} />;
      case "curriculum":
        return <CurriculumPage />;
      case "duty":
        return <DutyPage />;
      case "dishwashing":
        return <DishwashingPage />;
      case "events":
        return <EventsPage onNavigate={setCurrentTab} />;
      case "sundaycycle":
        return <SundayEventsCyclePage />;
      case "communications":
        return <CommunicationsPage />;
      case "reports":
        return <ReportsPage />;
      case "users":
        return <UsersPage />;
      case "audit":
        return <AuditPage />;
      case "settings":
        return <SettingsPage onNavigateToUsers={() => setCurrentTab("users")} />;
      default:
        return user?.role_name === "Member" ? <BibleReadingPage /> : <DashboardPage onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-ivory-light flex selection:bg-amber selection:text-white">
      {/* Sidebar in the front (full-height left column) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => navigateToTab(tab)}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onOpenProfile={() => setCurrentTab("profile")}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Pinned Top Navigation Bar */}
        <div className="sticky top-0 z-30 shadow-md">
          {/* Main Indigo Navbar */}
          <Navbar
            currentTab={currentTab}
            onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
            onOpenProfile={() => setCurrentTab("profile")}
            onNavigate={navigateToTab}
          />
        </div>

        {/* Dynamic Main Workspace View with responsive gutters */}
        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-8 overflow-y-auto no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Profile Management Modal for Quick Pop-up Access */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

const AppContent: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  const { user, loading } = useAuth();
  const [isSystemConfigOpen, setIsSystemConfigOpen] = useState(false);

  useEffect(() => {
    if (!loading) onReady();
  }, [loading, onReady]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setIsSystemConfigOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      {loading ? (
        <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-white/20 border-t-amber rounded-full animate-spin mx-auto"></div>
            <p className="font-bold text-sm text-indigo-200">Loading Daet Presbyterian Church ChMS...</p>
          </div>
        </div>
      ) : !user ? (
        <LoginPage />
      ) : (
        <MainLayout />
      )}

      {/* Global System Database Server IP Configuration Modal (Ctrl + P / Cmd + P) */}
      <SystemConfigurationModal
        isOpen={isSystemConfigOpen}
        onClose={() => setIsSystemConfigOpen(false)}
        onConfigSaved={() => {
          setTimeout(() => {
            window.location.reload();
          }, 350);
        }}
      />
    </>
  );
};

export function App() {
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <DPCLoadingScreen ready={ready}>
      <ToastProvider>
        <AuthProvider>
          <AppContent onReady={handleReady} />
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    </DPCLoadingScreen>
  );
}

export default App;
