import React, { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { BibleStudyGroup, StudyTopic, StudyTopicsSummary, User } from "../types";
import { TimePickerInput } from "../components/common/TimePickerInput";
import {
  BookOpen, Plus, Users, Calendar, Clock, MapPin,
  Search, Filter, CheckCircle2, X, Phone, Sparkles,
  Layers, ShieldCheck, HeartHandshake,
  Award, CheckCheck, Library, BookmarkCheck,
  ChevronDown, User as UserIcon, Check, Edit
} from "lucide-react";

export const BibleStudyPage: React.FC = () => {
  const { user, ministries, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const [groups, setGroups] = useState<BibleStudyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [studySummary, setStudySummary] = useState<StudyTopicsSummary | null>(null);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [isJoinSuccess, setIsJoinSuccess] = useState<string | null>(null);
  const initialMinistry = isRestricted && allowedMinistries.length > 0
    ? String(allowedMinistries[0].id)
    : (selectedMinistryId ? String(selectedMinistryId) : "");

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterMinistry, setFilterMinistry] = useState<string>(initialMinistry);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<BibleStudyGroup | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    curriculum: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    leader_name: "",
    leader_contact: "",
    meeting_day: "Wednesday",
    meeting_time_start: "7:00 PM",
    meeting_time_end: "8:30 PM",
    location: "Fellowship Hall Room 201",
    category: "General",
    max_capacity: 12
  });

  useEffect(() => {
    if (isRestricted && allowedMinistries.length > 0) {
      setFilterMinistry(String(allowedMinistries[0].id));
      setFormData(prev => ({ ...prev, ministry_id: String(allowedMinistries[0].id) }));
    }
  }, [isRestricted, allowedMinistries]);

  const [systemCategories, setSystemCategories] = useState<string[]>([]);
  const [systemLocations, setSystemLocations] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // Searchable Dropdowns state & refs for Group Creation Modal
  const [leadersList, setLeadersList] = useState<{ id: string | number; name: string; contact: string; role_name?: string }[]>([]);
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
  const [isCurriculumDropdownOpen, setIsCurriculumDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

  // Group Members Enrollment State
  const [membersList, setMembersList] = useState<{ id: number; name: string; ministry_name?: string; age?: number }[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberQuery, setMemberQuery] = useState<string>("");
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  // Dedicated search queries so selected values don't filter out the list upon re-opening
  const [curriculumQuery, setCurriculumQuery] = useState<string>("");
  const [leaderQuery, setLeaderQuery] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState<string>("");

  const leaderRef = useRef<HTMLDivElement>(null);
  const curriculumRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const memberRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click and reset search queries
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leaderRef.current && !leaderRef.current.contains(e.target as Node)) {
        setIsLeaderDropdownOpen(false);
        setLeaderQuery("");
      }
      if (curriculumRef.current && !curriculumRef.current.contains(e.target as Node)) {
        setIsCurriculumDropdownOpen(false);
        setCurriculumQuery("");
      }
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setIsLocationDropdownOpen(false);
        setLocationQuery("");
      }
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setIsMemberDropdownOpen(false);
        setMemberQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultCategories = [
    "Men's Group",
    "Women's Group",
    "Couples / Family",
    "Youth",
    "Young Professionals",
    "Seniors",
    "General"
  ];

  const categories = useMemo(() => {
    const list = systemCategories.length > 0 ? systemCategories : defaultCategories;
    return ["All", ...list];
  }, [systemCategories]);

  const daysOfWeek = [
    "All Days",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ];

  useEffect(() => {
    loadLookups();
    loadLeaders();
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const res = await api.getMembers();
      if (res && Array.isArray(res)) {
        setMembersList(res.map(m => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          ministry_name: m.ministry_name,
          age: m.age
        })));
      }
    } catch (err) {
      console.warn("Could not load members for small group enrollment", err);
    }
  };

  const loadLeaders = async () => {
    try {
      const users = await api.getUsers();
      const leaderUsers = (users || []).filter(u =>
        u.role_name === "Leader" || u.role_name === "Coordinator" || u.role_name === "Admin"
      );
      const mapped = leaderUsers.map(u => ({
        id: u.id,
        name: u.name,
        contact: u.contact_phone || u.contact_email || u.email,
        role_name: u.role_name
      }));

      const knownFallbacks = [
        { id: "seed-1", name: "Daniel Cruz", contact: "leader.daniel@church.org", role_name: "Leader" },
        { id: "seed-2", name: "Arthur Bautista", contact: "+1 (555) 345-6789", role_name: "Leader" },
        { id: "seed-3", name: "Hannah Bautista", contact: "+1 (555) 345-6781", role_name: "Leader" },
        { id: "seed-4", name: "Maria Bautista", contact: "+1 (555) 345-6780", role_name: "Leader" },
        { id: "seed-5", name: "Roberto Santos", contact: "+1 (555) 234-5678", role_name: "Leader" },
        { id: "seed-6", name: "Elena Santos", contact: "+1 (555) 234-5679", role_name: "Leader" },
      ];

      const combined = [...mapped, ...knownFallbacks];
      const unique = Array.from(
        new Map(combined.map(item => [item.name.toLowerCase().trim(), item])).values()
      );
      setLeadersList(unique);
    } catch (err) {
      console.warn("Could not load users for leader options, using fallbacks", err);
      setLeadersList([
        { id: "seed-1", name: "Daniel Cruz", contact: "leader.daniel@church.org", role_name: "Leader" },
        { id: "seed-2", name: "Arthur Bautista", contact: "+1 (555) 345-6789", role_name: "Leader" },
        { id: "seed-3", name: "Hannah Bautista", contact: "+1 (555) 345-6781", role_name: "Leader" },
        { id: "seed-4", name: "Maria Bautista", contact: "+1 (555) 345-6780", role_name: "Leader" },
        { id: "seed-5", name: "Roberto Santos", contact: "+1 (555) 234-5678", role_name: "Leader" },
        { id: "seed-6", name: "Elena Santos", contact: "+1 (555) 234-5679", role_name: "Leader" },
      ]);
    }
  };

  // Filtered leaders by search query
  const filteredLeaders = useMemo(() => {
    const q = leaderQuery.toLowerCase().trim();
    if (!q) return leadersList;
    return leadersList.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.contact && l.contact.toLowerCase().includes(q)) ||
      (l.role_name && l.role_name.toLowerCase().includes(q))
    );
  }, [leadersList, leaderQuery]);

  // Combined and filtered curricula (church topics + Bible books)
  const allCurricula = useMemo(() => {
    const churchTopics = (studySummary?.topics || []).map(t => ({
      title: t.title,
      type: "curriculum",
      category: t.testament_or_category || "Church Topic",
      authorOrVerse: t.key_verse || t.lead_teacher || ""
    }));

    const bibleBooks = [
      { title: "Book of Romans", type: "bible_book", category: "New Testament" },
      { title: "Gospel of John", type: "bible_book", category: "New Testament" },
      { title: "Gospel of Matthew", type: "bible_book", category: "New Testament" },
      { title: "Gospel of Mark", type: "bible_book", category: "New Testament" },
      { title: "Gospel of Luke", type: "bible_book", category: "New Testament" },
      { title: "Acts of the Apostles", type: "bible_book", category: "New Testament" },
      { title: "1 & 2 Corinthians", type: "bible_book", category: "New Testament" },
      { title: "Galatians", type: "bible_book", category: "New Testament" },
      { title: "Ephesians", type: "bible_book", category: "New Testament" },
      { title: "Philippians", type: "bible_book", category: "New Testament" },
      { title: "Colossians", type: "bible_book", category: "New Testament" },
      { title: "1 & 2 Thessalonians", type: "bible_book", category: "New Testament" },
      { title: "1 & 2 Timothy", type: "bible_book", category: "New Testament" },
      { title: "Hebrews", type: "bible_book", category: "New Testament" },
      { title: "James", type: "bible_book", category: "New Testament" },
      { title: "1 & 2 Peter", type: "bible_book", category: "New Testament" },
      { title: "1, 2, 3 John", type: "bible_book", category: "New Testament" },
      { title: "Revelation", type: "bible_book", category: "New Testament" },
      { title: "Genesis", type: "bible_book", category: "Old Testament" },
      { title: "Exodus", type: "bible_book", category: "Old Testament" },
      { title: "Psalms", type: "bible_book", category: "Old Testament" },
      { title: "Proverbs", type: "bible_book", category: "Old Testament" },
      { title: "Ecclesiastes", type: "bible_book", category: "Old Testament" },
      { title: "Isaiah", type: "bible_book", category: "Old Testament" },
      { title: "Jeremiah", type: "bible_book", category: "Old Testament" },
      { title: "Daniel", type: "bible_book", category: "Old Testament" },
      { title: "Discipleship 101: Foundations", type: "curriculum", category: "Topical Track" },
      { title: "Sacred Marriage by Gary Thomas", type: "curriculum", category: "Family & Marriage" },
      { title: "The Cost of Discipleship", type: "curriculum", category: "Discipleship Track" }
    ];

    const map = new Map<string, { title: string; type: string; category: string; authorOrVerse?: string }>();
    [...churchTopics, ...bibleBooks].forEach(item => {
      if (!map.has(item.title.toLowerCase().trim())) {
        map.set(item.title.toLowerCase().trim(), item);
      }
    });
    return Array.from(map.values());
  }, [studySummary]);

  const filteredCurricula = useMemo(() => {
    const q = curriculumQuery.toLowerCase().trim();
    if (!q) return allCurricula;
    return allCurricula.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.authorOrVerse && c.authorOrVerse.toLowerCase().includes(q))
    );
  }, [allCurricula, curriculumQuery]);

  // Combined locations
  const allLocations = useMemo(() => {
    const defaultLocations = [
      "Fellowship Hall Room 201",
      "Sanctuary Library Room 201",
      "Fellowship Hall Cafe",
      "Youth Lounge / Room 102",
      "Room 105 (Annex)",
      "Main Sanctuary",
      "Prayer Room / Chapel",
      "Online / Zoom Video Conference",
      "Santos Residence (Home Group)",
      "Member Home / Off-Campus"
    ];
    return Array.from(new Set([...systemLocations, ...defaultLocations]));
  }, [systemLocations]);

  const filteredLocations = useMemo(() => {
    const q = locationQuery.toLowerCase().trim();
    if (!q) return allLocations;
    return allLocations.filter(loc => loc.toLowerCase().includes(q));
  }, [allLocations, locationQuery]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.toLowerCase().trim();
    if (!q) return membersList;
    return membersList.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.ministry_name && m.ministry_name.toLowerCase().includes(q))
    );
  }, [membersList, memberQuery]);

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        if (prev.length >= (Number(formData.max_capacity) || 12)) {
          alert(`Max capacity of ${formData.max_capacity} members reached!`);
          return prev;
        }
        return [...prev, memberId];
      }
    });
  };

  const loadLookups = async () => {
    try {
      const [catRes, locRes] = await Promise.all([
        api.getLookups({ type: "bible_study_category", active_only: true }),
        api.getLookups({ type: "event_location", active_only: true })
      ]);
      if (catRes && catRes.length > 0) {
        setSystemCategories(catRes.map(c => c.name));
      }
      if (locRes && locRes.length > 0) {
        setSystemLocations(locRes.map(l => l.name));
      }
    } catch (e) {
      console.warn("Using default category options", e);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [filterMinistry, selectedCategory, filterDay]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const [res, summary] = await Promise.all([
        api.getGroups({
          ministry_id: filterMinistry ? Number(filterMinistry) : undefined,
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          meeting_day: filterDay !== "all" && filterDay !== "All Days" ? filterDay : undefined
        }),
        api.getStudyTopics()
      ]);
      setGroups(res);
      setStudySummary(summary);
    } catch (err) {
      console.error("Failed to load Bible study groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingGroupId(null);
    setSelectedMemberIds([]);
    setMemberQuery("");
    setIsMemberDropdownOpen(false);
    setFormData({
      name: "",
      description: "",
      curriculum: "",
      ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
      leader_name: "",
      leader_contact: "",
      meeting_day: "Wednesday",
      meeting_time_start: "7:00 PM",
      meeting_time_end: "8:30 PM",
      location: "",
      category: "General",
      max_capacity: 12
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (group: BibleStudyGroup) => {
    setEditingGroupId(group.id);
    const existingIds = (group.members || [])
      .map((m: any) => m.member_id)
      .filter((id: any): id is number => typeof id === "number" && id > 0);
    setSelectedMemberIds(existingIds);
    setMemberQuery("");
    setIsMemberDropdownOpen(false);

    let start = "7:00 PM";
    let end = "8:30 PM";
    if (group.meeting_time) {
      if (group.meeting_time.includes("-")) {
        const parts = group.meeting_time.split("-");
        start = parts[0]?.trim() || "7:00 PM";
        end = parts[1]?.trim() || "";
      } else if (group.meeting_time.toLowerCase().includes("to")) {
        const parts = group.meeting_time.split(/to/i);
        start = parts[0]?.trim() || "7:00 PM";
        end = parts[1]?.trim() || "";
      } else {
        start = group.meeting_time.trim();
        end = "";
      }
    }

    setFormData({
      name: group.name,
      description: group.description || "",
      curriculum: group.curriculum || "",
      ministry_id: group.ministry_id ? String(group.ministry_id) : "",
      leader_name: group.leader_name || "",
      leader_contact: group.leader_contact || "",
      meeting_day: group.meeting_day || "Wednesday",
      meeting_time_start: start,
      meeting_time_end: end,
      location: group.location || "",
      category: group.category || "General",
      max_capacity: group.max_capacity || 12
    });
    setSelectedGroup(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedMeetingTime = formData.meeting_time_end
        ? `${formData.meeting_time_start} - ${formData.meeting_time_end}`
        : formData.meeting_time_start;

      const payload = {
        name: formData.name,
        description: formData.description,
        curriculum: formData.curriculum,
        leader_name: formData.leader_name,
        leader_contact: formData.leader_contact,
        meeting_day: formData.meeting_day,
        meeting_time: formattedMeetingTime,
        location: formData.location,
        category: formData.category,
        ministry_id: formData.ministry_id ? Number(formData.ministry_id) : null,
        max_capacity: Number(formData.max_capacity) || 12,
        member_ids: selectedMemberIds
      };

      if (editingGroupId) {
        await api.updateGroup(editingGroupId, payload);
      } else {
        await api.createGroup(payload);
      }

      setIsCreateModalOpen(false);
      setEditingGroupId(null);
      setIsLeaderDropdownOpen(false);
      setIsCurriculumDropdownOpen(false);
      setIsLocationDropdownOpen(false);
      setIsMemberDropdownOpen(false);
      setSelectedMemberIds([]);
      setMemberQuery("");
      setFormData({
        name: "",
        description: "",
        curriculum: "",
        ministry_id: "",
        leader_name: "",
        leader_contact: "",
        meeting_day: "Wednesday",
        meeting_time_start: "7:00 PM",
        meeting_time_end: "8:30 PM",
        location: "",
        category: "General",
        max_capacity: 12
      });
      loadGroups();
    } catch (err: any) {
      alert(err.message || "Failed to save Bible study group");
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.leader_name.toLowerCase().includes(q) ||
        (g.curriculum && g.curriculum.toLowerCase().includes(q)) ||
        (g.location && g.location.toLowerCase().includes(q)) ||
        (g.description && g.description.toLowerCase().includes(q))
      );
    });
  }, [groups, searchQuery]);

  const totalMembersEnrolled = useMemo(() => {
    return groups.reduce((sum, g) => sum + (g.current_member_count || 0), 0);
  }, [groups]);

  const canCreate = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {isJoinSuccess && (
        <div className="bg-sage-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-bold animate-bounce-subtle">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
            <span>{isJoinSuccess}</span>
          </div>
          <button onClick={() => setIsJoinSuccess(null)} className="p-1 hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber text-charcoal shadow-sm">
              <BookOpen className="w-5 h-5 text-indigo-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-charcoal">Bible Study & Discipleship Groups</h1>
              <p className="text-xs text-charcoal/60 mt-0.5">
                Small group fellowships, Scripture study circles, home meetings, and discipleship tracks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsCompletedModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3.5 py-2 rounded-xl text-xs shadow-2xs transition-all active:scale-95"
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Completed Books ({studySummary?.completed_count || 0})</span>
          </button>
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 bg-indigo hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>New Bible Study Group</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal/60">Active Small Groups</p>
            <h3 className="text-2xl font-black text-indigo mt-0.5">{groups.length}</h3>
            <p className="text-[10px] text-sage-700 font-bold mt-1">Across all ministries</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo rounded-2xl">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal/60">Total Enrolled Members</p>
            <h3 className="text-2xl font-black text-amber-600 mt-0.5">{totalMembersEnrolled}</h3>
            <p className="text-[10px] text-charcoal/50 font-bold mt-1">Discipleship participation</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal/60">Average Group Size</p>
            <h3 className="text-2xl font-black text-sage-800 mt-0.5">
              {groups.length > 0 ? Math.round(totalMembersEnrolled / groups.length) : 0} members
            </h3>
            <p className="text-[10px] text-charcoal/50 font-bold mt-1">Target capacity: 10-15</p>
          </div>
          <div className="p-3 bg-sage-50 text-sage-700 rounded-2xl">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setIsCompletedModalOpen(true)}
          className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all"
        >
          <div>
            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <span>Completed Books</span>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-extrabold">
                {studySummary?.completion_rate || 0}%
              </span>
            </p>
            <h3 className="text-2xl font-black text-emerald-900 mt-0.5">
              {studySummary?.completed_count || 0} Books
            </h3>
            <p className="text-[10px] text-emerald-700 font-bold mt-1 underline">
              View completed archive →
            </p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
            <CheckCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Multi-Level Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3">
        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-charcoal/60 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-amber-600" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === "All" ? "all" : cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${(selectedCategory === "all" && cat === "All") || selectedCategory === cat
                ? "bg-indigo text-white shadow-2xs ring-2 ring-indigo-200"
                : "bg-ivory-light text-charcoal/70 hover:bg-gray-100"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dropdowns & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Ministry Filter */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo shrink-0" />
              <select
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                disabled={isRestricted && allowedMinistries.length <= 1}
                className="bg-ivory-light px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
              >
                {!isRestricted && <option value="">🏛️ All Ministries</option>}
                {allowedMinistries.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} Ministry</option>
                ))}
              </select>
            </div>

            {/* Meeting Day Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="bg-ivory-light px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-semibold text-charcoal"
              >
                {daysOfWeek.map((day) => (
                  <option key={day} value={day === "All Days" ? "all" : day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by topic, leader, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ivory-light pl-9 pr-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo"
            />
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-indigo-100 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-charcoal/30 mx-auto" />
          <h3 className="text-sm font-bold text-charcoal">No Bible Study Groups Found</h3>
          <p className="text-xs text-charcoal/50 max-w-sm mx-auto">
            Try adjusting your category, ministry, or day filters, or schedule a new Bible study group.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map((g) => {
            const memberCount = g.current_member_count || 0;
            const capacityPercent = Math.min(100, Math.round((memberCount / (g.max_capacity || 12)) * 100));

            return (
              <div
                key={g.id}
                className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-2xs flex flex-col justify-between hover:border-amber/50 hover:shadow-md transition-all group"
              >
                <div>
                  {/* Category & Ministry Pill */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="bg-indigo-50 text-indigo font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {g.category}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: g.ministry_color || "#2C3968" }}
                    >
                      {g.ministry_name || "All-Church"}
                    </span>
                  </div>

                  {/* Group Name & Curriculum */}
                  <h3 className="text-base font-bold text-charcoal group-hover:text-indigo transition-colors">
                    {g.name}
                  </h3>

                  {g.curriculum && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200/60 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate max-w-[220px]">Study: {g.curriculum}</span>
                    </div>
                  )}

                  <p className="text-xs text-charcoal/70 mt-2 line-clamp-2 leading-relaxed">
                    {g.description || "Weekly Bible study fellowship, Scripture discussion, and prayer."}
                  </p>

                  {/* Schedule & Venue */}
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-charcoal/75 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo shrink-0" />
                      <span>Every <strong>{g.meeting_day}</strong> at {g.meeting_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                      <span className="truncate">{g.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-charcoal/60">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Leader: <strong>{g.leader_name}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Capacity & Actions */}
                <div className="mt-5 pt-3 border-t border-gray-100 space-y-3">
                  {/* Capacity Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-charcoal/60 mb-1">
                      <span>Roster: {memberCount} of {g.max_capacity} Enrolled</span>
                      <span>{capacityPercent}% Full</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${capacityPercent >= 90 ? "bg-rose" : capacityPercent >= 60 ? "bg-amber" : "bg-sage-500"
                          }`}
                        style={{ width: `${capacityPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedGroup(g)}
                      className="flex-1 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-700" />
                      <span>View Roster</span>
                    </button>
                    {canCreate && (
                      <button
                        onClick={() => handleOpenEditModal(g)}
                        className="flex-1 bg-indigo hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-amber-300" />
                        <span>Edit Group</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GROUP DETAILS & ROSTER MODAL */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-indigo-100">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-indigo-50 text-indigo text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    {selectedGroup.category}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: selectedGroup.ministry_color || "#2C3968" }}
                  >
                    {selectedGroup.ministry_name || "All-Church"}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-charcoal">{selectedGroup.name}</h2>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1 rounded-xl text-charcoal/50 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Cards */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-ivory rounded-xl border border-amber/20 space-y-2">
                <div className="flex items-center gap-2 text-charcoal font-bold">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>Curriculum: {selectedGroup.curriculum || "General Scripture Discussion"}</span>
                </div>
                <div className="flex items-center gap-2 text-charcoal/80">
                  <Clock className="w-4 h-4 text-indigo" />
                  <span>Meets every <strong>{selectedGroup.meeting_day}</strong> at {selectedGroup.meeting_time}</span>
                </div>
                <div className="flex items-center gap-2 text-charcoal/80">
                  <MapPin className="w-4 h-4 text-sage-600" />
                  <span>Location: {selectedGroup.location}</span>
                </div>
                <div className="flex items-center gap-2 text-charcoal/80">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Facilitator / Leader: <strong>{selectedGroup.leader_name}</strong> ({selectedGroup.leader_contact || "Contact through Church Office"})</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-charcoal/70 mb-1">Group Vision & Overview:</h4>
                <p className="text-charcoal/80 leading-relaxed bg-ivory-light p-3 rounded-xl border border-gray-100">
                  {selectedGroup.description || "A welcoming small group for spiritual growth, fellowship, and mutual prayer support."}
                </p>
              </div>

              {/* Enrolled Roster */}
              <div>
                <h4 className="font-bold text-charcoal/70 mb-2 flex items-center justify-between">
                  <span>Enrolled Members ({selectedGroup.members?.length || 0} / {selectedGroup.max_capacity})</span>
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedGroup.members && selectedGroup.members.length > 0 ? (
                    selectedGroup.members.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-ivory-light border border-gray-100 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo font-bold flex items-center justify-center text-[10px]">
                            {m.member_name ? m.member_name[0] : "M"}
                          </div>
                          <span className="font-bold text-charcoal">{m.member_name}</span>
                        </div>
                        <span className="text-[10px] text-charcoal/50">Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-charcoal/40 text-center py-3 italic">No members enrolled yet. Be the first to join!</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedGroup(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
              >
                Close
              </button>
              {canCreate && (
                <button
                  onClick={() => handleOpenEditModal(selectedGroup)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs shadow-md active:scale-95 transition-transform cursor-pointer"
                >
                  <Edit className="w-4 h-4 text-amber-300" />
                  <span>Edit Bible Study Group</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-indigo-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo" />
                <span>{editingGroupId ? "Edit Bible Study Group" : "Create New Bible Study Small Group"}</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-charcoal/50 hover:bg-gray-100 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Young Professionals Book of Romans"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo"
                  >
                    {categories.filter(c => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Ministry Scope</label>
                  <select
                    value={formData.ministry_id}
                    onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                    disabled={isRestricted && allowedMinistries.length <= 1}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo disabled:opacity-90 disabled:cursor-not-allowed"
                  >
                    {!isRestricted && <option value="">🏛️ All-Church</option>}
                    {allowedMinistries.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} Ministry</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Book / Study Topic - Searchable Dropdown */}
              <div ref={curriculumRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-charcoal/70">Book / Study Topic</label>
                  {formData.curriculum && (
                    <span className="text-[10px] text-indigo-600 font-semibold">Select or type custom</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search books & topics (e.g. Gospel of John, Romans, Sacred Marriage)"
                    value={formData.curriculum}
                    onFocus={(e) => {
                      e.target.select();
                      setCurriculumQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onClick={() => {
                      setCurriculumQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setFormData({ ...formData, curriculum: e.target.value });
                      setCurriculumQuery(e.target.value);
                      setIsCurriculumDropdownOpen(true);
                    }}
                    className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                  {formData.curriculum && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ ...prev, curriculum: "" }));
                        setCurriculumQuery("");
                        setIsCurriculumDropdownOpen(true);
                      }}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                      title="Clear topic"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      if (!isCurriculumDropdownOpen) {
                        setCurriculumQuery("");
                      }
                      setIsCurriculumDropdownOpen(!isCurriculumDropdownOpen);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-indigo p-0.5 cursor-pointer"
                    title="Toggle topics dropdown"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCurriculumDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Dropdown Menu for Curriculum */}
                {isCurriculumDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-indigo-50/70 text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Available Books & Topics ({filteredCurricula.length})</span>
                      <span className="text-[9px] text-indigo-600 font-normal">Click to choose</span>
                    </div>
                    {filteredCurricula.length === 0 ? (
                      <div className="p-3 text-center text-charcoal/50 text-[11px]">
                        No matching book or topic found. You can keep typing custom.
                      </div>
                    ) : (
                      filteredCurricula.map((item, idx) => (
                        <button
                          key={`${item.title}-${idx}`}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              curriculum: item.title
                            }));
                            setCurriculumQuery("");
                            setIsCurriculumDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-charcoal group-hover:text-indigo text-xs flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </div>
                            <div className="text-[10px] text-charcoal/60 pl-5 flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded font-semibold text-[9px] ${item.type === "curriculum"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-800"
                                }`}>
                                {item.category || (item.type === "curriculum" ? "Study Track" : "Bible Book")}
                              </span>
                              {item.authorOrVerse && (
                                <span className="truncate text-charcoal/50">• {item.authorOrVerse}</span>
                              )}
                            </div>
                          </div>
                          {formData.curriculum === item.title && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Leader & Contact Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Leader Searchable Dropdown */}
                <div ref={leaderRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-charcoal/70">Leader / Facilitator *</label>
                    {formData.leader_name && (
                      <span className="text-[9px] text-sky-600 font-semibold">Autofilled</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Search leader (e.g. Daniel Cruz, Arthur Bautista)"
                      value={formData.leader_name}
                      onFocus={(e) => {
                        e.target.select();
                        setLeaderQuery("");
                        setIsLeaderDropdownOpen(true);
                      }}
                      onClick={() => {
                        setLeaderQuery("");
                        setIsLeaderDropdownOpen(true);
                      }}
                      onChange={(e) => {
                        setFormData({ ...formData, leader_name: e.target.value });
                        setLeaderQuery(e.target.value);
                        setIsLeaderDropdownOpen(true);
                      }}
                      className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    />
                    {formData.leader_name && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, leader_name: "", leader_contact: "" }));
                          setLeaderQuery("");
                          setIsLeaderDropdownOpen(true);
                        }}
                        className="absolute right-7 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                        title="Clear leader"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        if (!isLeaderDropdownOpen) {
                          setLeaderQuery("");
                        }
                        setIsLeaderDropdownOpen(!isLeaderDropdownOpen);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-sky-600 p-0.5 cursor-pointer"
                      title="Toggle leaders dropdown"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isLeaderDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {/* Dropdown Menu for Leader */}
                  {isLeaderDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                      <div className="p-2 bg-sky-50/80 text-[10px] font-bold text-sky-950 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                        <span>Church Leaders ({filteredLeaders.length})</span>
                        <span className="text-[9px] text-sky-700 font-normal">Autofills contact</span>
                      </div>
                      {filteredLeaders.length === 0 ? (
                        <div className="p-3 text-center text-charcoal/50 text-[11px]">
                          No matching leader found. You can keep typing custom name.
                        </div>
                      ) : (
                        filteredLeaders.map((ldr) => (
                          <button
                            key={ldr.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                leader_name: ldr.name,
                                leader_contact: ldr.contact || prev.leader_contact
                              }));
                              setLeaderQuery("");
                              setIsLeaderDropdownOpen(false);
                            }}
                            className="w-full text-left p-2.5 hover:bg-sky-50/70 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-charcoal group-hover:text-sky-900 text-xs flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>{ldr.name}</span>
                                {ldr.role_name && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-semibold">
                                    {ldr.role_name}
                                  </span>
                                )}
                              </div>
                              {ldr.contact && (
                                <div className="text-[10px] text-charcoal/60 pl-5 flex items-center gap-1 mt-0.5 truncate">
                                  <Phone className="w-3 h-3 text-charcoal/40 shrink-0" />
                                  <span className="truncate">{ldr.contact}</span>
                                </div>
                              )}
                            </div>
                            {formData.leader_name === ldr.name && (
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Leader Contact Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-charcoal/70">Leader Contact</label>
                    <span className="text-[10px] text-charcoal/40">Phone/Email</span>
                  </div>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={formData.leader_contact}
                    onChange={(e) => setFormData({ ...formData, leader_contact: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
              </div>

              {/* Schedule: Day, Time In, Time Out, and Max Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block font-bold text-xs text-charcoal/70 mb-1">Meeting Day *</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs h-[41px]"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <TimePickerInput
                    label="Time In (Start) *"
                    value={formData.meeting_time_start}
                    onChange={(val) => setFormData({ ...formData, meeting_time_start: val })}
                    placeholder="e.g. 7:00 PM"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <TimePickerInput
                    label="Time Out (End)"
                    value={formData.meeting_time_end}
                    onChange={(val) => setFormData({ ...formData, meeting_time_end: val })}
                    placeholder="e.g. 8:30 PM"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-xs text-charcoal/70 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="4"
                    max="50"
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: Number(e.target.value) })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-bold text-charcoal text-center h-[41px]"
                  />
                </div>
              </div>

              {/* Meeting Location / Room / Link - Searchable Dropdown */}
              <div ref={locationRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-charcoal/70">Meeting Location / Room / Link *</label>
                  {formData.location && (
                    <span className="text-[10px] text-indigo-600 font-semibold">Select or type custom</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search church rooms or links (e.g. Fellowship Hall Room 201, Zoom)"
                    value={formData.location}
                    onFocus={(e) => {
                      e.target.select();
                      setLocationQuery("");
                      setIsLocationDropdownOpen(true);
                    }}
                    onClick={() => {
                      setLocationQuery("");
                      setIsLocationDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setFormData({ ...formData, location: e.target.value });
                      setLocationQuery(e.target.value);
                      setIsLocationDropdownOpen(true);
                    }}
                    className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                  {formData.location && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ ...prev, location: "" }));
                        setLocationQuery("");
                        setIsLocationDropdownOpen(true);
                      }}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                      title="Clear location"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      if (!isLocationDropdownOpen) {
                        setLocationQuery("");
                      }
                      setIsLocationDropdownOpen(!isLocationDropdownOpen);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-indigo p-0.5 cursor-pointer"
                    title="Toggle location dropdown"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isLocationDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Dropdown Menu for Location */}
                {isLocationDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-indigo-50/70 text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Church Rooms & Meeting Spaces ({filteredLocations.length})</span>
                      <span className="text-[9px] text-indigo-600 font-normal">Click to choose</span>
                    </div>
                    {filteredLocations.length === 0 ? (
                      <div className="p-3 text-center text-charcoal/50 text-[11px]">
                        No matching locations. You can keep typing custom room or link.
                      </div>
                    ) : (
                      filteredLocations.map((loc, idx) => (
                        <button
                          key={`${loc}-${idx}`}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              location: loc
                            }));
                            setLocationQuery("");
                            setIsLocationDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="font-bold text-charcoal group-hover:text-indigo text-xs">{loc}</span>
                          </div>
                          {formData.location === loc && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Added Members - Searchable Multi-Select */}
              <div ref={memberRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-charcoal/70 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Added Members</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {selectedMemberIds.length} / {formData.max_capacity || 12} Added
                  </span>
                </div>

                {/* Selected Member Tag Pills */}
                {selectedMemberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 mb-2 bg-indigo-50/50 rounded-xl border border-indigo-100/80 max-h-24 overflow-y-auto">
                    {selectedMemberIds.map((mId) => {
                      const m = membersList.find(item => item.id === mId);
                      return (
                        <span
                          key={mId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-charcoal shadow-2xs group"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>{m ? m.name : `Member #${mId}`}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleMember(mId)}
                            className="text-charcoal/40 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                            title="Remove member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Member Search Bar / Dropdown Trigger */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search members by name or ministry to add (e.g. Elena Santos)..."
                    value={memberQuery}
                    onFocus={() => setIsMemberDropdownOpen(true)}
                    onClick={() => setIsMemberDropdownOpen(true)}
                    onChange={(e) => {
                      setMemberQuery(e.target.value);
                      setIsMemberDropdownOpen(true);
                    }}
                    className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                  />
                  {memberQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemberQuery("");
                        setIsMemberDropdownOpen(true);
                      }}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-indigo p-0.5 cursor-pointer"
                    title="Toggle members dropdown"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMemberDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Dropdown Menu for Members */}
                {isMemberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-indigo-50/80 text-[10px] font-bold text-indigo-950 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Available Members ({filteredMembers.length})</span>
                      <span className="text-[9px] text-indigo-700 font-normal">Click to add or remove</span>
                    </div>
                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-center text-charcoal/50 text-xs">
                        No matching members found.
                      </div>
                    ) : (
                      filteredMembers.map((mem) => {
                        const isSelected = selectedMemberIds.includes(mem.id);
                        return (
                          <button
                            key={mem.id}
                            type="button"
                            onClick={() => handleToggleMember(mem.id)}
                            className={`w-full text-left p-2.5 hover:bg-indigo-50/70 transition-colors flex items-center justify-between group cursor-pointer ${isSelected ? "bg-indigo-50/50 font-bold" : ""
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${isSelected ? "bg-indigo" : "bg-gray-400"
                                }`}>
                                {mem.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs text-charcoal group-hover:text-indigo truncate">
                                  {mem.name}
                                </div>
                                {mem.ministry_name && (
                                  <span className="text-[10px] text-charcoal/50">
                                    {mem.ministry_name} {mem.age ? `• ${mem.age} yrs` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${isSelected
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-gray-100 text-charcoal/60 group-hover:bg-indigo-100 group-hover:text-indigo"
                              }`}>
                              {isSelected ? "✓ Added" : "+ Add"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Description / Group Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Group focus, target audience, study style..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer"
                >
                  {editingGroupId ? "Save Changes" : "Create Small Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Completed Books of Study Archive */}
      {/* ==================================================== */}
      {isCompletedModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-emerald-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Award className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-charcoal flex items-center gap-2">
                    <span>Completed Books of Study</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                      {studySummary?.completed_count || 0} Completed
                    </span>
                  </h3>
                  <p className="text-xs text-charcoal/60">
                    Library of completed Bible study books and church discipleship curriculum.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCompletedModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Completed Books</span>
                <span className="text-xl font-black text-emerald-900">{studySummary?.completed_count || 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Chapters Studied</span>
                <span className="text-xl font-black text-emerald-900">
                  {studySummary?.completed_books?.reduce((acc, t) => acc + (t.total_chapters || 0), 0) || 0} chapters
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Curriculum Rate</span>
                <span className="text-xl font-black text-emerald-900">{studySummary?.completion_rate || 0}%</span>
              </div>
            </div>

            {/* List of Completed Books */}
            {(!studySummary?.completed_books || studySummary.completed_books.length === 0) ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl space-y-2">
                <BookOpen className="w-8 h-8 text-charcoal/30 mx-auto" />
                <p className="text-xs text-charcoal/70 font-semibold">No books have been marked as completed yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {studySummary.completed_books.map((book, idx) => (
                  <div
                    key={book.id}
                    className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-white hover:shadow-2xs transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-sm text-charcoal">{book.title}</h4>
                          <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo border border-indigo-100">
                            {book.testament_or_category || "Bible Study"}
                          </span>
                        </div>
                        {book.summary_notes && (
                          <p className="text-xs text-charcoal/70 pl-7 leading-relaxed">
                            {book.summary_notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{book.completed_date ? `Completed: ${book.completed_date}` : "Completed"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-charcoal/70 pl-7 pt-1 border-t border-emerald-100">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>📖 <strong>{book.total_chapters} Chapters</strong></span>
                        {book.lead_teacher && (
                          <span>Teacher: <strong>{book.lead_teacher}</strong></span>
                        )}
                        {book.key_verse && (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                            {book.key_verse}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCompletedModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-bold transition-all shadow-xs"
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
