import React, { useState, useEffect, useCallback, useRef } from "react";
import { DPCLoadingScreen } from "./components/DPCLoadingScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ToastContainer } from "./components/common/ToastContainer";
import { GlobalOperationIndicator } from "./components/common/GlobalOperationIndicator";
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
import { PlannedVisitsPage } from "./pages/PlannedVisitsPage";
import { EventInvitationPage } from "./pages/EventInvitationPage";
import { ProfileModal } from "./components/profile/ProfileModal";
import { SystemConfigurationModal } from "./components/common/SystemConfigurationModal";
import { HelpCenter } from "./components/help/HelpCenter";
import { GuideDataProvider } from "./components/help/GuideDataContext";
import { guideSandbox } from "./components/help/sandbox/runtime";
import { allTaskGuides, pageTours } from "./components/help/workflowGuides";
import { pageHelp, type TaskGuide } from "./components/help/guideContent";

const isTabAllowedForRole = (tab: NavTab, roleName?: string): boolean => {
  if (tab === 'plannedvisits') return ['Admin', 'Pastor', 'IT Admin'].includes(roleName || '');
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
        "duty", "dishwashing", "events", "sundaycycle",
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

const MainLayout: React.FC<{ initialTab?: NavTab; initialGuide?: TaskGuide; initialGuideStep?: number }> = ({ initialTab, initialGuide, initialGuideStep }) => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>(() => initialTab ?? getDefaultTabForRole(user?.role_name));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [navigationRefId, setNavigationRefId] = useState<number | null>(null);
  const [isNavbarScrolled, setIsNavbarScrolled] = useState(false);
  const [openChurchSettings, setOpenChurchSettings] = useState(false);
  const [helpRequest, setHelpRequest] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    const updateNavbar = () => setIsNavbarScrolled(window.scrollY > 8 || (main?.scrollTop ?? 0) > 8);
    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });
    main?.addEventListener("scroll", updateNavbar, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateNavbar);
      main?.removeEventListener("scroll", updateNavbar);
    };
  }, []);

  const navigateToTab = (tab: string, refId?: number | null) => {
    setOpenChurchSettings(false);
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
      case "plannedvisits":
        return <PlannedVisitsPage />;
      case "dashboard":
      case "leader-dashboard":
        return <DashboardPage onNavigate={setCurrentTab} onOpenChurchProfile={() => { setOpenChurchSettings(true); setCurrentTab('settings'); }} />;
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
        return <SettingsPage initialTab={openChurchSettings ? 'general' : 'ministries'} onNavigateToUsers={() => setCurrentTab("users")} />;
      default:
        return user?.role_name === "Member" ? <BibleReadingPage /> : <DashboardPage onNavigate={setCurrentTab} onOpenChurchProfile={() => { setOpenChurchSettings(true); setCurrentTab('settings'); }} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg)] flex selection:bg-amber selection:text-white">
      {/* Sidebar in the front (full-height left column) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => navigateToTab(tab)}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onOpenProfile={() => setCurrentTab("profile")}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Pinned Top Navigation Bar */}
        <div className="shrink-0 z-40">
          <Navbar
            currentTab={currentTab}
            isScrolled={isNavbarScrolled}
            onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
            onOpenProfile={() => setCurrentTab("profile")}
            onNavigate={navigateToTab}
            onOpenHelp={() => setHelpRequest(request => request + 1)}
          />
        </div>

        {/* Dynamic Main Workspace View with responsive gutters */}
        <main ref={mainRef} className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-8 overflow-y-auto no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {user && <HelpCenter
              userId={user.id}
              role={user.role_name}
              currentTab={currentTab}
              openRequest={helpRequest}
              onNavigate={navigateToTab}
              isTabAllowed={tab => isTabAllowedForRole(tab, user.role_name)}
              initialGuide={initialGuide}
              initialGuideStep={initialGuideStep}
            />}
            <div key={currentTab} data-guide="workspace" className="workspace-enter">{renderActiveView()}</div>
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

const AppContent: React.FC<{ onReady: () => void; showWorkspace: boolean }> = ({ onReady, showWorkspace }) => {
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
      {!showWorkspace ? null : loading ? (
        <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-white/20 border-t-amber rounded-full animate-spin mx-auto"></div>
            <p className="font-medium text-sm text-indigo-200">Loading Daet Presbyterian Church ChMS...</p>
          </div>
        </div>
      ) : !user ? (
        <LoginPage />
      ) : (
        <GuideDataProvider><MainLayout /></GuideDataProvider>
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

function LiveApp() {
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <DPCLoadingScreen ready={ready}>
      {showWorkspace => (
        <ToastProvider>
          <AuthProvider>
            <AppContent onReady={handleReady} showWorkspace={showWorkspace} />
            <ToastContainer />
          </AuthProvider>
        </ToastProvider>
      )}
    </DPCLoadingScreen>
  );
}

function GuideSandboxWorkspace() {
  const { user, loading } = useAuth();
  const initialGuide = React.useMemo<TaskGuide | undefined>(() => {
    if (!user || !guideSandbox) return;
    const task = allTaskGuides.find(item => item.id === guideSandbox.guideId);
    if (task && task.roles.includes(user.role_name) && isTabAllowedForRole(task.tab, user.role_name)) return task;
    const tab = guideSandbox.guideId.replace(/^page-/, '') as NavTab;
    if (!Object.prototype.hasOwnProperty.call(pageTours, tab) || !isTabAllowedForRole(tab, user.role_name)) return;
    return { id: `page-${tab}`, tab, title: pageHelp[tab].title, description: pageHelp[tab].description, roles: [user.role_name], steps: pageTours[tab] };
  }, [user?.role_name]);
  if (loading) return <div className="p-8 text-charcoal" role="status">Preparing sample workspace…</div>;
  if (!user || !initialGuide) return <div className="p-8 text-charcoal">This demo is unavailable for this account. Close or restart the demo to return.</div>;
  return <GuideDataProvider><MainLayout initialTab={initialGuide.tab} initialGuide={initialGuide} initialGuideStep={guideSandbox!.step} /></GuideDataProvider>;
}

export function App() {
  const invitationToken = window.location.hash.match(/^#\/invite\/([a-f0-9]{64})$/)?.[1];
  if (window.location.hash.startsWith("#/invite/")) return <EventInvitationPage token={invitationToken || ""} />;
  return <>
    <GlobalOperationIndicator />
    {guideSandbox ? <ToastProvider><AuthProvider><GuideSandboxWorkspace /><ToastContainer /></AuthProvider></ToastProvider> : <LiveApp />}
  </>;
}

export default App;
