import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { Member, Household, Ministry } from "../types";
import { 
  Users, Home, Search, Plus, Filter, AlertCircle, 
  Heart, Sparkles, Phone, Mail, Calendar, ShieldCheck, ArrowRight, X, Check,
  Cake, Gift, PartyPopper, Send, FileText, MapPin, Briefcase, GraduationCap, Clock
} from "lucide-react";

export const MembersPage: React.FC = () => {
  const { user, ministries, selectedMinistryId } = useAuth();
  const [activeTab, setActiveTab] = useState<"members" | "households">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0 
    ? user.ministries[0].id 
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);

  const [households, setHouseholds] = useState<Household[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMinistry, setFilterMinistry] = useState<string>(
    coordinatorMinistryId ? String(coordinatorMinistryId) : (selectedMinistryId ? String(selectedMinistryId) : "")
  );
  const [birthdayFilter, setBirthdayFilter] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddHouseholdModalOpen, setIsAddHouseholdModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Greeting Modal State
  const [greetingMember, setGreetingMember] = useState<Member | null>(null);
  const [greetingMessage, setGreetingMessage] = useState<string>("");
  const [greetingSuccess, setGreetingSuccess] = useState<boolean>(false);
  const [sendingGreeting, setSendingGreeting] = useState<boolean>(false);

  // New member form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    birthdate: "",
    gender: "Male",
    contact_email: "",
    contact_phone: "",
    household_id: "",
    ministry_id: coordinatorMinistryId ? String(coordinatorMinistryId) : "",
    medical_notes: "",
    grade_level: "",
    address: "",
    guardian_names: "",
    guardian_phone: "",
    invited_by: "",
    school_name: "",
    program_major: "",
    class_schedule: "",
    occupation: "",
    hobbies: "",
    previous_church: "",
    facebook_account: "",
    family_details: "",
    application_date: new Date().toISOString().split("T")[0]
  });
  const [suggestedMinistryInfo, setSuggestedMinistryInfo] = useState<{ age: number; ministry: Ministry | null } | null>(null);

  // Household form state
  const [householdForm, setHouseholdForm] = useState({
    name: "",
    address: "",
    primary_contact_phone: ""
  });

  useEffect(() => {
    if (coordinatorMinistryId) {
      setFilterMinistry(String(coordinatorMinistryId));
      setFormData(prev => ({ ...prev, ministry_id: String(coordinatorMinistryId) }));
    } else if (selectedMinistryId) {
      setFilterMinistry(String(selectedMinistryId));
    }
  }, [coordinatorMinistryId, selectedMinistryId]);

  useEffect(() => {
    loadData();
  }, [filterMinistry, coordinatorMinistryId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const activeMinistryParam = coordinatorMinistryId 
        ? coordinatorMinistryId 
        : (filterMinistry ? Number(filterMinistry) : undefined);

      const [mList, hList] = await Promise.all([
        api.getMembers({ 
          ministry_id: activeMinistryParam, 
          search: searchQuery || undefined 
        }),
        api.getHouseholds()
      ]);
      setMembers(mList);
      setHouseholds(hList);
    } catch (err) {
      console.error("Failed to load members/households:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateClientAge = (bdate: string): number => {
    if (!bdate) return 0;
    const b = new Date(bdate);
    if (isNaN(b.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const getSuggestedMinistryForAge = (age: number) => {
    if (!ministries || ministries.length === 0) return null;
    const sorted = [...ministries].sort((a, b) => (a.min_age ?? 0) - (b.min_age ?? 0));
    let matched = sorted.find(m => {
      const min = m.min_age ?? 0;
      const max = m.max_age ?? 999;
      return age >= min && age <= max;
    });
    return matched || sorted[sorted.length - 1] || null;
  };

  // Real-time age and ministry calculation when user enters birthdate in Add Member form
  const handleBirthdateChange = async (birthdateVal: string) => {
    if (!birthdateVal) {
      setFormData(prev => ({ ...prev, birthdate: "", ministry_id: "" }));
      setSuggestedMinistryInfo(null);
      return;
    }

    // Instant local calculation for zero-latency UI autofill
    const age = calculateClientAge(birthdateVal);
    const localSuggested = getSuggestedMinistryForAge(age);
    if (localSuggested) {
      setSuggestedMinistryInfo({ age, ministry: localSuggested });
      if (!coordinatorMinistryId) {
        setFormData(prev => ({
          ...prev,
          birthdate: birthdateVal,
          ministry_id: String(localSuggested.id)
        }));
      } else {
        setFormData(prev => ({ ...prev, birthdate: birthdateVal }));
      }
    } else {
      setFormData(prev => ({ ...prev, birthdate: birthdateVal }));
    }

    // Server-verified calculation
    try {
      const res = await api.suggestMinistry(birthdateVal);
      setSuggestedMinistryInfo({ age: res.calculated_age, ministry: res.suggested_ministry });
      if (res.suggested_ministry?.id && !coordinatorMinistryId) {
        setFormData(prev => ({
          ...prev,
          ministry_id: String(res.suggested_ministry.id)
        }));
      }
    } catch (err) {
      console.error("Age calculation error:", err);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createMember({
        ...formData,
        household_id: formData.household_id ? Number(formData.household_id) : null,
        ministry_id: coordinatorMinistryId ? coordinatorMinistryId : (formData.ministry_id ? Number(formData.ministry_id) : null),
      });
      setIsAddModalOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        birthdate: "",
        gender: "Male",
        contact_email: "",
        contact_phone: "",
        household_id: "",
        ministry_id: coordinatorMinistryId ? String(coordinatorMinistryId) : "",
        medical_notes: "",
        grade_level: "",
        address: "",
        guardian_names: "",
        guardian_phone: "",
        invited_by: "",
        school_name: "",
        program_major: "",
        class_schedule: "",
        occupation: "",
        hobbies: "",
        previous_church: "",
        facebook_account: "",
        family_details: "",
        application_date: new Date().toISOString().split("T")[0]
      });
      setSuggestedMinistryInfo(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create member");
    }
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHousehold(householdForm);
      setIsAddHouseholdModalOpen(false);
      setHouseholdForm({ name: "", address: "", primary_contact_phone: "" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create household");
    }
  };

  const handlePromoteMinistry = async (member: Member, nextMinistryId: number) => {
    try {
      await api.updateMember(member.id, { ministry_id: nextMinistryId });
      loadData();
      if (selectedMember && selectedMember.id === member.id) {
        const updated = await api.getMember(member.id);
        setSelectedMember(updated);
      }
    } catch (err: any) {
      alert(err.message || "Failed to promote member");
    }
  };

  const handleOpenGreeting = (member: Member) => {
    setGreetingMember(member);
    const turning = member.turning_age || ((member.age ?? 0) + 1);
    setGreetingMessage(
      `Happy ${turning}th Birthday, ${member.first_name}! 🎂 "The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25). Praying for God's abundant peace, joy, and spiritual blessing upon your life!`
    );
    setGreetingSuccess(false);
  };

  const handleSendGreeting = async () => {
    if (!greetingMember) return;
    try {
      setSendingGreeting(true);
      await api.sendBirthdayGreeting(greetingMember.id, {
        message: greetingMessage,
        channel: "announcement"
      });
      setGreetingSuccess(true);
      setTimeout(() => {
        setGreetingMember(null);
        setGreetingSuccess(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to send birthday blessing");
    } finally {
      setSendingGreeting(false);
    }
  };

  const displayedMembers = members.filter(m => {
    if (coordinatorMinistryId && m.ministry_id !== coordinatorMinistryId) {
      return false;
    }
    if (birthdayFilter === "all") return true;
    if (birthdayFilter === "today") return m.is_birthday_today;
    if (birthdayFilter === "this_week") return m.is_birthday_this_week;
    if (birthdayFilter === "this_month") return m.is_birthday_this_month;
    if (birthdayFilter.startsWith("month_")) {
      const targetM = parseInt(birthdayFilter.replace("month_", ""), 10);
      return m.birth_month === targetM;
    }
    return true;
  });

  const canEdit = user?.role_name === "Admin" || user?.role_name === "Coordinator";
  const coordinatorMinistryName = user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth";

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal flex items-center gap-2">
            <span>Members & Family Directory</span>
            <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-2.5 py-1 rounded-full">
              {coordinatorMinistryId ? `${displayedMembers.length} Active ${coordinatorMinistryName} Records` : `${displayedMembers.length} of ${members.length} Active Records`}
            </span>
          </h1>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Individual member profiles, households, birthdays, medical alerts, and age-based ministry tracking.
          </p>
        </div>

        {/* Action Buttons */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddHouseholdModalOpen(true)}
              className="flex items-center gap-1.5 bg-white hover:bg-ivory border border-indigo-200 text-charcoal font-semibold px-3.5 py-2 rounded-xl text-xs shadow-2xs transition-all"
            >
              <Home className="w-3.5 h-3.5 text-amber-600" />
              <span>New Household</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>Add Member</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs, Search & Birthday Filter Bar */}
      <div className="space-y-2.5">
        <div className="bg-white p-3 rounded-2xl border border-indigo-100/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Tab switchers */}
          <div className="flex items-center bg-ivory p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "members" ? "bg-white text-indigo shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo" />
              <span>{coordinatorMinistryId ? `${coordinatorMinistryName} Members (${displayedMembers.length})` : `All Members (${members.length})`}</span>
            </button>
            <button
              onClick={() => setActiveTab("households")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "households" ? "bg-white text-indigo shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Home className="w-3.5 h-3.5 text-amber-600" />
              <span>Households ({households.length})</span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="w-full bg-ivory-light pl-9 pr-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo"
              />
            </div>

            {coordinatorMinistryId ? (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{coordinatorMinistryName} Ministry</span>
                <span className="text-[10px] text-indigo-600 font-medium">(Assigned Scope)</span>
              </div>
            ) : (
              <select
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                className="bg-ivory-light px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-medium text-charcoal"
              >
                <option value="">All Ministries</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Birthday Celebrant Quick Filters */}
        {activeTab === "members" && (
          <div className="flex items-center gap-1.5 flex-wrap bg-ivory-light/90 p-2.5 rounded-xl border border-indigo-100/70 text-xs">
            <span className="font-bold text-charcoal/80 flex items-center gap-1 mr-1 text-[11px]">
              <Cake className="w-3.5 h-3.5 text-rose" />
              <span>Birthday Milestones:</span>
            </span>
            {[
              { id: "all", label: "All Members" },
              { id: "today", label: "🎉 Birthday Today" },
              { id: "this_week", label: "🎈 This Week" },
              { id: "this_month", label: "🎂 This Month" },
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setBirthdayFilter(pill.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  birthdayFilter === pill.id
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-2xs"
                    : "bg-white text-charcoal/70 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {pill.label}
              </button>
            ))}

            <select
              value={birthdayFilter.startsWith("month_") ? birthdayFilter : ""}
              onChange={(e) => setBirthdayFilter(e.target.value || "all")}
              className="bg-white px-2.5 py-1 rounded-lg text-xs border border-gray-200 font-medium text-charcoal focus:outline-none"
            >
              <option value="">Filter by Birth Month...</option>
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((mName, i) => (
                <option key={i+1} value={`month_${i+1}`}>
                  {mName} Birthdays
                </option>
              ))}
            </select>

            {birthdayFilter !== "all" && (
              <button
                onClick={() => setBirthdayFilter("all")}
                className="text-[11px] text-rose-600 font-bold hover:underline ml-auto flex items-center gap-0.5"
              >
                <X className="w-3 h-3" /> Reset Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === "members" ? (
        <div className="bg-white rounded-2xl border border-indigo-100/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory text-charcoal/70 uppercase text-[10px] font-bold tracking-wider border-b border-indigo-100">
                <tr>
                  <th className="p-3.5">Member Name</th>
                  <th className="p-3.5">Ministry</th>
                  <th className="p-3.5">Age / Birthday</th>
                  <th className="p-3.5">Household</th>
                  <th className="p-3.5">Medical / Notes</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedMembers.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    className="hover:bg-ivory-light/60 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5 font-semibold text-charcoal flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo font-bold flex items-center justify-center text-xs">
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo">{m.first_name} {m.last_name}</div>
                        <div className="text-[10px] text-charcoal/50">{m.contact_email || m.contact_phone || "No direct contact"}</div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: m.ministry_color || "#2C3968" }}
                        ></span>
                        <span className="font-semibold text-charcoal">{m.ministry_name || "Unassigned"}</span>
                        {m.is_aging_out && (
                          <span className="bg-rose text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse-subtle">
                            Aging Out
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-medium text-charcoal">{m.age} years old</div>
                      <div className="text-[10px] text-charcoal/50 flex items-center gap-1 mt-0.5">
                        <span>{m.birth_month_name ? `${m.birth_month_name} ${m.birth_day}` : m.birthdate}</span>
                        {m.is_birthday_today ? (
                          <span className="bg-rose text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
                            TODAY! 🎂
                          </span>
                        ) : m.is_birthday_this_week ? (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                            🎂 in {m.days_until_birthday}d
                          </span>
                        ) : m.is_birthday_this_month ? (
                          <span className="bg-rose-50 text-rose-700 text-[9px] font-semibold px-1 py-0.2 rounded">
                            🎂 This month
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="p-3.5">
                      {m.household_name ? (
                        <div className="font-medium text-charcoal flex items-center gap-1">
                          <Home className="w-3 h-3 text-amber-600" />
                          <span>{m.household_name}</span>
                        </div>
                      ) : (
                        <span className="text-charcoal/40 italic">Individual</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      {m.medical_notes ? (
                        <span className="bg-rose-50 border border-rose-200 text-rose-800 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 max-w-xs truncate">
                          <AlertCircle className="w-3 h-3 text-rose shrink-0" />
                          {m.medical_notes}
                        </span>
                      ) : (
                        <span className="text-charcoal/40 text-[10px]">None</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        m.status === "active" ? "bg-sage-100 text-sage-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        {m.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenGreeting(m);
                          }}
                          title="Send Birthday Blessing"
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                        >
                          <Gift className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(m);
                          }}
                          className="text-indigo hover:text-indigo-800 font-bold text-[11px] underline px-1 py-1"
                        >
                          View Card
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Households Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {households.map((h) => (
            <div key={h.id} className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <Home className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-charcoal">{h.name}</h3>
                      <p className="text-[10px] text-charcoal/50">{h.address || "Address unlisted"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-indigo-50 text-indigo px-2.5 py-0.5 rounded-full">
                    {h.members?.length || 0} Members
                  </span>
                </div>

                {h.primary_contact_phone && (
                  <div className="text-xs text-charcoal/70 flex items-center gap-1.5 my-2">
                    <Phone className="w-3.5 h-3.5 text-sage-600" />
                    <span>{h.primary_contact_phone}</span>
                  </div>
                )}

                {/* Family Members list */}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Family Tree & Ministries</p>
                  {h.members && h.members.map((fam) => (
                    <div key={fam.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-ivory-light/50 border border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-charcoal">{fam.first_name} {fam.last_name}</span>
                        <span className="text-[10px] text-charcoal/50">({fam.age} yrs)</span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {fam.ministry_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Member Details Centered Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-5 border border-indigo-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo to-indigo-800 text-white font-black text-lg flex items-center justify-center shadow-md ring-4 ring-indigo-50">
                  {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-charcoal">{selectedMember.first_name} {selectedMember.last_name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 uppercase tracking-wide">
                      {selectedMember.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedMember.ministry_color || "#2C3968" }}
                    ></span>
                    <span className="text-xs font-semibold text-charcoal/70">
                      {selectedMember.ministry_name || "Unassigned Ministry"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-charcoal/50 hover:text-charcoal transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aging Out Promo Alert Banner if applicable */}
            {selectedMember.is_aging_out && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose shrink-0" />
                  <span>Member is Aging Out of Current Ministry</span>
                </div>
                <p className="text-charcoal/70 mt-1">
                  At {selectedMember.age} years old, {selectedMember.first_name} has completed the {selectedMember.ministry_name} age bracket.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {ministries
                    .filter(m => (m.min_age ?? 0) <= (selectedMember.age ?? 0) && (m.max_age ?? 999) >= (selectedMember.age ?? 0))
                    .map(nextM => (
                      <button
                        key={nextM.id}
                        onClick={() => handlePromoteMinistry(selectedMember, nextM.id)}
                        className="bg-rose hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Promote to {nextM.name} Ministry</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Profile Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Card 1: Member Demographics */}
              <div className="p-3.5 bg-ivory-light rounded-xl border border-gray-100 space-y-2">
                <p className="font-bold text-charcoal/50 text-[10px] uppercase tracking-wider">Demographics</p>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Age:</span>
                  <span className="font-bold text-charcoal">{selectedMember.age} years old</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Birthdate:</span>
                  <span className="font-semibold text-charcoal">{selectedMember.birthdate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Gender:</span>
                  <span className="font-semibold text-charcoal">{selectedMember.gender || "Unspecified"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Grade Level:</span>
                  <span className="font-semibold text-charcoal">{selectedMember.grade_level || "N/A"}</span>
                </div>
              </div>

              {/* Card 2: Household & Ministry */}
              <div className="p-3.5 bg-ivory-light rounded-xl border border-gray-100 space-y-2">
                <p className="font-bold text-charcoal/50 text-[10px] uppercase tracking-wider">Household & Ministry</p>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Household:</span>
                  <span className="font-bold text-indigo">{selectedMember.household_name || "Individual"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Current Ministry:</span>
                  <span className="font-bold text-indigo">{selectedMember.ministry_name || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Email:</span>
                  <span className="font-semibold text-charcoal truncate max-w-[140px]">{selectedMember.contact_email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/60">Phone:</span>
                  <span className="font-semibold text-charcoal">{selectedMember.contact_phone || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Birthday & Milestone Celebration */}
            <div className="p-4 bg-gradient-to-br from-amber-50 via-rose-50/40 to-indigo-50/50 rounded-xl border border-amber-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-charcoal flex items-center gap-1.5 text-xs">
                  <Cake className="w-4 h-4 text-rose" />
                  <span>Birthday & Milestone Celebration</span>
                </span>
                {selectedMember.is_birthday_today ? (
                  <span className="bg-rose text-white text-[10px] font-black px-2.5 py-0.5 rounded-full animate-bounce">
                    TODAY! 🎉
                  </span>
                ) : selectedMember.is_birthday_this_week ? (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    In {selectedMember.days_until_birthday} days!
                  </span>
                ) : selectedMember.is_birthday_this_month ? (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    This Month
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100">
                  <span className="text-[10px] text-charcoal/50 block">Birth Date</span>
                  <span className="font-bold text-charcoal">
                    {selectedMember.birth_month_name ? `${selectedMember.birth_month_name} ${selectedMember.birth_day}` : selectedMember.birthdate}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100">
                  <span className="text-[10px] text-charcoal/50 block">Next Turning Age</span>
                  <span className="font-bold text-indigo">
                    {selectedMember.turning_age || ((selectedMember.age ?? 0) + 1)} yrs old
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100">
                  <span className="text-[10px] text-charcoal/50 block">Countdown</span>
                  <span className="font-bold text-amber-700">
                    {selectedMember.days_until_birthday !== undefined ? (
                      selectedMember.days_until_birthday === 0 ? "Today! 🎂" : `${selectedMember.days_until_birthday} days`
                    ) : "Upcoming"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenGreeting(selectedMember)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-all active:scale-95"
              >
                <Gift className="w-4 h-4" />
                <span>Send Birthday Blessing / Announcement</span>
              </button>
            </div>

            {/* Official Application Card Details */}
            {(selectedMember.address || selectedMember.guardian_names || selectedMember.school_name || selectedMember.program_major || selectedMember.occupation || selectedMember.hobbies || selectedMember.invited_by || selectedMember.previous_church || selectedMember.facebook_account || selectedMember.family_details || selectedMember.class_schedule || selectedMember.application_date) && (
              <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="font-bold text-charcoal flex items-center gap-1.5 text-xs">
                    <FileText className="w-4 h-4 text-indigo" />
                    <span>Application for Membership Card</span>
                  </span>
                  {selectedMember.application_date && (
                    <span className="text-[10px] bg-indigo-50 text-indigo px-2 py-0.5 rounded font-semibold">
                      Applied: {selectedMember.application_date}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedMember.address && (
                    <div className="sm:col-span-2 flex items-start gap-2 bg-ivory-light p-2 rounded-lg">
                      <MapPin className="w-3.5 h-3.5 text-sage-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-charcoal/50 block font-semibold">Address</span>
                        <span className="text-charcoal font-medium">{selectedMember.address}</span>
                      </div>
                    </div>
                  )}

                  {selectedMember.guardian_names && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Parents / Guardians</span>
                      <span className="text-charcoal font-medium">{selectedMember.guardian_names}</span>
                      {selectedMember.guardian_phone && (
                        <span className="text-indigo block text-[11px] font-semibold">{selectedMember.guardian_phone}</span>
                      )}
                    </div>
                  )}

                  {selectedMember.family_details && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Family Members</span>
                      <span className="text-charcoal font-medium">{selectedMember.family_details}</span>
                    </div>
                  )}

                  {selectedMember.school_name && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">School / College</span>
                      <span className="text-charcoal font-medium">{selectedMember.school_name}</span>
                      {selectedMember.program_major && (
                        <span className="text-indigo block text-[11px] font-semibold">{selectedMember.program_major}</span>
                      )}
                    </div>
                  )}

                  {selectedMember.class_schedule && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Class Schedule</span>
                      <span className="text-charcoal font-medium">{selectedMember.class_schedule}</span>
                    </div>
                  )}

                  {selectedMember.occupation && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Occupation</span>
                      <span className="text-charcoal font-medium">{selectedMember.occupation}</span>
                    </div>
                  )}

                  {selectedMember.hobbies && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Hobbies</span>
                      <span className="text-charcoal font-medium">{selectedMember.hobbies}</span>
                    </div>
                  )}

                  {selectedMember.invited_by && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Who Invited in DPC?</span>
                      <span className="text-indigo font-bold">{selectedMember.invited_by}</span>
                    </div>
                  )}

                  {selectedMember.previous_church && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Previous Church / Religion</span>
                      <span className="text-charcoal font-medium">{selectedMember.previous_church}</span>
                    </div>
                  )}

                  {selectedMember.facebook_account && (
                    <div className="bg-ivory-light p-2 rounded-lg">
                      <span className="text-[10px] text-charcoal/50 block font-semibold">Facebook Account</span>
                      <span className="text-charcoal font-medium">{selectedMember.facebook_account}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Medical / Allergy Alert Box */}
            {selectedMember.medical_notes && (
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-xs">
                <span className="font-bold text-rose-900 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-4 h-4 text-rose" />
                  <span>Medical & Special Care Instructions:</span>
                </span>
                <p className="text-rose-950 font-medium bg-white p-2.5 rounded-lg border border-rose-100 shadow-2xs">
                  {selectedMember.medical_notes}
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-charcoal font-bold rounded-xl text-xs transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddModalOpen && (() => {
        const currentModalMinistryId = formData.ministry_id 
          ? Number(formData.ministry_id) 
          : (coordinatorMinistryId || suggestedMinistryInfo?.ministry?.id || null);
        const currentModalMinistry = ministries.find(m => m.id === currentModalMinistryId) || suggestedMinistryInfo?.ministry || null;
        const currentMinName = (currentModalMinistry?.name || "").toLowerCase();
        const isKinder = currentMinName.includes("kinder");
        const isElementary = currentMinName.includes("elem");
        const isHighSchool = currentMinName.includes("high") || currentMinName.includes("school");
        const isYouth = currentMinName.includes("youth") && !currentMinName.includes("adult");
        const isYoungAdult = currentMinName.includes("young");
        const isJuniorAdult = currentMinName.includes("junior");
        const isOldAdult = currentMinName.includes("old") || currentMinName.includes("senior");

        return (
          <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo" />
                  <span>Add New Member Record</span>
                </h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* DPC Physical Form Synchronized Header */}
              <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 p-3.5 rounded-2xl text-white shadow-xs border border-indigo-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 block">
                    Daet Presbyterian Church
                  </span>
                  <h3 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Application for Membership</span>
                    {currentModalMinistry && (
                      <span className="text-white text-xs font-semibold">• {currentModalMinistry.name}</span>
                    )}
                  </h3>
                </div>
                <span className="text-[10px] bg-white/10 text-indigo-200 px-2 py-0.5 rounded-md border border-white/20 font-medium">
                  Paper Form Sync
                </span>
              </div>

              <form onSubmit={handleCreateMember} className="space-y-4 text-xs">
                {/* Core Names */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-charcoal/70 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Suzette / Rebecca"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-charcoal/70 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Victoria / Aspe"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    />
                  </div>
                </div>

                {/* Birthdate & Real-time Auto-Suggestion */}
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">
                    Birthday * (Calculates Age & Auto-suggests Ministry)
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birthdate}
                    onChange={(e) => handleBirthdateChange(e.target.value)}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                  {suggestedMinistryInfo && (
                    <div className="mt-2 p-2.5 rounded-xl bg-sage-50 border border-sage-200 flex items-center justify-between">
                      <span className="font-semibold text-sage-900">
                        Calculated Age: {suggestedMinistryInfo.age} yrs
                      </span>
                      <span className="font-bold text-indigo bg-white px-2 py-0.5 rounded shadow-2xs">
                        Suggested: {suggestedMinistryInfo.ministry?.name || "None"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Gender & Application Date (for Non-Kinder/Non-Elementary) */}
                {(!isKinder && !isElementary) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">Gender *</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">Date of Application</label>
                      <input
                        type="date"
                        value={formData.application_date}
                        onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
                        className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>
                  </div>
                )}

                {/* Address (Present Address on paper card) */}
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sage-600" />
                    <span>Address *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Happy Homes Phase 3, Bagang / P. Burgos St. Daet, Camarines Norte"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>

                {/* Ministry Assignment & Household */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-charcoal/70">Ministry Assignment</label>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                        {coordinatorMinistryId ? "Coordinator Scope" : (suggestedMinistryInfo?.ministry && formData.ministry_id === String(suggestedMinistryInfo.ministry.id) ? "Auto-assigned" : "Auto-assigned")}
                      </span>
                    </div>
                    <select
                      value={coordinatorMinistryId ? String(coordinatorMinistryId) : formData.ministry_id}
                      onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                      disabled={!!coordinatorMinistryId}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-charcoal disabled:opacity-90 disabled:bg-gray-100"
                    >
                      {coordinatorMinistryId ? (
                        <option value={coordinatorMinistryId}>{coordinatorMinistryName} Ministry (Assigned)</option>
                      ) : (
                        <>
                          <option value="">Auto-Assign by Age</option>
                          {ministries.map((m) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.min_age ? `${m.min_age}-${m.max_age || '+'} yrs` : 'All'})</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-charcoal/70 mb-1">Household / Family</label>
                    <select
                      value={formData.household_id}
                      onChange={(e) => setFormData({ ...formData, household_id: e.target.value })}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    >
                      <option value="">Individual (No Household)</option>
                      {households.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contact Phone & Email */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-charcoal/70 mb-1">Contact No *</label>
                    <input
                      type="tel"
                      required={!isKinder}
                      placeholder="e.g. 0930 079 5141 / 0950 931 8104"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-charcoal/70 mb-1">Contact Email</label>
                    <input
                      type="email"
                      placeholder="e.g. member@email.com"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    />
                  </div>
                </div>

                {/* ========================================================= */}
                {/* DYNAMIC MINISTRY FORM SECTIONS (MATCHING PAPER FORMS)     */}
                {/* ========================================================= */}

                {/* 1. Kinder Ministry Form Fields */}
                {isKinder && (
                  <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-3">
                    <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <span>Kinder Ministry Application Requirements</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">
                          Name of parents or guardian (relatives) *
                        </label>
                        <input
                          type="text"
                          required={isKinder}
                          placeholder="e.g. Juan & Maria Bautista"
                          value={formData.guardian_names}
                          onChange={(e) => setFormData({ ...formData, guardian_names: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">
                          Contact number of parents *
                        </label>
                        <input
                          type="tel"
                          required={isKinder}
                          placeholder="e.g. 0917-123-4567"
                          value={formData.guardian_phone}
                          onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value, contact_phone: formData.contact_phone || e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">
                        Medical / Allergy Notes (Crucial for Kinder) *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Peanut allergy, Asthma inhaler, None"
                        value={formData.medical_notes}
                        onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Elementary Ministry Form Fields */}
                {isElementary && (
                  <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 space-y-3">
                    <h4 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                      <span>Elementary Ministry Application Requirements</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">
                          Who Invites You in DPC? (Invitee)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sunday School Teacher / Friend"
                          value={formData.invited_by}
                          onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">
                          Name of Parents or Guardian
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Mr. & Mrs. Santos"
                          value={formData.guardian_names}
                          onChange={(e) => setFormData({ ...formData, guardian_names: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">
                        Medical / Allergy Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mild asthma, None"
                        value={formData.medical_notes}
                        onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>
                  </div>
                )}

                {/* 3. High School Ministry (Matches Photo 2) */}
                {isHighSchool && (
                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-emerald-700" />
                        <span>High School Application Card Fields</span>
                      </h4>
                      <span className="text-[10px] bg-white text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                        Physical Form Match
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">School *</label>
                        <input
                          type="text"
                          required={isHighSchool}
                          placeholder="e.g. Camarines Norte National High School"
                          value={formData.school_name}
                          onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Year / Grade Level *</label>
                        <input
                          type="text"
                          required={isHighSchool}
                          placeholder="e.g. Grade 9 / Grade 10"
                          value={formData.grade_level}
                          onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">
                        Family Members (Parents and number of siblings)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Parents, 2 siblings"
                        value={formData.family_details}
                        onChange={(e) => setFormData({ ...formData, family_details: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Hobbies</label>
                        <input
                          type="text"
                          placeholder="e.g. Playing badminton, reading, studying"
                          value={formData.hobbies}
                          onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Who Invites You in DPC?</label>
                        <input
                          type="text"
                          placeholder="e.g. Christine Rosales, Mykhasla Rosales"
                          value={formData.invited_by}
                          onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Youth Ministry Form Fields */}
                {isYouth && (
                  <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-indigo-700" />
                        <span>Youth Ministry Application Card Fields</span>
                      </h4>
                      <span className="text-[10px] bg-white text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-200">
                        Youth Scope
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">College / University</label>
                        <input
                          type="text"
                          placeholder="e.g. CNSC / Mabini Colleges / La Consolacion"
                          value={formData.school_name}
                          onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Program and Major</label>
                        <input
                          type="text"
                          placeholder="e.g. BS Information Technology, BS Nursing"
                          value={formData.program_major}
                          onChange={(e) => setFormData({ ...formData, program_major: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sage-600" />
                          <span>Class Schedule</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MWF 8:00 AM - 12:00 PM, TTH 1:00 - 5:00 PM"
                          value={formData.class_schedule}
                          onChange={(e) => setFormData({ ...formData, class_schedule: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">
                          Family Members (Parents & siblings)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Parents + 2 siblings"
                          value={formData.family_details}
                          onChange={(e) => setFormData({ ...formData, family_details: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Hobbies</label>
                        <input
                          type="text"
                          placeholder="e.g. Music, Guitar, Reading, Basketball"
                          value={formData.hobbies}
                          onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Who Invites You in DPC?</label>
                        <input
                          type="text"
                          placeholder="e.g. Marcus Vance / Youth Leader"
                          value={formData.invited_by}
                          onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">Previous Church Attended</label>
                      <input
                        type="text"
                        placeholder="e.g. Daet Baptist / Catholic / None"
                        value={formData.previous_church}
                        onChange={(e) => setFormData({ ...formData, previous_church: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>
                  </div>
                )}

                {/* 5. Young Adult Ministry Form Fields */}
                {isYoungAdult && (
                  <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200 space-y-3">
                    <h4 className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-purple-700" />
                      <span>Young Adult Application Card Fields</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Occupation / Workplace</label>
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer / Accountant / Teacher"
                          value={formData.occupation}
                          onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">
                          Family Members (Parents & siblings)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Parents, 1 brother"
                          value={formData.family_details}
                          onChange={(e) => setFormData({ ...formData, family_details: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Hobbies</label>
                        <input
                          type="text"
                          placeholder="e.g. Coffee brewing, hiking, reading"
                          value={formData.hobbies}
                          onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Who Invites You in DPC?</label>
                        <input
                          type="text"
                          placeholder="e.g. Hannah Bautista"
                          value={formData.invited_by}
                          onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">Previous Religion / Church</label>
                      <input
                        type="text"
                        placeholder="e.g. Roman Catholic / Seventh-day Adventist / None"
                        value={formData.previous_church}
                        onChange={(e) => setFormData({ ...formData, previous_church: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>
                  </div>
                )}

                {/* 6. Junior Adult Ministry (Matches Photo 1) */}
                {isJuniorAdult && (
                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-amber-700" />
                        <span>Junior Adult Application Card Fields</span>
                      </h4>
                      <span className="text-[10px] bg-white text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200">
                        Physical Card Match
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Occupation</label>
                        <input
                          type="text"
                          placeholder="e.g. Office staff"
                          value={formData.occupation}
                          onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Facebook Account</label>
                        <input
                          type="text"
                          placeholder="e.g. Fb: Zettsu"
                          value={formData.facebook_account}
                          onChange={(e) => setFormData({ ...formData, facebook_account: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">Family Members</label>
                      <input
                        type="text"
                        placeholder="e.g. Ziahannah Sky V. Deterra"
                        value={formData.family_details}
                        onChange={(e) => setFormData({ ...formData, family_details: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Hobbies</label>
                        <input
                          type="text"
                          placeholder="e.g. Reading & cooking"
                          value={formData.hobbies}
                          onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Who Invites You in DPC?</label>
                        <input
                          type="text"
                          placeholder="e.g. Jayson Almadrones"
                          value={formData.invited_by}
                          onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Old Adult / Senior Ministry */}
                {isOldAdult && (
                  <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 space-y-3">
                    <h4 className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                      <span>Senior / Old Adult Application Card Fields</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Occupation / Status</label>
                        <input
                          type="text"
                          placeholder="e.g. Retired / Homemaker / Self-employed"
                          value={formData.occupation}
                          onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-charcoal/70 mb-1">Who Invites You in DPC?</label>
                        <input
                          type="text"
                          placeholder="e.g. Pastor / Family member"
                          value={formData.invited_by}
                          onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">Family Members / Living With</label>
                      <input
                        type="text"
                        placeholder="e.g. Living with son/daughter and grandchildren"
                        value={formData.family_details}
                        onChange={(e) => setFormData({ ...formData, family_details: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-charcoal/70 mb-1">
                        Medical / Health Maintenance Instructions
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hypertension maintenance, Needs walking assistance"
                        value={formData.medical_notes}
                        onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                        className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                      />
                    </div>
                  </div>
                )}

                {/* Default Fallback for General / Unmatched */}
                {(!isKinder && !isElementary && !isHighSchool && !isYouth && !isYoungAdult && !isJuniorAdult && !isOldAdult) && (
                  <div>
                    <label className="block font-bold text-charcoal/70 mb-1">Medical / Allergy Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Peanut allergy, Asthma inhaler"
                      value={formData.medical_notes}
                      onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                      className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Application Record</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Add Household Modal */}
      {isAddHouseholdModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-600" />
                <span>Create Household Family Group</span>
              </h2>
              <button onClick={() => setIsAddHouseholdModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHousehold} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Household Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Rodriguez Family"
                  value={householdForm.name}
                  onChange={(e) => setHouseholdForm({ ...householdForm, name: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Primary Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Main Street, City"
                  value={householdForm.address}
                  onChange={(e) => setHouseholdForm({ ...householdForm, address: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Family Emergency Contact Phone</label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={householdForm.primary_contact_phone}
                  onChange={(e) => setHouseholdForm({ ...householdForm, primary_contact_phone: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddHouseholdModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md"
                >
                  Create Household
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Birthday Greeting Modal */}
      {greetingMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Cake className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-charcoal">Send Birthday Blessing</h3>
                  <p className="text-xs text-charcoal/50">
                    To {greetingMember.first_name} {greetingMember.last_name} (Turning {greetingMember.turning_age || ((greetingMember.age ?? 0) + 1)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGreetingMember(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-charcoal/50 hover:text-charcoal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {greetingSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-700 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-charcoal text-base">Birthday Blessing Posted!</h4>
                <p className="text-xs text-charcoal/60">
                  A celebratory blessing has been published to the church announcement board.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1.5">
                    Pastoral Message & Scripture Blessing
                  </label>
                  <textarea
                    rows={4}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    placeholder="Write a warm birthday prayer or blessing..."
                  />
                </div>

                {/* Quick Scripture Presets */}
                <div>
                  <span className="text-[11px] font-semibold text-charcoal/60 block mb-1.5">
                    Insert Scripture Verse:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Numbers 6:24-25 (Blessing)",
                        verse: `"The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25)`
                      },
                      {
                        label: "Jeremiah 29:11 (Hope & Future)",
                        verse: `"For I know the plans I have for you, declares the Lord, plans to give you a future and a hope." (Jeremiah 29:11)`
                      },
                      {
                        label: "Psalm 20:4 (Desires of Heart)",
                        verse: `"May He grant you your heart's desire and fulfill all your plans!" (Psalm 20:4)`
                      },
                      {
                        label: "Psalm 118:24 (Rejoice)",
                        verse: `"This is the day that the Lord has made; let us rejoice and be glad in it!" (Psalm 118:24)`
                      }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const turning = greetingMember.turning_age || ((greetingMember.age ?? 0) + 1);
                          setGreetingMessage(
                            `Happy ${turning}th Birthday, ${greetingMember.first_name}! 🎂 ${item.verse} Praying God's richest blessings over your life!`
                          );
                        }}
                        className="text-[10px] font-medium bg-indigo-50 text-indigo hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-100 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setGreetingMember(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal/70 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendGreeting}
                    disabled={sendingGreeting || !greetingMessage.trim()}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingGreeting ? "Posting..." : "Publish Blessing"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
