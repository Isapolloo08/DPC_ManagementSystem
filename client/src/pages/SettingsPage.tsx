import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { SystemLookup, SystemSetting, Ministry, LookupType, NotificationEmailSettings, NotificationEventType, NotificationRule } from "../types";
import { SettingsPageSkeleton, CardGridSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import {
  Sliders, BookOpen, Users, Heart, Calendar, MessageSquare,
  Settings as SettingsIcon, Plus, Edit2, Trash2, CheckCircle2,
  AlertCircle, Search, RefreshCw, Layers, MapPin,
  Tag, Shield, Check, X, Info, Building2, Phone, Mail, Clock,
  FileText, UserCog, ChevronLeft, ChevronRight, Database, Bell, Send, LockKeyhole
} from "lucide-react";
import { useSocketEvent } from "../socket";
import { BackupManagementSection } from "../components/settings/BackupManagementSection";

type SettingsTab =
  | "bible_study_categories"
  | "locations"
  | "ministries"
  | "events"
  | "communications"
  | "membership"
  | "backup_restore"
  | "notifications_email"
  | "general";

const COLOR_PRESETS = [
  "#2C3968", "#D9A441", "#6E8B74", "#B85C56", "#E07A5F",
  "#4A5568", "#8D5B4C", "#3B82F6", "#8B5CF6", "#10B981",
  "#F59E0B", "#EC4899", "#6366F1", "#14B8A6", "#64748B"
];

interface SettingsPageProps {
  onNavigateToUsers?: () => void;
  initialTab?: SettingsTab;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigateToUsers, initialTab = 'ministries' }) => {
  const { user } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Tab horizontal scroll & drag states
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);
  const [lookups, setLookups] = useState<SystemLookup[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);

  const checkTabScroll = () => {
    const el = tabContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    }
  };

  useEffect(() => {
    checkTabScroll();
    const timer = setTimeout(checkTabScroll, 100);
    window.addEventListener("resize", checkTabScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkTabScroll);
    };
  }, [lookups, ministries]);

  const scrollTabs = (direction: "left" | "right") => {
    const el = tabContainerRef.current;
    if (el) {
      const scrollAmount = 260;
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
      setTimeout(checkTabScroll, 320);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = tabContainerRef.current;
    if (!el) return;
    setIsDragging(true);
    setDragStartX(e.pageX - el.offsetLeft);
    setDragScrollLeft(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const el = tabContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    el.scrollLeft = dragScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Data states

  const [generalSettings, setGeneralSettings] = useState<Record<string, string>>({});



  // Modal states
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [editingLookup, setEditingLookup] = useState<SystemLookup | null>(null);
  const [lookupFormData, setLookupFormData] = useState<{
    type: LookupType | string;
    name: string;
    description: string;
    color: string;
    sort_order: number;
    is_active: number;
  }>({
    type: "event_category",
    name: "",
    description: "",
    color: "#2C3968",
    sort_order: 0,
    is_active: 1
  });

  // Ministry Modal state
  const [isMinistryModalOpen, setIsMinistryModalOpen] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState<Ministry | null>(null);
  const [ministryFormData, setMinistryFormData] = useState({
    name: "",
    min_age: "" as number | string,
    max_age: "" as number | string,
    description: "",
    color: "#2C3968"
  });

  // Delete Confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "lookup" | "ministry" | "study_topic";
    id: number;
    name: string;
    usageCount?: number;
  } | null>(null);

  // General Settings Form state
  const [generalForm, setGeneralForm] = useState<Record<string, string>>({});
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
  const [emailSettings, setEmailSettings] = useState<NotificationEmailSettings & { smtpPassword: string }>({
    smtpHost: "", smtpPort: 587, smtpSecure: false, smtpUser: "", smtpPassword: "",
    fromName: "Daet Presbyterian Church", fromEmail: "", pastorEmail: "", hasSmtpPassword: false
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (user?.role_name === "Admin" || user?.role_name === "IT Admin" || user?.role_name === "Pastor") void loadNotificationSettings();
  }, [user?.role_name]);

  const loadNotificationSettings = async () => {
    try {
      const [rules, settings] = await Promise.all([
        api.getNotificationRules(),
        api.getNotificationEmailSettings()
      ]);
      setNotificationRules(rules);
      setEmailSettings({ ...settings, smtpPassword: "" });
    } catch (error) {
      console.error("Failed to load notification settings", error);
    }
  };

  const saveEmailSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingNotifications(true);
    try {
      const response = await api.updateNotificationEmailSettings(emailSettings);
      setEmailSettings({ ...response.settings, smtpPassword: "" });
      showToast("Notification and email settings saved", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save email settings", "error");
    } finally {
      setSavingNotifications(false);
    }
  };

  const updateEventRules = async (eventType: NotificationEventType, update: Partial<NotificationRule>) => {
    const matching = notificationRules.filter(rule => rule.event_type === eventType);
    try {
      await Promise.all(matching.map(rule => api.updateNotificationRule(rule.id, update)));
      setNotificationRules(previous => previous.map(rule => rule.event_type === eventType ? { ...rule, ...update } : rule));
      showToast("Notification rule updated", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update notification rule", "error");
    }
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const saved = await api.updateNotificationEmailSettings(emailSettings);
      setEmailSettings({ ...saved.settings, smtpPassword: "" });
      const response = await api.sendTestNotificationEmail(emailSettings.pastorEmail || emailSettings.fromEmail);
      showToast(response.message, "info", 6000);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to queue test email", "error");
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Real-time synchronization
  useSocketEvent("settings:changed", () => loadAllData());
  useSocketEvent("ministries:changed", () => loadAllData());
  useSocketEvent("lookups:changed", () => loadAllData());


 const loadAllData = async () => {
    guideData.clearError();
    setLoading(true);
    try {
      const [lookupsRes, ministriesRes, generalRes] = await Promise.all([
        api.getLookups().catch(err => {
          guideData.reportError(err);
          console.warn("Could not load lookups:", err);
          return [];
        }),
        api.getMinistries().catch(err => {
          guideData.reportError(err);
          console.warn("Could not load ministries:", err);
          return [];
        }),
        api.getGeneralSettings().catch(err => {
          guideData.reportError(err);
          console.warn("Could not load general settings:", err);
          return { settings: {}, list: [] };
        })
      ]);

      setLookups(Array.isArray(lookupsRes) ? lookupsRes : []);
      setMinistries(Array.isArray(ministriesRes) ? ministriesRes : []);
      const settingsMap = generalRes?.settings || {};
      setGeneralSettings(settingsMap);
      setGeneralForm(settingsMap);
    } catch (err: any) {
      console.error("Failed to load settings data:", err);
      guideData.reportError(err);
      showToast(err.message || "Failed to load settings data", "error");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Master Lookups Handlers
  // ----------------------------------------------------
  const handleOpenLookupModal = (type: LookupType | string, lookup?: SystemLookup) => {
    if (lookup) {
      setEditingLookup(lookup);
      setLookupFormData({
        type: lookup.type,
        name: lookup.name,
        description: lookup.description || "",
        color: lookup.color || "#2C3968",
        sort_order: lookup.sort_order || 0,
        is_active: lookup.is_active ?? 1
      });
    } else {
      setEditingLookup(null);
      setLookupFormData({
        type,
        name: "",
        description: "",
        color: COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)],
        sort_order: lookups.filter(l => l.type === type).length + 1,
        is_active: 1
      });
    }
    setIsLookupModalOpen(true);
  };

  const handleSaveLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupFormData.name.trim()) {
      showToast("Name is required", "error");
      return;
    }

    const dup = lookups.find(l =>
      l.type === lookupFormData.type &&
      l.name.toLowerCase().trim() === lookupFormData.name.toLowerCase().trim() &&
      l.id !== editingLookup?.id
    );
    if (dup) {
      showToast("A lookup item with this name already exists in this category", "error");
      return;
    }

    try {
      const payload = {
        ...lookupFormData,
        name: lookupFormData.name.trim(),
        description: lookupFormData.description ? lookupFormData.description.trim() : ""
      };

      if (editingLookup) {
        await api.updateLookup(editingLookup.id, payload);
        showToast(`'${lookupFormData.name.trim()}' updated successfully!`);
      } else {
        await api.createLookup(payload);
        showToast(`'${lookupFormData.name.trim()}' created successfully!`);
      }
      setIsLookupModalOpen(false);
      const updatedLookups = await api.getLookups();
      setLookups(updatedLookups);
    } catch (err: any) {
      showToast(err.message || "Failed to save category", "error");
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;
    const item = deleteConfirm;
    setDeleteConfirm(null);

    if (item.type === "lookup") {
      const removedLookup = lookups.find((l) => l.id === item.id);
      deleteWithUndo({
        itemName: item.name,
        itemType: "Item",
        onOptimisticDelete: () => {
          setLookups((prev) => prev.filter((l) => l.id !== item.id));
        },
        onRestore: () => {
          if (removedLookup) {
            setLookups((prev) => (prev.some((l) => l.id === item.id) ? prev : [...prev, removedLookup]));
          }
        },
        onCommitDelete: async () => {
          await api.deleteLookup(item.id);
        }
      });
    } else if (item.type === "ministry") {
      const removedMinistry = ministries.find((m) => m.id === item.id);
      deleteWithUndo({
        itemName: item.name,
        itemType: "Ministry",
        onOptimisticDelete: () => {
          setMinistries((prev) => prev.filter((m) => m.id !== item.id));
        },
        onRestore: () => {
          if (removedMinistry) {
            setMinistries((prev) => (prev.some((m) => m.id === item.id) ? prev : [...prev, removedMinistry]));
          }
        },
        onCommitDelete: async () => {
          await api.deleteMinistry(item.id);
        }
      });
    }
  };

  // ----------------------------------------------------
  // Ministry Handlers
  // ----------------------------------------------------
  const handleOpenMinistryModal = (ministry?: Ministry) => {
    if (ministry) {
      setEditingMinistry(ministry);
      setMinistryFormData({
        name: ministry.name,
        min_age: ministry.min_age !== null ? ministry.min_age : "",
        max_age: ministry.max_age !== null ? ministry.max_age : "",
        description: ministry.description || "",
        color: ministry.color || "#2C3968"
      });
    } else {
      setEditingMinistry(null);
      setMinistryFormData({
        name: "",
        min_age: "",
        max_age: "",
        description: "",
        color: COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]
      });
    }
    setIsMinistryModalOpen(true);
  };

  const handleSaveMinistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryFormData.name.trim()) {
      showToast("Ministry name is required", "error");
      return;
    }

    const dupMin = ministries.find(m =>
      m.name.toLowerCase().trim() === ministryFormData.name.toLowerCase().trim() &&
      m.id !== editingMinistry?.id
    );
    if (dupMin) {
      showToast("A ministry with this name already exists", "error");
      return;
    }

    const minAgeVal = ministryFormData.min_age === "" ? null : Number(ministryFormData.min_age);
    const maxAgeVal = ministryFormData.max_age === "" ? null : Number(ministryFormData.max_age);

    if (minAgeVal !== null && maxAgeVal !== null && minAgeVal > maxAgeVal) {
      showToast("Minimum age cannot be greater than maximum age", "error");
      return;
    }

    try {
      const payload = {
        ...ministryFormData,
        name: ministryFormData.name.trim(),
        description: ministryFormData.description ? ministryFormData.description.trim() : "",
        min_age: minAgeVal,
        max_age: maxAgeVal
      };

      if (editingMinistry) {
        await api.updateMinistry(editingMinistry.id, payload);
        showToast(`Ministry '${ministryFormData.name.trim()}' updated successfully!`);
      } else {
        await api.createMinistry(payload);
        showToast(`Ministry '${ministryFormData.name.trim()}' created successfully!`);
      }
      setIsMinistryModalOpen(false);
      const updated = await api.getMinistries();
      setMinistries(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to save ministry", "error");
    }
  };

  // ----------------------------------------------------
  // General Settings Handlers
  // ----------------------------------------------------
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      await api.updateGeneralSettings(generalForm);
      setGeneralSettings(generalForm);
      showToast("General church settings saved successfully!");
    } catch (err: any) {
      showToast(err.message || "Failed to save settings", "error");
    } finally {
      setSavingGeneral(false);
    }
  };

  // ----------------------------------------------------
  // Filter lookups for active tab
  // ----------------------------------------------------
  const getLookupsForType = (type: string) => {
    return lookups
      .filter(l => l.type === type)
      .filter(l => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
        );
      });
  };

  const isSuperAdmin = user?.role_name === "Admin" || user?.role_name === "IT Admin";
  const isPastorOrAdmin = isSuperAdmin || user?.role_name === "Pastor";

  useEffect(() => {
    if (!isSuperAdmin && activeTab === "backup_restore") {
      setActiveTab("ministries");
    } else if (!isPastorOrAdmin && activeTab === "notifications_email") {
      setActiveTab("ministries");
    }
  }, [isSuperAdmin, isPastorOrAdmin, activeTab]);

  const allTabs: { id: SettingsTab; label: string; icon: React.ReactNode; count?: number | string }[] = [
    {
      id: "bible_study_categories",
      label: "Bible Study Categories",
      icon: <BookOpen className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "bible_study_category").length
    },
    {
      id: "locations",
      label: "Meeting Rooms & Locations",
      icon: <MapPin className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "event_location").length
    },
    {
      id: "ministries",
      label: "Ministries & Age Brackets",
      icon: <Users className="w-4 h-4" />,
      count: ministries.length
    },
    {
      id: "events",
      label: "Event Categories",
      icon: <Calendar className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "event_category").length
    },
    {
      id: "communications",
      label: "Announcements & Broadcasts",
      icon: <MessageSquare className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "announcement_category").length
    },
    {
      id: "membership",
      label: "Membership Statuses",
      icon: <Shield className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "member_status").length
    },
    {
      id: "backup_restore",
      label: "Backup & Data Management",
      icon: <Database className="w-4 h-4" />
    },
    {
      id: "notifications_email",
      label: "Notifications & Email",
      icon: <Bell className="w-4 h-4" />,
      count: notificationRules.filter(rule => rule.enabled).length
    },
    {
      id: "general",
      label: "Church Profile & Config",
      icon: <SettingsIcon className="w-4 h-4" />
    }
  ];

  // Pastor and Admin can see Notifications & Email; only Super Admin can see Backup & Data Management
  const tabs = allTabs.filter(t => {
    if (t.id === "backup_restore") {
      return isSuperAdmin;
    }
    if (t.id === "notifications_email") {
      return isPastorOrAdmin;
    }
    return true;
  });

  const guideData = useGuideDataState("settings", { loading, count: 1, retry: loadAllData });

  if (loading && lookups.length === 0 && ministries.length === 0) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 lg:p-8 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-medium uppercase tracking-wider backdrop-blur-md">
              <Sliders className="w-3.5 h-3.5 text-amber-300" />
              <span>Church Configuration & Master Tables</span>
            </div>
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight">
            System Settings & Lookups
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed font-medium">
            Configure church profile, ministry master lookups, member statuses, rooms, sanctuaries, and relationships.
          </p>
        </div>
      </div>

      {/* TOP: Settings Navigation Tabs with Left & Right Scroll Buttons + Drag-to-Scroll */}
      <div className="relative flex items-center gap-2 group/tabstrip bg-slate-50/70 p-1.5 rounded-2xl border border-indigo-100/60 shadow-2xs">
        {/* Scroll Left Button */}
        <button
          type="button"
          onClick={() => scrollTabs("left")}
          disabled={!canScrollLeft}
          title="Scroll Left"
          aria-label="Scroll tabs left"
          className={`shrink-0 z-10 w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200 cursor-pointer ${canScrollLeft
              ? "bg-white hover:bg-indigo-50 text-indigo border-indigo-200 shadow-sm hover:shadow-md active:scale-95 opacity-100"
              : "bg-slate-100 text-charcoal/20 border-transparent cursor-not-allowed opacity-20"
            }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable & Draggable Tabs Container */}
        <div
          ref={tabContainerRef}
          onScroll={checkTabScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-guide={`settings-${tab.id}`}
                aria-pressed={isActive}
                onClick={() => {
                  if (!isDragging) {
                    setActiveTab(tab.id);
                    setSearchTerm("");
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${isActive
                    ? "bg-indigo text-white shadow-md shadow-indigo-950/20"
                    : "bg-white hover:bg-indigo-50/80 text-charcoal/70 hover:text-indigo border border-indigo-100/80 hover:border-indigo-200 shadow-2xs"
                  }`}
              >
                <span className={isActive ? "text-amber-400" : "text-indigo/70"}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${isActive
                        ? "bg-white/20 text-white"
                        : "bg-indigo-50 text-indigo border border-indigo-100/60"
                      }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={() => scrollTabs("right")}
          disabled={!canScrollRight}
          title="Scroll Right"
          aria-label="Scroll tabs right"
          className={`shrink-0 z-10 w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200 cursor-pointer ${canScrollRight
              ? "bg-white hover:bg-indigo-50 text-indigo border-indigo-200 shadow-sm hover:shadow-md active:scale-95 opacity-100"
              : "bg-slate-100 text-charcoal/20 border-transparent cursor-not-allowed opacity-20"
            }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-transparent rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-sm ring-4 ring-amber-100/50">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-2xl lg:text-3xl font-semibold text-indigo tracking-tight">
              System Settings & Dropdowns
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/80 text-xs font-medium uppercase tracking-wider shadow-2xs">
              Lookups & Configuration
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed font-medium">
            Configure dynamic categories, ministry brackets, event rooms, and church preferences across the entire platform.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start md:self-auto relative z-10">
          {onNavigateToUsers && (
            <button
              onClick={onNavigateToUsers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <UserCog className="w-4 h-4 text-indigo-950" />
              <span>User Management (5 Roles)</span>
            </button>
          )}
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-indigo-50/60 border border-indigo-200/80 text-xs font-medium text-charcoal shadow-2xs hover:shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Workspace for Selected Tab */}
      <div className="space-y-6">

        {/* ==================================================== */}
        {/* 2. MINISTRIES TAB */}
        {/* ==================================================== */}
        {activeTab === "ministries" && (
          <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo" />
                  <span>Ministries & Age Demographics</span>
                </h2>
                <p className="text-xs text-muted">
                  Manage core ministry departments, target age ranges (for automatic age matching and aging-out alerts), and branding colors.
                </p>
              </div>
              <button data-guide="settings-ministry-new"
                onClick={() => handleOpenMinistryModal()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Ministry</span>
              </button>
            </div>

            {loading && ministries.length === 0 ? (
              <CardGridSkeleton count={6} columns={3} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ministries.map((min) => (
                  <div
                    key={min.id}
                    className="p-5 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-medium shadow-xs"
                          style={{ backgroundColor: min.color || "#2C3968" }}
                        >
                          {min.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-charcoal">{min.name}</h3>
                          <span className="text-[12px] font-medium text-muted">
                            {min.min_age !== null && min.max_age !== null
                              ? `Ages ${min.min_age} - ${min.max_age} yrs`
                              : min.min_age !== null
                                ? `Ages ${min.min_age}+ yrs`
                                : "All Ages"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-charcoal/70 line-clamp-2 leading-relaxed">
                      {min.description || "Ministry department description"}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                      <div className="bg-white p-2 rounded-xl border border-gray-100">
                        <span className="text-[12px] text-muted uppercase font-medium block">Members</span>
                        <span className="font-medium text-indigo">{min.active_members_count || 0} active</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-gray-100">
                        <span className="text-[12px] text-muted uppercase font-medium block">Age Bracket</span>
                        <span className="font-medium text-charcoal">
                          {min.min_age !== null && min.min_age !== undefined ? `${min.min_age}-${min.max_age || '+'} yrs` : 'All Ages'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => handleOpenMinistryModal(min)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-indigo hover:bg-indigo-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({
                          type: "ministry",
                          id: min.id,
                          name: min.name,
                          usageCount: min.active_members_count
                        })}
                        className="p-1.5 hover:bg-rose-50 text-rose rounded-lg transition-colors"
                        title="Delete Ministry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* 1. BIBLE STUDY CATEGORIES TAB */}
        {/* ==================================================== */}
        {activeTab === "bible_study_categories" && (
          <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo" />
                  <span>Bible Study Group Categories</span>
                </h2>
                <p className="text-xs text-muted">
                  Categories used to classify Bible study and small groups in filters and creation forms.
                </p>
              </div>
              <button data-guide="settings-lookups-new"
                onClick={() => handleOpenLookupModal("bible_study_category")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Group Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {getLookupsForType("bible_study_category").map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: cat.color || "#2C3968" }}
                        />
                        <span className="font-medium text-xs text-charcoal">{cat.name}</span>
                      </div>
                      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo">
                        {cat.usage_count ?? 0} groups
                      </span>
                    </div>
                    <p className="text-[12px] text-charcoal/70 line-clamp-2 leading-relaxed">
                      {cat.description || "No description provided."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className={`text-[12px] font-medium px-1.5 py-0.5 rounded ${cat.is_active ? "text-emerald-700 bg-emerald-50" : "text-gray-500 bg-gray-100"
                      }`}>
                      {cat.is_active ? "Active" : "Inactive"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button data-guide="settings-lookups-new"
                        onClick={() => handleOpenLookupModal("bible_study_category", cat)}
                        className="p-1.5 hover:bg-indigo-50 text-indigo rounded-lg transition-colors"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({
                          type: "lookup",
                          id: cat.id,
                          name: cat.name,
                          usageCount: cat.usage_count
                        })}
                        className="p-1.5 hover:bg-rose-50 text-rose rounded-lg transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 2. MEETING ROOMS & LOCATIONS TAB */}
        {/* ==================================================== */}
        {activeTab === "locations" && (
          <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo" />
                  <span>Meeting Rooms & Locations</span>
                </h2>
                <p className="text-xs text-muted">
                  Standard rooms, campus halls, and off-site locations used for Bible study groups and event venues.
                </p>
              </div>
              <button data-guide="settings-lookups-new"
                onClick={() => handleOpenLookupModal("event_location")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Room / Location</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {getLookupsForType("event_location").map((loc) => (
                <div
                  key={loc.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-indigo-200 transition-all flex flex-col justify-between space-y-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo" />
                        <span className="font-medium text-xs text-charcoal">{loc.name}</span>
                      </div>
                    </div>
                    <p className="text-[12px] text-muted mt-1">
                      {loc.description || "Church facility room"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[12px] text-muted">
                      {loc.usage_count ?? 0} bookings
                    </span>
                    <div className="flex items-center gap-1">
                      <button data-guide="settings-lookups-new"
                        onClick={() => handleOpenLookupModal("event_location", loc)}
                        className="p-1 hover:bg-indigo-50 text-indigo rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({
                          type: "lookup",
                          id: loc.id,
                          name: loc.name,
                          usageCount: loc.usage_count
                        })}
                        className="p-1 hover:bg-rose-50 text-rose rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 3. EVENTS TAB */}
        {/* ==================================================== */}
        {activeTab === "events" && (
          <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo" />
                  <span>Event Categories & Types</span>
                </h2>
                <p className="text-xs text-muted">
                  Classifications for church calendar events (Sunday Worship, Midweek Prayer, Conferences, Outreach).
                </p>
              </div>
              <button data-guide="settings-lookups-new"
                onClick={() => handleOpenLookupModal("event_category")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Event Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {getLookupsForType("event_category").map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-indigo-200 transition-all flex flex-col justify-between space-y-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || "#2C3968" }}
                      />
                      <span className="font-medium text-xs text-charcoal">{cat.name}</span>
                    </div>
                    <p className="text-[12px] text-muted line-clamp-2">{cat.description || "Standard calendar event"}</p>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                    <button data-guide="settings-lookups-new"
                      onClick={() => handleOpenLookupModal("event_category", cat)}
                      className="p-1.5 hover:bg-indigo-50 text-indigo rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({
                        type: "lookup",
                        id: cat.id,
                        name: cat.name
                      })}
                      className="p-1.5 hover:bg-rose-50 text-rose rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 5. COMMUNICATIONS & ANNOUNCEMENTS TAB */}
        {/* ==================================================== */}
        {activeTab === "communications" && (
          <div className="space-y-6">
            {/* Announcement Categories */}
            <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo" />
                    <span>Announcement Priority & Types</span>
                  </h2>
                  <p className="text-xs text-muted">
                    Categories for church news bulletins (General, Urgent, Ministry Update, Special Events).
                  </p>
                </div>
                <button data-guide="settings-lookups-new"
                  onClick={() => handleOpenLookupModal("announcement_category")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Announcement Tag</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {getLookupsForType("announcement_category").map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-indigo-200 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || "#2C3968" }}
                      />
                      <div>
                        <span className="font-medium text-xs text-charcoal block">{cat.name}</span>
                        <span className="text-[12px] text-muted">{cat.description}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button data-guide="settings-lookups-new"
                        onClick={() => handleOpenLookupModal("announcement_category", cat)}
                        className="p-1 hover:bg-indigo-50 text-indigo rounded transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({
                          type: "lookup",
                          id: cat.id,
                          name: cat.name
                        })}
                        className="p-1 hover:bg-rose-50 text-rose rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 6. MEMBERSHIP STATUSES TAB */}
        {/* ==================================================== */}
        {activeTab === "membership" && (
          <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo" />
                  <span>Membership Statuses & Stages</span>
                </h2>
                <p className="text-xs text-muted">
                  Status types assigned to church records (Active, Inactive, Visitor, Candidate for Baptism, Regular Attendee).
                </p>
              </div>
              <button data-guide="settings-lookups-new"
                onClick={() => handleOpenLookupModal("member_status")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Membership Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getLookupsForType("member_status").map((status) => (
                <div
                  key={status.id}
                  className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-indigo-200 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: status.color || "#10B981" }}
                        />
                        <span className="font-medium text-sm text-charcoal">{status.name}</span>
                      </div>
                      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo">
                        {status.usage_count ?? 0} members
                      </span>
                    </div>
                    <p className="text-xs text-charcoal/70 leading-relaxed">
                      {status.description || "Membership lifecycle state"}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-100">
                    <button data-guide="settings-lookups-new"
                      onClick={() => handleOpenLookupModal("member_status", status)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium text-indigo hover:bg-indigo-50 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({
                        type: "lookup",
                        id: status.id,
                        name: status.name,
                        usageCount: status.usage_count
                      })}
                      className="p-1 hover:bg-rose-50 text-rose rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 6.5. DATABASE BACKUP & DATA MANAGEMENT */}
        {/* ==================================================== */}
        {activeTab === "backup_restore" && (user?.role_name === "Admin" || user?.role_name === "IT Admin") && (
          <BackupManagementSection onShowToast={showToast} />
        )}

        {/* ==================================================== */}
        {/* 7. NOTIFICATIONS & EMAIL */}
        {/* ==================================================== */}
        {activeTab === "notifications_email" && (user?.role_name === "Admin" || user?.role_name === "IT Admin" || user?.role_name === "Pastor") && (
          <div className="space-y-6">
            <form data-guide="settings-email-form" onSubmit={saveEmailSettings} className="bg-white rounded-2xl p-5 sm:p-7 border border-indigo-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-semibold text-indigo-950 flex items-center gap-2"><Mail className="w-5 h-5 text-amber-500" /> SMTP email delivery</h2>
                  <p className="text-xs text-slate-500 mt-1">Messages are queued locally and retried up to five times when internet access returns.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[12px] font-medium"><LockKeyhole className="w-3.5 h-3.5" /> App password encrypted</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="space-y-1.5"><span className="text-xs font-medium text-slate-700">SMTP host</span><input value={emailSettings.smtpHost} onChange={event => setEmailSettings(value => ({ ...value, smtpHost: event.target.value }))} placeholder="smtp.gmail.com" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-slate-700">SMTP port</span><input type="number" min={1} max={65535} value={emailSettings.smtpPort} onChange={event => setEmailSettings(value => ({ ...value, smtpPort: Number(event.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-slate-700">SMTP username</span><input value={emailSettings.smtpUser} onChange={event => setEmailSettings(value => ({ ...value, smtpUser: event.target.value }))} autoComplete="off" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-slate-700">App password</span><input type="password" value={emailSettings.smtpPassword} onChange={event => setEmailSettings(value => ({ ...value, smtpPassword: event.target.value }))} autoComplete="new-password" placeholder={emailSettings.hasSmtpPassword ? "Saved — enter to replace" : "Enter app password"} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-slate-700">From name</span><input value={emailSettings.fromName} onChange={event => setEmailSettings(value => ({ ...value, fromName: event.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-slate-700">From email</span><input type="email" value={emailSettings.fromEmail} onChange={event => setEmailSettings(value => ({ ...value, fromEmail: event.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="space-y-1.5 md:col-span-2"><span className="text-xs font-medium text-slate-700">Pastor notification email</span><input type="email" value={emailSettings.pastorEmail} onChange={event => setEmailSettings(value => ({ ...value, pastorEmail: event.target.value }))} placeholder="pastor@example.org" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" /></label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 self-end"><input type="checkbox" checked={emailSettings.smtpSecure} onChange={event => setEmailSettings(value => ({ ...value, smtpSecure: event.target.checked }))} className="w-4 h-4 accent-indigo-700" /><span><strong className="block text-xs text-slate-700">Use secure SMTP</strong><small className="text-[12px] text-slate-500">Usually enabled for port 465</small></span></label>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex gap-3"><Info className="w-5 h-5 text-amber-600 shrink-0" /><p><strong>Privacy:</strong> Absence emails contain member names. They are sent only to recipients configured in the rules below. Review recipient addresses before enabling email delivery.</p></div>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button type="button" onClick={() => void sendTestEmail()} disabled={sendingTestEmail || (!emailSettings.pastorEmail && !emailSettings.fromEmail)} className="px-4 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-indigo-50"><Send className="w-4 h-4" />{sendingTestEmail ? "Queuing…" : "Send test email"}</button>
                <button data-guide="settings-email-save" type="submit" disabled={savingNotifications} className="px-5 py-2.5 rounded-xl bg-indigo-700 text-white text-xs font-medium disabled:opacity-50 hover:bg-indigo-800">{savingNotifications ? "Saving…" : "Save email settings"}</button>
              </div>
            </form>

            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-indigo-100 shadow-sm space-y-4">
              <div><h2 className="text-lg font-semibold text-indigo-950 flex items-center gap-2"><Bell className="w-5 h-5 text-amber-500" /> Event delivery rules</h2><p className="text-xs text-slate-500 mt-1">Role and ministry recipient scopes are resolved automatically for each event.</p></div>
              <div className="space-y-3">
                {Array.from(new Set(notificationRules.map(rule => rule.event_type))).map(eventType => {
                  const rules = notificationRules.filter(rule => rule.event_type === eventType);
                  const enabled = rules.some(rule => rule.enabled);
                  const inApp = rules.some(rule => rule.in_app_enabled);
                  const email = rules.some(rule => rule.email_enabled);
                  const threshold = rules.find(rule => rule.threshold !== null)?.threshold || 3;
                  const label = eventType.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
                  return (
                    <div key={eventType} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0"><h3 className="text-sm font-semibold text-indigo-950">{label}</h3><p className="text-[12px] text-slate-500 mt-1">Recipients: {rules.map(rule => rule.recipient_value === "pastor" ? "Pastor email" : rule.recipient_value).join(", ")}</p></div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={enabled} onChange={event => void updateEventRules(eventType, { enabled: event.target.checked })} className="accent-indigo-700" /> Enabled</label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={inApp} onChange={event => void updateEventRules(eventType, { in_app_enabled: event.target.checked })} className="accent-indigo-700" /> In-app</label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={email} onChange={event => void updateEventRules(eventType, { email_enabled: event.target.checked })} className="accent-indigo-700" /> Email</label>
                        {(eventType === "absence_alert" || eventType === "sunday_absence_streak" || eventType === "at_risk_member") && <label className="flex items-center gap-2 text-xs font-medium text-slate-700">Threshold <input type="number" min={1} max={12} value={threshold} onChange={event => void updateEventRules(eventType, { threshold: Number(event.target.value) })} className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 bg-white" /></label>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[12px] text-slate-400">At-risk, Sunday streak, duty, and dishwashing rules are ready for their later event hooks. Absence and reschedule events are active now.</p>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 8. BACKUP, RESTORE & DATA MANAGEMENT TAB */}
        {/* ==================================================== */}
        {activeTab === "backup_restore" && (
          <BackupManagementSection onShowToast={showToast} />
        )}

        {/* ==================================================== */}
        {/* 8. GENERAL CHURCH SETTINGS */}
        {/* ==================================================== */}
        {activeTab === "general" && (
          <form data-guide="settings-general-form" onSubmit={handleSaveGeneralSettings} className="bg-white rounded-2xl p-6 lg:p-8 border border-indigo-100 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo" />
                  <span>Church Profile & System Preferences</span>
                </h2>
                <p className="text-xs text-muted">
                  Global branding, contact numbers, security prefixes, and Sunday live service configurations.
                </p>
              </div>
              <button data-guide="settings-general-save"
                type="submit"
                disabled={savingGeneral}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs shrink-0 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingGeneral ? "Saving Changes..." : "Save Preferences"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Church Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo" />
                  <span>Church Name</span>
                </label>
                <input data-guide="settings-church-name"
                  type="text"
                  value={generalForm.church_name || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, church_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="e.g. Daet Presbyterian Church"
                />
              </div>

              {/* Pastor Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo" />
                  <span>Senior Pastor / Minister</span>
                </label>
                <input
                  type="text"
                  value={generalForm.pastor_name || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, pastor_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="e.g. Rev. David Admin"
                />
              </div>

              {/* Tagline / Mission */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-charcoal">
                  Church Motto / Mission Tagline
                </label>
                <input
                  type="text"
                  value={generalForm.church_tagline || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, church_tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="Rooted in Faith, Growing in Community..."
                />
              </div>

              {/* Church Address */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo" />
                  <span>Physical Address & Location</span>
                </label>
                <input
                  type="text"
                  value={generalForm.address || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="Street address, City, Province"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo" />
                  <span>Contact Phone Number</span>
                </label>
                <input
                  type="text"
                  value={generalForm.contact_phone || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, contact_phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="+63 (54) 440-1984"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo" />
                  <span>Official Church Email</span>
                </label>
                <input
                  type="email"
                  value={generalForm.contact_email || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, contact_email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="office@daetpresbyterian.org"
                />
              </div>

              {/* Service Times */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo" />
                  <span>Sunday Worship & Fellowship Times</span>
                </label>
                <input
                  type="text"
                  value={generalForm.sunday_service_time || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, sunday_service_time: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="09:30 AM (Morning Worship), 04:30 PM (Vesper Fellowship)"
                />
              </div>

              {/* Security Code Prefix */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-charcoal flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo" />
                  <span>Sunday Check-In Security Code Prefix</span>
                </label>
                <input
                  type="text"
                  value={generalForm.security_code_prefix || "DPC"}
                  onChange={(e) => setGeneralForm({ ...generalForm, security_code_prefix: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="DPC"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button data-guide="settings-general-save"
                type="submit"
                disabled={savingGeneral}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingGeneral ? "Saving Changes..." : "Save Preferences"}</span>
              </button>
            </div>
          </form>
        )}
      </div>



      {/* ==================================================== */}
      {/* MODAL: Add / Edit Master Lookup */}
      {/* ==================================================== */}
      {isLookupModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div data-modal-header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-medium shadow-2xs"
                  style={{ backgroundColor: lookupFormData.color }}
                >
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-semibold text-base text-charcoal">
                  {editingLookup ? "Edit Category Item" : "New Category Item"}
                </h3>
              </div>
              <button
                onClick={() => setIsLookupModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-muted hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form data-guide="settings-lookup-form" onSubmit={handleSaveLookup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Name *</label>
                <input data-guide="settings-lookup-label"
                  type="text"
                  required
                  placeholder="e.g. Young Professionals, Main Sanctuary..."
                  value={lookupFormData.name}
                  onChange={(e) => setLookupFormData({ ...lookupFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this category..."
                  value={lookupFormData.description}
                  onChange={(e) => setLookupFormData({ ...lookupFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none resize-none"
                />
              </div>

              {/* Color Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                  <span>Badge Color</span>
                  <span className="text-[12px] font-mono text-muted uppercase">{lookupFormData.color}</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setLookupFormData({ ...lookupFormData, color: col })}
                      className={`w-6 h-6 rounded-full transition-transform ${lookupFormData.color.toLowerCase() === col.toLowerCase()
                        ? "ring-2 ring-indigo ring-offset-2 scale-110"
                        : "hover:scale-105"
                        }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <input
                    type="color"
                    value={lookupFormData.color}
                    onChange={(e) => setLookupFormData({ ...lookupFormData, color: e.target.value })}
                    className="w-6 h-6 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                    title="Custom hex color"
                  />
                </div>
              </div>

              {/* Sort Order & Active */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-charcoal">Display Sort Order</label>
                  <input
                    type="number"
                    value={lookupFormData.sort_order}
                    onChange={(e) => setLookupFormData({ ...lookupFormData, sort_order: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-charcoal">Status</label>
                  <select
                    value={lookupFormData.is_active}
                    onChange={(e) => setLookupFormData({ ...lookupFormData, is_active: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div data-modal-footer className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsLookupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button data-guide="settings-lookup-save"
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs"
                >
                  {editingLookup ? "Save Changes" : "Create Item"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: Add / Edit Ministry */}
      {/* ==================================================== */}
      {isMinistryModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div data-modal-header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-medium shadow-2xs"
                  style={{ backgroundColor: ministryFormData.color }}
                >
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-semibold text-base text-charcoal">
                  {editingMinistry ? "Edit Ministry" : "Add New Ministry"}
                </h3>
              </div>
              <button
                onClick={() => setIsMinistryModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-muted hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form data-guide="settings-ministry-form" onSubmit={handleSaveMinistry} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Ministry Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Young Adult, Singles, Seniors..."
                  value={ministryFormData.name}
                  onChange={(e) => setMinistryFormData({ ...ministryFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-charcoal">Min Age (Years)</label>
                  <input
                    type="number"
                    placeholder="e.g. 18"
                    value={ministryFormData.min_age}
                    onChange={(e) => setMinistryFormData({ ...ministryFormData, min_age: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-charcoal">Max Age (Years)</label>
                  <input
                    type="number"
                    placeholder="e.g. 35"
                    value={ministryFormData.max_age}
                    onChange={(e) => setMinistryFormData({ ...ministryFormData, max_age: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Description</label>
                <textarea
                  rows={2}
                  placeholder="Target demographic, Sunday class goals..."
                  value={ministryFormData.description}
                  onChange={(e) => setMinistryFormData({ ...ministryFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none resize-none"
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                  <span>Department Brand Color</span>
                  <span className="text-[12px] font-mono text-muted uppercase">{ministryFormData.color}</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setMinistryFormData({ ...ministryFormData, color: col })}
                      className={`w-6 h-6 rounded-full transition-transform ${ministryFormData.color.toLowerCase() === col.toLowerCase()
                        ? "ring-2 ring-indigo ring-offset-2 scale-110"
                        : "hover:scale-105"
                        }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <input
                    type="color"
                    value={ministryFormData.color}
                    onChange={(e) => setMinistryFormData({ ...ministryFormData, color: e.target.value })}
                    className="w-6 h-6 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                </div>
              </div>

              <div data-modal-footer className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsMinistryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button data-guide="settings-ministry-save"
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-xs"
                >
                  {editingMinistry ? "Save Ministry" : "Create Ministry"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: Delete Confirmation */}
      {/* ==================================================== */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div data-modal-header className="space-y-4"><div className="w-10 h-10 rounded-xl bg-rose-50 text-rose flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-semibold text-base text-charcoal">Confirm Deletion</h3>
              <p className="text-xs text-charcoal/70">
                Are you sure you want to delete <span className="font-medium text-charcoal">"{deleteConfirm.name}"</span>?
              </p>
              {deleteConfirm.usageCount !== undefined && deleteConfirm.usageCount > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900 text-left">
                  <span className="font-medium">Notice:</span> This item is currently referenced by {deleteConfirm.usageCount} records.
                </div>
              )}
            </div></div>

            <div data-modal-footer className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-xs font-medium text-charcoal/70 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 rounded-xl text-xs font-medium bg-rose text-white hover:bg-rose-900 transition-colors shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}
    </div>
  );
};
