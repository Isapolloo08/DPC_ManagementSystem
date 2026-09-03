import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar, NavTab } from "./components/layout/Sidebar";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MembersPage } from "./pages/MembersPage";
import { BibleStudyPage } from "./pages/BibleStudyPage";
import { CurriculumPage } from "./pages/CurriculumPage";
import { DutyPage } from "./pages/DutyPage";
import { EventsPage } from "./pages/EventsPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { CheckInPage } from "./pages/CheckInPage";
import { DishwashingPage } from "./pages/DishwashingPage";
import { LeaderPortalPage } from "./pages/leader";

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const isLeader = user?.role_name === "Leader";
  const [currentTab, setCurrentTab] = useState<NavTab>(
    isLeader ? "leader-dashboard" : "dashboard"
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (user?.role_name === "Leader") {
      if (!["leader-dashboard", "leader-members", "leader-biblestudy"].includes(currentTab)) {
        setCurrentTab("leader-dashboard");
      }
    }
  }, [user?.role_name]);

  const renderActiveView = () => {
    // Role Authorization: When logged in as Leader, only render views from the leader folder
    if (isLeader) {
      if (currentTab === "leader-members") {
        return <LeaderPortalPage initialTab="members" onTabChange={(t) => setCurrentTab(`leader-${t}` as NavTab)} />;
      }
      if (currentTab === "leader-biblestudy") {
        return <LeaderPortalPage initialTab="biblestudy" onTabChange={(t) => setCurrentTab(`leader-${t}` as NavTab)} />;
      }
      return <LeaderPortalPage initialTab="dashboard" onTabChange={(t) => setCurrentTab(`leader-${t}` as NavTab)} />;
    }

    switch (currentTab) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentTab} />;
      case "leaderportal":
      case "leader-dashboard":
        return <LeaderPortalPage initialTab="dashboard" />;
      case "leader-members":
        return <LeaderPortalPage initialTab="members" />;
      case "leader-biblestudy":
        return <LeaderPortalPage initialTab="biblestudy" />;
      case "attendance":
        return <CheckInPage />;
      case "members":
        return <MembersPage />;
      case "biblestudy":
        return <BibleStudyPage />;
      case "curriculum":
        return <CurriculumPage />;
      case "duty":
        return <DutyPage />;
      case "dishwashing":
        return <DishwashingPage />;
      case "events":
        return <EventsPage />;
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
        return <DashboardPage onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-ivory-light flex selection:bg-amber selection:text-white">
      {/* Sidebar in the front (full-height left column) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Pinned Top Navigation Bar */}
        <div className="sticky top-0 z-30 shadow-md">
          {/* Main Indigo Navbar */}
          <Navbar
            currentTab={currentTab}
            onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          />
        </div>

        {/* Dynamic Main Workspace View with responsive gutters */}
        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-8 overflow-y-auto no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-white/20 border-t-amber rounded-full animate-spin mx-auto"></div>
          <p className="font-bold text-sm text-indigo-200">Loading Daet Presbyterian Church ChMS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <MainLayout />;
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
