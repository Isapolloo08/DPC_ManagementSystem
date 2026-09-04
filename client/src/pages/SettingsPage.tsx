import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { SystemLookup, SystemSetting, Ministry, Fund, LookupType } from "../types";
import { 
  Sliders, BookOpen, Users, Heart, Calendar, MessageSquare, 
  Settings as SettingsIcon, Plus, Edit2, Trash2, CheckCircle2, 
  AlertCircle, Search, RefreshCw, Layers, MapPin, DollarSign, 
  Tag, Shield, Check, X, Info, Sparkles, Building2, Phone, Mail, Clock,
  FileText, UserCog
} from "lucide-react";

type SettingsTab = 
  | "bible_study_categories"
  | "locations"
  | "ministries"
  | "events"
  | "communications"
  | "membership"
  | "general";

const COLOR_PRESETS = [
  "#2C3968", "#D9A441", "#6E8B74", "#B85C56", "#E07A5F", 
  "#4A5568", "#8D5B4C", "#3B82F6", "#8B5CF6", "#10B981", 
  "#F59E0B", "#EC4899", "#6366F1", "#14B8A6", "#64748B"
];

interface SettingsPageProps {
  onNavigateToUsers?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigateToUsers }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("ministries");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Data states
  const [lookups, setLookups] = useState<SystemLookup[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [generalSettings, setGeneralSettings] = useState<Record<string, string>>({});

  // Feedback toast state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  // Fund Modal state
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [fundFormData, setFundFormData] = useState({
    name: "",
    description: "",
    target_amount: 0
  });

  // Delete Confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "lookup" | "ministry" | "fund" | "study_topic";
    id: number;
    name: string;
    usageCount?: number;
  } | null>(null);

  // General Settings Form state
  const [generalForm, setGeneralForm] = useState<Record<string, string>>({});
  const [savingGeneral, setSavingGeneral] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [lookupsRes, ministriesRes, fundsRes, generalRes] = await Promise.all([
        api.getLookups().catch(err => {
          console.warn("Could not load lookups:", err);
          return [];
        }),
        api.getMinistries().catch(err => {
          console.warn("Could not load ministries:", err);
          return [];
        }),
        api.getFunds().catch(err => {
          console.warn("Could not load funds:", err);
          return [];
        }),
        api.getGeneralSettings().catch(err => {
          console.warn("Could not load general settings:", err);
          return { settings: {}, list: [] };
        })
      ]);

      setLookups(Array.isArray(lookupsRes) ? lookupsRes : []);
      setMinistries(Array.isArray(ministriesRes) ? ministriesRes : []);
      setFunds(Array.isArray(fundsRes) ? fundsRes : []);
      const settingsMap = generalRes?.settings || {};
      setGeneralSettings(settingsMap);
      setGeneralForm(settingsMap);
    } catch (err: any) {
      console.error("Failed to load settings data:", err);
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

    try {
      if (editingLookup) {
        await api.updateLookup(editingLookup.id, lookupFormData);
        showToast(`'${lookupFormData.name}' updated successfully!`);
      } else {
        await api.createLookup(lookupFormData);
        showToast(`'${lookupFormData.name}' created successfully!`);
      }
      setIsLookupModalOpen(false);
      const updatedLookups = await api.getLookups();
      setLookups(updatedLookups);
    } catch (err: any) {
      showToast(err.message || "Failed to save category", "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "lookup") {
        await api.deleteLookup(deleteConfirm.id);
        setLookups(prev => prev.filter(l => l.id !== deleteConfirm.id));
        showToast(`'${deleteConfirm.name}' deleted successfully!`);
      } else if (deleteConfirm.type === "ministry") {
        await api.deleteMinistry(deleteConfirm.id);
        setMinistries(prev => prev.filter(m => m.id !== deleteConfirm.id));
        showToast(`Ministry '${deleteConfirm.name}' deleted successfully!`);
      } else if (deleteConfirm.type === "fund") {
        await api.deleteFund(deleteConfirm.id);
        setFunds(prev => prev.filter(f => f.id !== deleteConfirm.id));
        showToast(`Fund '${deleteConfirm.name}' deleted successfully!`);
      }
      setDeleteConfirm(null);
    } catch (err: any) {
      showToast(err.message || "Failed to delete item", "error");
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

    try {
      const payload = {
        ...ministryFormData,
        min_age: ministryFormData.min_age === "" ? null : Number(ministryFormData.min_age),
        max_age: ministryFormData.max_age === "" ? null : Number(ministryFormData.max_age)
      };

      if (editingMinistry) {
        await api.updateMinistry(editingMinistry.id, payload);
        showToast(`Ministry '${ministryFormData.name}' updated successfully!`);
      } else {
        await api.createMinistry(payload);
        showToast(`Ministry '${ministryFormData.name}' created successfully!`);
      }
      setIsMinistryModalOpen(false);
      const updated = await api.getMinistries();
      setMinistries(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to save ministry", "error");
    }
  };

  // ----------------------------------------------------
  // Fund Handlers
  // ----------------------------------------------------
  const handleOpenFundModal = (fund?: Fund) => {
    if (fund) {
      setEditingFund(fund);
      setFundFormData({
        name: fund.name,
        description: fund.description || "",
        target_amount: fund.target_amount || 0
      });
    } else {
      setEditingFund(null);
      setFundFormData({
        name: "",
        description: "",
        target_amount: 50000
      });
    }
    setIsFundModalOpen(true);
  };

  const handleSaveFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundFormData.name.trim()) {
      showToast("Fund name is required", "error");
      return;
    }

    try {
      const payload = {
        ...fundFormData,
        target_amount: Number(fundFormData.target_amount) || 0
      };

      if (editingFund) {
        await api.updateFund(editingFund.id, payload);
        showToast(`Fund '${fundFormData.name}' updated successfully!`);
      } else {
        await api.createFund(payload);
        showToast(`Fund '${fundFormData.name}' created successfully!`);
      }
      setIsFundModalOpen(false);
      const updated = await api.getFunds();
      setFunds(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to save fund", "error");
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

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; count?: number | string }[] = [
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
      label: "Prayer & Announcements", 
      icon: <MessageSquare className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "prayer_topic" || l.type === "announcement_category").length
    },
    { 
      id: "membership", 
      label: "Membership Statuses", 
      icon: <Shield className="w-4 h-4" />,
      count: lookups.filter(l => l.type === "member_status").length
    },
    { 
      id: "general", 
      label: "Church Profile & Config", 
      icon: <SettingsIcon className="w-4 h-4" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-in slide-in-from-bottom-5 duration-200 ${
          toastMessage.type === "success" 
            ? "bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/20"
            : "bg-rose-900 text-white border-rose-700 shadow-rose-950/20"
        }`}>
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-indigo-500/5 via-amber-500/5 to-transparent rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-2xl lg:text-3xl font-black text-indigo tracking-tight">
              System Settings & Dropdowns
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/80 text-xs font-black uppercase tracking-wider shadow-2xs">
              Lookups & Configuration
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed font-medium">
            Configure dynamic categories, ministry brackets, stewardship funds, payment methods, event rooms, and church preferences across the entire platform.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start md:self-auto relative z-10">
          {onNavigateToUsers && (
            <button
              onClick={onNavigateToUsers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <UserCog className="w-4 h-4 text-indigo-950" />
              <span>User Management (5 Roles)</span>
            </button>
          )}
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-indigo-50/60 border border-indigo-200/80 text-xs font-bold text-charcoal shadow-2xs hover:shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-indigo-100/60 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm("");
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo text-white shadow-md shadow-indigo-950/20"
                  : "bg-white/80 hover:bg-white text-charcoal/70 hover:text-indigo border border-indigo-100/80 hover:border-indigo-200 shadow-2xs"
              }`}
            >
              <span className={isActive ? "text-amber-400" : "text-indigo/70"}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo border border-indigo-100/60"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
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
                <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo" />
                  <span>Ministries & Age Demographics</span>
                </h2>
                <p className="text-xs text-charcoal/60">
                  Manage core ministry departments, target age ranges (for automatic age matching and aging-out alerts), and branding colors.
                </p>
              </div>
              <button
                onClick={() => handleOpenMinistryModal()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Ministry</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ministries.map((min) => (
                <div
                  key={min.id}
                  className="p-5 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs"
                        style={{ backgroundColor: min.color || "#2C3968" }}
                      >
                        {min.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-charcoal">{min.name}</h3>
                        <span className="text-[11px] font-semibold text-charcoal/60">
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
                      <span className="text-[10px] text-charcoal/50 uppercase font-bold block">Members</span>
                      <span className="font-bold text-indigo">{min.active_members_count || 0} active</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-gray-100">
                      <span className="text-[10px] text-charcoal/50 uppercase font-bold block">Age Bracket</span>
                      <span className="font-bold text-charcoal">
                        {min.min_age !== null && min.min_age !== undefined ? `${min.min_age}-${min.max_age || '+'} yrs` : 'All Ages'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleOpenMinistryModal(min)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-indigo hover:bg-indigo-50 transition-colors"
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
          </div>
        )}

        {/* ==================================================== */}
        {/* 1. BIBLE STUDY CATEGORIES TAB */}
        {/* ==================================================== */}
        {activeTab === "bible_study_categories" && (
          <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo" />
                  <span>Bible Study Group Categories</span>
                </h2>
                <p className="text-xs text-charcoal/60">
                  Categories used to classify Bible study and small groups in filters and creation forms.
                </p>
              </div>
              <button
                onClick={() => handleOpenLookupModal("bible_study_category")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
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
                        <span className="font-bold text-xs text-charcoal">{cat.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo">
                        {cat.usage_count ?? 0} groups
                      </span>
                    </div>
                    <p className="text-[11px] text-charcoal/70 line-clamp-2 leading-relaxed">
                      {cat.description || "No description provided."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      cat.is_active ? "text-emerald-700 bg-emerald-50" : "text-gray-500 bg-gray-100"
                    }`}>
                      {cat.is_active ? "Active" : "Inactive"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
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
                <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo" />
                  <span>Meeting Rooms & Locations</span>
                </h2>
                <p className="text-xs text-charcoal/60">
                  Standard rooms, campus halls, and off-site locations used for Bible study groups and event venues.
                </p>
              </div>
              <button
                onClick={() => handleOpenLookupModal("event_location")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
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
                        <span className="font-bold text-xs text-charcoal">{loc.name}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-charcoal/60 mt-1">
                      {loc.description || "Church facility room"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-charcoal/50">
                      {loc.usage_count ?? 0} bookings
                    </span>
                    <div className="flex items-center gap-1">
                      <button
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
                <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo" />
                  <span>Event Categories & Types</span>
                </h2>
                <p className="text-xs text-charcoal/60">
                  Classifications for church calendar events (Sunday Worship, Midweek Prayer, Conferences, Outreach).
                </p>
              </div>
              <button
                onClick={() => handleOpenLookupModal("event_category")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
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
                      <span className="font-bold text-xs text-charcoal">{cat.name}</span>
                    </div>
                    <p className="text-[11px] text-charcoal/60 line-clamp-2">{cat.description || "Standard calendar event"}</p>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                    <button
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
        {/* 5. COMMUNICATIONS & PRAYER TAB */}
        {/* ==================================================== */}
        {activeTab === "communications" && (
          <div className="space-y-6">
            {/* Prayer Topics */}
            <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo" />
                    <span>Prayer Request Topics & Tags</span>
                  </h2>
                  <p className="text-xs text-charcoal/60">
                    Topics used by members and intercessory teams (Healing, Family, Guidance, Missions, Thanksgiving).
                  </p>
                </div>
                <button
                  onClick={() => handleOpenLookupModal("prayer_topic")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Prayer Topic</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {getLookupsForType("prayer_topic").map((topic) => (
                  <div
                    key={topic.id}
                    className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-indigo-200 transition-all flex flex-col justify-between space-y-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: topic.color || "#10B981" }}
                        />
                        <span className="font-bold text-xs text-charcoal">{topic.name}</span>
                      </div>
                      <p className="text-[10px] text-charcoal/60 line-clamp-2">{topic.description}</p>
                    </div>

                    <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-gray-100">
                      <button
                        onClick={() => handleOpenLookupModal("prayer_topic", topic)}
                        className="p-1 hover:bg-indigo-50 text-indigo rounded transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({
                          type: "lookup",
                          id: topic.id,
                          name: topic.name
                        })}
                        className="p-1 hover:bg-rose-50 text-rose rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Announcement Categories */}
            <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo" />
                    <span>Announcement Priority & Types</span>
                  </h2>
                  <p className="text-xs text-charcoal/60">
                    Categories for church news bulletins (General, Urgent, Ministry Update, Special Events).
                  </p>
                </div>
                <button
                  onClick={() => handleOpenLookupModal("announcement_category")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
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
                        <span className="font-bold text-xs text-charcoal block">{cat.name}</span>
                        <span className="text-[10px] text-charcoal/50">{cat.description}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
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
                <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo" />
                  <span>Membership Statuses & Stages</span>
                </h2>
                <p className="text-xs text-charcoal/60">
                  Status types assigned to church records (Active, Inactive, Visitor, Candidate for Baptism, Regular Attendee).
                </p>
              </div>
              <button
                onClick={() => handleOpenLookupModal("member_status")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0"
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
                        <span className="font-bold text-sm text-charcoal">{status.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo">
                        {status.usage_count ?? 0} members
                      </span>
                    </div>
                    <p className="text-xs text-charcoal/70 leading-relaxed">
                      {status.description || "Membership lifecycle state"}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleOpenLookupModal("member_status", status)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-indigo hover:bg-indigo-50 transition-colors"
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
        {/* 7. GENERAL CHURCH SETTINGS */}
        {/* ==================================================== */}
        {activeTab === "general" && (
          <form onSubmit={handleSaveGeneralSettings} className="bg-white rounded-2xl p-6 lg:p-8 border border-indigo-100 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo" />
                  <span>Church Profile & System Preferences</span>
                </h2>
                <p className="text-xs text-charcoal/60">
                  Global branding, contact numbers, security prefixes, and Sunday live service configurations.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingGeneral}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs shrink-0 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingGeneral ? "Saving Changes..." : "Save Preferences"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Church Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo" />
                  <span>Church Name</span>
                </label>
                <input
                  type="text"
                  value={generalForm.church_name || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, church_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="e.g. Daet Presbyterian Church"
                />
              </div>

              {/* Pastor Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
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
                <label className="text-xs font-bold text-charcoal">
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
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo" />
                  <span>Physical Address & Location</span>
                </label>
                <input
                  type="text"
                  value={generalForm.church_address || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, church_address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="Street address, City, Province"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo" />
                  <span>Contact Phone Number</span>
                </label>
                <input
                  type="text"
                  value={generalForm.church_phone || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, church_phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="+63 (54) 440-1984"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo" />
                  <span>Official Church Email</span>
                </label>
                <input
                  type="email"
                  value={generalForm.church_email || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, church_email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="office@daetpresbyterian.org"
                />
              </div>

              {/* Service Times */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo" />
                  <span>Sunday Worship & Fellowship Times</span>
                </label>
                <input
                  type="text"
                  value={generalForm.sunday_service_times || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, sunday_service_times: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="09:30 AM (Morning Worship), 04:30 PM (Vesper Fellowship)"
                />
              </div>

              {/* Currency Symbol */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo" />
                  <span>Currency Symbol</span>
                </label>
                <input
                  type="text"
                  value={generalForm.currency_symbol || "₱"}
                  onChange={(e) => setGeneralForm({ ...generalForm, currency_symbol: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  placeholder="₱ or $"
                />
              </div>

              {/* Security Code Prefix */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-charcoal flex items-center gap-1.5">
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
              <button
                type="submit"
                disabled={savingGeneral}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
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
      {isLookupModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-2xs"
                  style={{ backgroundColor: lookupFormData.color }}
                >
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-black text-base text-charcoal">
                  {editingLookup ? "Edit Category Item" : "New Category Item"}
                </h3>
              </div>
              <button
                onClick={() => setIsLookupModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLookup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Young Professionals, Main Sanctuary..."
                  value={lookupFormData.name}
                  onChange={(e) => setLookupFormData({ ...lookupFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Description / Notes</label>
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
                <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                  <span>Badge Color</span>
                  <span className="text-[10px] font-mono text-charcoal/50 uppercase">{lookupFormData.color}</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setLookupFormData({ ...lookupFormData, color: col })}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        lookupFormData.color.toLowerCase() === col.toLowerCase()
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
                  <label className="text-xs font-bold text-charcoal">Display Sort Order</label>
                  <input
                    type="number"
                    value={lookupFormData.sort_order}
                    onChange={(e) => setLookupFormData({ ...lookupFormData, sort_order: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Status</label>
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsLookupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs"
                >
                  {editingLookup ? "Save Changes" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Add / Edit Ministry */}
      {/* ==================================================== */}
      {isMinistryModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-2xs"
                  style={{ backgroundColor: ministryFormData.color }}
                >
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-black text-base text-charcoal">
                  {editingMinistry ? "Edit Ministry" : "Add New Ministry"}
                </h3>
              </div>
              <button
                onClick={() => setIsMinistryModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMinistry} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Ministry Name *</label>
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
                  <label className="text-xs font-bold text-charcoal">Min Age (Years)</label>
                  <input
                    type="number"
                    placeholder="e.g. 18"
                    value={ministryFormData.min_age}
                    onChange={(e) => setMinistryFormData({ ...ministryFormData, min_age: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Max Age (Years)</label>
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
                <label className="text-xs font-bold text-charcoal">Description</label>
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
                <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                  <span>Department Brand Color</span>
                  <span className="text-[10px] font-mono text-charcoal/50 uppercase">{ministryFormData.color}</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setMinistryFormData({ ...ministryFormData, color: col })}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        ministryFormData.color.toLowerCase() === col.toLowerCase()
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsMinistryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs"
                >
                  {editingMinistry ? "Save Ministry" : "Create Ministry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Add / Edit Fund */}
      {/* ==================================================== */}
      {isFundModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo flex items-center justify-center text-xs font-bold">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-black text-base text-charcoal">
                  {editingFund ? "Edit Stewardship Fund" : "Create Stewardship Fund"}
                </h3>
              </div>
              <button
                onClick={() => setIsFundModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFund} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Fund Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Missions & Outreach, Sanctuary Building..."
                  value={fundFormData.name}
                  onChange={(e) => setFundFormData({ ...fundFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Target Campaign Goal ({generalSettings.currency_symbol || "₱"})</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={fundFormData.target_amount}
                  onChange={(e) => setFundFormData({ ...fundFormData, target_amount: Number(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Description / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Explain what donations to this fund will support..."
                  value={fundFormData.description}
                  onChange={(e) => setFundFormData({ ...fundFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFundModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs"
                >
                  {editingFund ? "Save Fund" : "Create Fund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Delete Confirmation */}
      {/* ==================================================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-black text-base text-charcoal">Confirm Deletion</h3>
              <p className="text-xs text-charcoal/70">
                Are you sure you want to delete <span className="font-bold text-charcoal">"{deleteConfirm.name}"</span>?
              </p>
              {deleteConfirm.usageCount !== undefined && deleteConfirm.usageCount > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 text-left">
                  <span className="font-bold">Notice:</span> This item is currently referenced by {deleteConfirm.usageCount} records.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-charcoal/70 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose text-white hover:bg-rose-900 transition-colors shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
