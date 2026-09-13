import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Upload, FileText, Check, AlertCircle, Sparkles,
  ArrowRight, RefreshCw, CheckCircle2, Scan, Clipboard,
  User, Calendar, Phone, MapPin, Search, Plus, Trash2,
  Edit2, Save, Download, HelpCircle, Layers, CheckSquare, Square
} from "lucide-react";
import {
  analyzeMemberFile,
  parseTableOrListText,
  parseSingleMemberText,
  createBlankMember,
  splitFullName,
  normalizeBirthdate,
  normalizePhoneNumber,
  calculateAgeFromBirthdate,
  ParsedMemberData,
  AnalyzeResult
} from "../../utils/memberFormParser";
import { Ministry } from "../../types";
import { api } from "../../api";

interface MemberImportAnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToForm: (data: ParsedMemberData, file?: File | null) => void;
  effectiveMinistries: Ministry[];
  coordinatorMinistryId?: number | null;
  onMemberCreated?: () => void;
}

export const MemberImportAnalyzeModal: React.FC<MemberImportAnalyzeModalProps> = ({
  isOpen,
  onClose,
  onApplyToForm,
  effectiveMinistries,
  coordinatorMinistryId,
  onMemberCreated
}) => {
  const [step, setStep] = useState<"select" | "analyzing" | "preview">("select");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [parsedMembers, setParsedMembers] = useState<ParsedMemberData[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isPasteOpen, setIsPasteOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>("");

  // Table & Editing State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Direct Batch Saving State
  const [isSavingDirect, setIsSavingDirect] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetAll = () => {
    setStep("select");
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setParsedMembers([]);
    setIsDragOver(false);
    setIsPasteOpen(false);
    setPasteText("");
    setSearchQuery("");
    setEditingRowId(null);
    setSelectedRowIds(new Set());
    setIsSavingDirect(false);
    setSaveProgress(null);
    setSaveError(null);
    setSaveSuccessMessage(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setSaveError(null);
    setSaveSuccessMessage(null);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }

    setStep("analyzing");

    try {
      const [result] = await Promise.all([
        analyzeMemberFile(file),
        new Promise(r => setTimeout(r, 600))
      ]);

      const list = result.members.length > 0 ? result.members : [createBlankMember()];
      setParsedMembers(list);
      setSelectedRowIds(new Set(list.map(m => m.id || "")));
      setStep("preview");
    } catch (err) {
      console.error("Analysis error:", err);
      const blank = createBlankMember();
      setParsedMembers([blank]);
      setStep("preview");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePasteAnalyze = () => {
    if (!pasteText.trim()) return;
    setStep("analyzing");
    setTimeout(() => {
      const tableMembers = parseTableOrListText(pasteText);
      const list = tableMembers.length > 0 ? tableMembers : [parseSingleMemberText(pasteText)];
      setParsedMembers(list);
      setSelectedRowIds(new Set(list.map(m => m.id || "")));
      setSelectedFile(null);
      setImagePreviewUrl(null);
      setStep("preview");
    }, 400);
  };

  const handleRowCellChange = (id: string, field: keyof ParsedMemberData, value: string) => {
    setParsedMembers(prev =>
      prev.map(m => {
        if (m.id === id) {
          const updated = { ...m, [field]: value };
          if (field === "birthdate") {
            updated.birthdate = normalizeBirthdate(value);
          } else if (field === "contact_phone") {
            updated.contact_phone = normalizePhoneNumber(value);
          }
          return updated;
        }
        return m;
      })
    );
  };

  const handleAddBlankRow = () => {
    const blank = createBlankMember();
    setParsedMembers(prev => [blank, ...prev]);
    setEditingRowId(blank.id || "");
    setSelectedRowIds(prev => new Set([...prev, blank.id || ""]));
  };

  const handleDeleteRow = (id: string) => {
    setParsedMembers(prev => prev.filter(m => m.id !== id));
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === filteredMembers.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredMembers.map(m => m.id || "")));
    }
  };

  // Age & suggested ministry helper
  const getMinistryForBirthdate = (birthdate: string) => {
    const age = calculateAgeFromBirthdate(birthdate);
    if (age <= 0) return null;
    return effectiveMinistries.find(m => (m.min_age ?? 0) <= age && (m.max_age ?? 999) >= age) || null;
  };

  // Filtered member rows for table display
  const filteredMembers = parsedMembers.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
    const phone = (m.contact_phone || "").toLowerCase();
    const address = (m.address || "").toLowerCase();
    const inviter = (m.invited_by || "").toLowerCase();
    return fullName.includes(q) || phone.includes(q) || address.includes(q) || inviter.includes(q);
  });

  // Transfer single selected member to the full Add Member drawer
  const handleApplySingleToForm = (member: ParsedMemberData) => {
    onApplyToForm(member, selectedFile);
    handleClose();
  };

  // Direct Batch Save to Database via API
  const handleBatchSaveDirect = async () => {
    const membersToSave = parsedMembers.filter(m =>
      selectedRowIds.has(m.id || "") && (m.first_name.trim() || m.last_name.trim())
    );

    if (membersToSave.length === 0) {
      setSaveError("No valid members selected. Please make sure each member has a First Name or Last Name.");
      return;
    }

    try {
      setIsSavingDirect(true);
      setSaveError(null);
      setSaveSuccessMessage(null);
      setSaveProgress({ current: 0, total: membersToSave.length, success: 0, failed: 0 });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < membersToSave.length; i++) {
        const item = membersToSave[i];
        try {
          const suggested = getMinistryForBirthdate(item.birthdate);
          const targetMinistryId = coordinatorMinistryId
            ? coordinatorMinistryId
            : (suggested ? suggested.id : null);

          await api.createMember({
            first_name: item.first_name.trim() || "Member",
            last_name: item.last_name.trim() || "DPC",
            birthdate: item.birthdate || undefined,
            gender: item.gender || "Male",
            contact_email: item.contact_email || undefined,
            contact_phone: item.contact_phone || undefined,
            address: item.address || undefined,
            guardian_names: item.guardian_names || undefined,
            guardian_phone: item.guardian_phone || undefined,
            invited_by: item.invited_by || undefined,
            school_name: item.school_name || undefined,
            grade_level: item.grade_level || undefined,
            program_major: item.program_major || undefined,
            class_schedule: item.class_schedule || undefined,
            occupation: item.occupation || undefined,
            hobbies: item.hobbies || undefined,
            previous_church: item.previous_church || undefined,
            facebook_account: item.facebook_account || undefined,
            medical_notes: item.medical_notes || undefined,
            family_details: item.family_details || undefined,
            ministry_id: targetMinistryId,
            status: "active"
          });

          successCount++;
        } catch (rowErr) {
          console.error(`Failed to save member ${item.first_name} ${item.last_name}:`, rowErr);
          failCount++;
        }

        setSaveProgress({
          current: i + 1,
          total: membersToSave.length,
          success: successCount,
          failed: failCount
        });
      }

      if (onMemberCreated) {
        onMemberCreated();
      }

      setSaveSuccessMessage(`Successfully imported ${successCount} member record${successCount !== 1 ? "s" : ""}!`);
      setTimeout(() => {
        handleClose();
      }, 1400);
    } catch (err: any) {
      console.error("Batch save failed:", err);
      setSaveError(err.message || "Failed to complete batch import.");
    } finally {
      setIsSavingDirect(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shadow-inner">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {step === "preview" ? "Member Import & Spreadsheet Table Review" : "Import & Analyze Member Information List"}
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {step === "preview" ? `${parsedMembers.length} Rows Detected` : "Step 1: Upload / Paste"}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {step === "preview"
                  ? "Spreadsheet data table view. Edit any cell inline, select members, and batch import directly."
                  : "Upload an Excel/CSV file, photo of membership sheet, or paste rows from Google Sheets / Excel."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 grow flex flex-col min-h-0">
          
          {/* STEP 1: FILE SELECTION / UPLOAD */}
          {step === "select" && (
            <div className="space-y-5 my-auto max-w-2xl mx-auto w-full py-4">
              
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3.5 group ${
                  isDragOver
                    ? "border-amber-500 bg-amber-50/60 scale-[1.01]"
                    : "border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 bg-slate-50/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.csv,.txt,.json,.vcf,.tsv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>

                <div>
                  <h4 className="text-base font-black text-slate-900">
                    Click to browse or drag & drop file here
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports Google Sheets / Excel CSV, Text Tables, TSV, or Registration Photos (JPG, PNG)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-slate-600 font-bold">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">📊 Excel / CSV</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">📷 Photo / Scanned List</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">📝 Text / TSV Table</span>
                </div>
              </div>

              {/* Paste Rows Directly Drawer */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsPasteOpen(!isPasteOpen)}
                  className="w-full flex items-center justify-between text-xs font-black text-slate-800 hover:text-amber-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clipboard className="w-4 h-4 text-amber-600" />
                    <span>Or Copy & Paste Spreadsheet Rows (Google Sheets / Excel Table)</span>
                  </div>
                  <span className="text-xs text-amber-600 font-bold">
                    {isPasteOpen ? "Hide" : "Expand Paste Area"}
                  </span>
                </button>

                {isPasteOpen && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 animate-in fade-in duration-150">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Paste your copied spreadsheet cells here (e.g. 1   Adrian John A. Fausto   9076064078   Lag-on   M   July 29, '01   HS Ministry)..."
                      rows={5}
                      className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-slate-50/50"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPasteText("")}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handlePasteAnalyze}
                        disabled={!pasteText.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Parse Spreadsheet Table</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: SCANNING / ANALYZING ANIMATION */}
          {step === "analyzing" && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 my-auto">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
                  <Scan className="w-8 h-8 animate-spin" />
                </div>
                <div className="absolute -inset-2 rounded-3xl border-2 border-amber-400/40 animate-ping opacity-30" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  Analyzing Spreadsheet & Member Information...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Parsing Philippine names, mobile numbers, birthdays, addresses, and inviter columns into structured data rows.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: SPREADSHEET TABLE REVIEW */}
          {step === "preview" && (
            <div className="space-y-3.5 flex flex-col grow min-h-0">
              
              {/* Alert Feedback Messages */}
              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-bold">{saveSuccessMessage}</span>
                </div>
              )}

              {/* Progress Bar when saving */}
              {isSavingDirect && saveProgress && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-amber-950">
                    <span>Importing members to database ({saveProgress.current} of {saveProgress.total})...</span>
                    <span>{Math.round((saveProgress.current / saveProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-amber-200/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Table Toolbar & Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="relative grow sm:grow-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search detected members..."
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs w-full sm:w-60 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <span className="text-xs font-black bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 whitespace-nowrap shadow-2xs">
                    {selectedRowIds.size} of {parsedMembers.length} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleAddBlankRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>Add Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("select");
                      setPasteText("");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload Another</span>
                  </button>
                </div>
              </div>

              {/* SPREADSHEET TABLE VIEW */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs grow flex flex-col min-h-0 bg-white">
                <div className="overflow-x-auto overflow-y-auto max-h-[48vh] select-text">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="cursor-pointer text-slate-300 hover:text-white"
                          >
                            {selectedRowIds.size === filteredMembers.length && filteredMembers.length > 0 ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="p-3 w-12 text-center">NO.</th>
                        <th className="p-3 min-w-[170px]">FIRST NAME</th>
                        <th className="p-3 min-w-[140px]">LAST NAME</th>
                        <th className="p-3 min-w-[130px]">CP NUMBER</th>
                        <th className="p-3 min-w-[140px]">ADDRESS</th>
                        <th className="p-3 min-w-[90px]">GENDER</th>
                        <th className="p-3 min-w-[130px]">BIRTHDAY</th>
                        <th className="p-3 min-w-[140px]">INVITOR / INVITEE</th>
                        <th className="p-3 min-w-[120px]">MINISTRY / AGE</th>
                        <th className="p-3 w-20 text-center">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-400 text-xs">
                            No member rows found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member, idx) => {
                          const isSelected = selectedRowIds.has(member.id || "");
                          const age = calculateAgeFromBirthdate(member.birthdate);
                          const ministry = getMinistryForBirthdate(member.birthdate);

                          return (
                            <tr
                              key={member.id || idx}
                              className={`transition-colors ${
                                isSelected ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-slate-50"
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSelectRow(member.id || "")}
                                  className="cursor-pointer text-slate-500 hover:text-amber-600"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-amber-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300" />
                                  )}
                                </button>
                              </td>

                              {/* Row Number */}
                              <td className="p-2.5 text-center font-black text-slate-400 text-xs">
                                {idx + 1}
                              </td>

                              {/* First Name */}
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={member.first_name}
                                  onChange={(e) => handleRowCellChange(member.id || "", "first_name", e.target.value)}
                                  placeholder="First name..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 font-bold text-slate-900 bg-transparent text-xs"
                                />
                              </td>

                              {/* Last Name */}
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={member.last_name}
                                  onChange={(e) => handleRowCellChange(member.id || "", "last_name", e.target.value)}
                                  placeholder="Last name..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 font-bold text-slate-900 bg-transparent text-xs"
                                />
                              </td>

                              {/* CP Number */}
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={member.contact_phone}
                                  onChange={(e) => handleRowCellChange(member.id || "", "contact_phone", e.target.value)}
                                  placeholder="09..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 font-mono text-slate-800 bg-transparent text-xs"
                                />
                              </td>

                              {/* Address */}
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={member.address}
                                  onChange={(e) => handleRowCellChange(member.id || "", "address", e.target.value)}
                                  placeholder="Address / Barangay..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 text-slate-800 bg-transparent text-xs"
                                />
                              </td>

                              {/* Gender */}
                              <td className="p-1.5">
                                <select
                                  value={member.gender}
                                  onChange={(e) => handleRowCellChange(member.id || "", "gender", e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                >
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                </select>
                              </td>

                              {/* Birthday */}
                              <td className="p-1.5">
                                <input
                                  type="date"
                                  value={member.birthdate}
                                  onChange={(e) => handleRowCellChange(member.id || "", "birthdate", e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                />
                              </td>

                              {/* Invitor */}
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={member.invited_by}
                                  onChange={(e) => handleRowCellChange(member.id || "", "invited_by", e.target.value)}
                                  placeholder="Invited by..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 text-slate-800 bg-transparent text-xs"
                                />
                              </td>

                              {/* Ministry / Age info */}
                              <td className="p-2.5">
                                {age > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-bold text-indigo-950">
                                      {ministry ? ministry.name : "Assigned"}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {age} yrs old
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No bday</span>
                                )}
                              </td>

                              {/* Action buttons */}
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleApplySingleToForm(member)}
                                    title="Open and edit in full Add Member Form"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(member.id || "")}
                                    title="Delete row"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 shrink-0">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Ready to import <strong>{selectedRowIds.size}</strong> member{selectedRowIds.size !== 1 ? "s" : ""} to church directory.
                  </span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  {/* Transfer 1 member to full form if 1 row is selected */}
                  {selectedRowIds.size === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = parsedMembers.find(m => selectedRowIds.has(m.id || "")) || parsedMembers[0];
                        if (target) handleApplySingleToForm(target);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer"
                    >
                      <span>Edit in Full Add Form</span>
                    </button>
                  )}

                  {/* Batch Save All Direct */}
                  <button
                    type="button"
                    onClick={handleBatchSaveDirect}
                    disabled={isSavingDirect || selectedRowIds.size === 0}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingDirect ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Importing Records...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Import {selectedRowIds.size} Member{selectedRowIds.size !== 1 ? "s" : ""} Directly</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>,
    document.body
  );
};
