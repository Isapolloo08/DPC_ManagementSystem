import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X, Sparkles, School, GraduationCap, BookOpen, Layers, Edit3, PlusCircle } from "lucide-react";

export interface AutocompleteSuggestion {
  title: string;
  category?: string;
  subtitle?: string;
  aliases?: string[];
}

export interface SearchableAutocompleteProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: (string | AutocompleteSuggestion)[];
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  apiEndpoint?: string;
  allowManualToggle?: boolean;
}

// Clean normalize string for ultra-tolerant search (case-insensitive, accents, punctuation)
const cleanNormalize = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Compact alphanumeric string without any spaces/punctuation (e.g., "bsit", "bsnursing")
const cleanCompact = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

export const SearchableAutocomplete: React.FC<SearchableAutocompleteProps> = ({
  label,
  value,
  onChange,
  placeholder = "Type or select...",
  suggestions,
  required = false,
  icon,
  className = "",
  apiEndpoint,
  allowManualToggle = true
}) => {
  const [isManualMode, setIsManualMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<(string | AutocompleteSuggestion)[]>(suggestions);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Normalize suggestions to structured items with precomputed search tokens
  const normalizedList = useMemo<AutocompleteSuggestion[]>(() => {
    return liveSuggestions.map((item) => {
      if (typeof item === "string") {
        return { title: item };
      }
      return item;
    });
  }, [liveSuggestions]);

  // Optional background API fetch if endpoint provided
  useEffect(() => {
    if (!apiEndpoint || !navigator.onLine) return;
    let mounted = true;

    const fetchRemote = async () => {
      try {
        const res = await fetch(apiEndpoint);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && Array.isArray(data)) {
          const remoteNames: AutocompleteSuggestion[] = data.map((d: any) => ({
            title: d.name || d.title,
            category: "CHED / Higher Ed",
            subtitle: d.country || "Philippines"
          }));

          const existingTitles = new Set(normalizedList.map((n) => cleanCompact(n.title)));
          const dedupedRemote = remoteNames.filter((r) => r.title && !existingTitles.has(cleanCompact(r.title)));
          setLiveSuggestions([...suggestions, ...dedupedRemote]);
        }
      } catch (err) {
        // Graceful fallback to bundled suggestions
      }
    };

    fetchRemote();
    return () => {
      mounted = false;
    };
  }, [apiEndpoint]);

  // Case-Insensitive (Caps Lock & Lowercase tolerant) Multi-token Search Filter
  const filtered = useMemo(() => {
    if (!value || !value.trim()) return normalizedList;

    const queryRaw = value.trim();
    const queryNormalized = cleanNormalize(queryRaw);
    const queryCompact = cleanCompact(queryRaw);
    const queryTokens = queryNormalized.split(" ").filter(Boolean);

    return normalizedList.filter((item) => {
      const titleNorm = cleanNormalize(item.title);
      const titleComp = cleanCompact(item.title);
      const subNorm = item.subtitle ? cleanNormalize(item.subtitle) : "";
      const catNorm = item.category ? cleanNormalize(item.category) : "";

      // 1. Direct compact match (e.g. "bsit" matches "BS Information Technology (BSIT)")
      if (queryCompact && titleComp.includes(queryCompact)) return true;

      // 2. Direct normalized substring match (handles ALL-CAPS, lowercase, mixed case)
      if (titleNorm.includes(queryNormalized) || subNorm.includes(queryNormalized) || catNorm.includes(queryNormalized)) {
        return true;
      }

      // 3. Multi-word tokens match (e.g. "bs nursing" or "nursing bs" or "daet cnsc")
      const allTokensMatch = queryTokens.every((token) => {
        return titleNorm.includes(token) || subNorm.includes(token) || catNorm.includes(token);
      });
      if (allTokensMatch) return true;

      // 4. Custom aliases match
      if (item.aliases && item.aliases.some((a) => cleanCompact(a).includes(queryCompact) || cleanNormalize(a).includes(queryNormalized))) {
        return true;
      }

      return false;
    });
  }, [normalizedList, value]);

  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const popoverWidth = Math.max(rect.width, 280);
      const popoverHeight = 250;

      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;

      let top = rect.bottom + 4;
      if (window.innerHeight - rect.bottom < popoverHeight && rect.top > popoverHeight) {
        top = rect.top - popoverHeight - 4;
      }

      setCoords({
        top,
        left,
        width: popoverWidth
      });
    }
  };

  useEffect(() => {
    if (isOpen && !isManualMode) {
      updatePosition();

      const handleScrollOrResize = () => {
        updatePosition();
      };

      const handleClickOutside = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen(false);
        }
      };

      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, true);
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize, true);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, isManualMode]);

  const handleSelect = (item: AutocompleteSuggestion) => {
    onChange(item.title);
    setIsOpen(false);
  };

  const handleConfirmCustom = () => {
    setIsOpen(false);
  };

  // Check if current value exactly matches any existing suggestion title
  const hasExactMatch = useMemo(() => {
    if (!value) return false;
    const vComp = cleanCompact(value);
    return normalizedList.some((item) => cleanCompact(item.title) === vComp);
  }, [normalizedList, value]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label and 1-Click Manual Mode Switch */}
      <div className="flex items-center justify-between mb-1">
        <label className="block font-bold text-[11px] text-charcoal/80 flex items-center gap-1.5">
          {icon}
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
        </label>

        {allowManualToggle && (
          <button
            type="button"
            onClick={() => {
              const next = !isManualMode;
              setIsManualMode(next);
              if (next) setIsOpen(false);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className={`text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all px-2 py-0.5 rounded-lg border ${
              isManualMode
                ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
                : "bg-white hover:bg-gray-50 text-indigo-800 border-gray-200 hover:border-indigo-300"
            }`}
          >
            {isManualMode ? (
              <>
                <Layers className="w-2.5 h-2.5 text-amber-700" />
                <span>Suggestions Mode</span>
              </>
            ) : (
              <>
                <Edit3 className="w-2.5 h-2.5 text-indigo-600" />
                <span>Manual Input</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isManualMode && !isOpen) {
              updatePosition();
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (!isManualMode) {
              updatePosition();
              setIsOpen(true);
            }
          }}
          placeholder={isManualMode ? `Type ${label.toLowerCase()} manually...` : placeholder}
          className={`w-full px-3 py-2 pr-8 rounded-xl border text-xs font-semibold text-charcoal shadow-2xs placeholder:text-charcoal/40 transition-colors focus:outline-none ${
            isManualMode
              ? "bg-amber-50/30 border-amber-300 focus:border-amber-500 focus:bg-white"
              : "bg-white border-gray-200 focus:border-indigo"
          }`}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="p-1 text-charcoal/40 hover:text-charcoal cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : !isManualMode ? (
            <button
              type="button"
              onClick={() => {
                updatePosition();
                setIsOpen(!isOpen);
                inputRef.current?.focus();
              }}
              className="p-1 text-charcoal/40 hover:text-indigo cursor-pointer"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-indigo" : ""
                }`}
              />
            </button>
          ) : null}
        </div>
      </div>

      {/* Floating Autocomplete Suggestions Popover */}
      {isOpen && !isManualMode && coords && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: "260px"
          }}
          className="z-[130] bg-white rounded-2xl shadow-2xl border border-indigo-200 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header with scope and quick manual action */}
          <div className="px-1.5 py-0.5 flex items-center justify-between text-[10px] text-charcoal/50 font-bold border-b border-gray-100">
            <span>Suggestions</span>
            <span>{filtered.length} matching</span>
          </div>

          {/* Explicit "Use Custom Input" Quick Action if user typed non-empty text */}
          {value.trim() && !hasExactMatch && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleConfirmCustom();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <PlusCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">Use: <strong>"{value.trim()}"</strong></span>
              </div>
              <span className="text-[9px] bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded font-black shrink-0 ml-1">
                Custom Entry
              </span>
            </button>
          )}

          {/* Scrollable Results List */}
          <div className="overflow-y-auto max-h-[175px] space-y-0.5 pr-0.5 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-4 px-3 text-center space-y-1.5">
                <p className="text-xs text-charcoal/70 font-semibold">
                  Custom entry: <span className="text-indigo font-bold">"{value}"</span>
                </p>
                <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 py-0.5 px-2 rounded-md inline-block border border-emerald-200">
                  ✓ Custom input will be saved
                </p>
              </div>
            ) : (
              filtered.slice(0, 40).map((item, idx) => {
                const isSelected = cleanCompact(value) === cleanCompact(item.title);
                return (
                  <button
                    key={`${item.title}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-indigo text-white font-bold shadow-2xs"
                        : "hover:bg-indigo-50/80 text-charcoal font-medium hover:text-indigo-950"
                    }`}
                  >
                    <div className="truncate flex-1">
                      <div className="truncate font-semibold">{item.title}</div>
                      {item.subtitle && (
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? "text-indigo-100" : "text-charcoal/50"
                          }`}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.category && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-black tracking-wide ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : item.category.includes("Camarines") ||
                                item.category.includes("Daet")
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}
                        >
                          {item.category}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// =========================================================================
// PRE-BUNDLED COMPREHENSIVE DATASETS WITH ALIASES (CAPSLOCK & LOWERCASE READY)
// =========================================================================

export const PHILIPPINE_HIGH_SCHOOLS: AutocompleteSuggestion[] = [
  // Local Daet & Camarines Norte High Schools
  { title: "Camarines Norte National High School (CNNHS)", category: "Daet", subtitle: "F. Pimentel Ave, Daet", aliases: ["cnnhs", "cam norte high", "camarines norte high school"] },
  { title: "Mabini Colleges - High School Department", category: "Daet", subtitle: "Gov. Panotes Ave, Daet", aliases: ["mc hs", "mabini hs", "mabini high school"] },
  { title: "La Consolacion College of Daet - Basic Ed", category: "Daet", subtitle: "F. Pimentel Ave, Daet", aliases: ["lccd hs", "consolacion hs", "la consolacion high school"] },
  { title: "Chun Hua High School", category: "Daet", subtitle: "Daet, Camarines Norte", aliases: ["chun hua", "chhs"] },
  { title: "Daet National High School", category: "Daet", subtitle: "Daet, Camarines Norte", aliases: ["dnhs", "daet high school"] },
  { title: "Basud National High School", category: "Camarines Norte", subtitle: "Basud, Camarines Norte", aliases: ["bnhs", "basud high school"] },
  { title: "Labo National High School", category: "Camarines Norte", subtitle: "Labo, Camarines Norte", aliases: ["lnhs", "labo high school"] },
  { title: "Vinzons Pilot High School", category: "Camarines Norte", subtitle: "Vinzons, Camarines Norte", aliases: ["vphs", "vinzons high school"] },
  { title: "Jose Panganiban National High School", category: "Camarines Norte", subtitle: "Jose Panganiban, Camarines Norte", aliases: ["jpnhs", "panganiban high school"] },
  { title: "Paracale National High School", category: "Camarines Norte", subtitle: "Paracale, Camarines Norte", aliases: ["pnhs", "paracale high school"] },
  { title: "Capalonga National High School", category: "Camarines Norte", subtitle: "Capalonga, Camarines Norte", aliases: ["cnhs", "capalonga high school"] },
  { title: "Talisay National High School", category: "Camarines Norte", subtitle: "Talisay, Camarines Norte", aliases: ["tnhs", "talisay high school"] },
  { title: "San Vicente National High School", category: "Camarines Norte", subtitle: "San Vicente, Camarines Norte", aliases: ["svnhs"] },
  { title: "San Lorenzo Ruiz National High School", category: "Camarines Norte", subtitle: "San Lorenzo Ruiz, Camarines Norte", aliases: ["slrnhs"] },
  { title: "Santa Elena National High School", category: "Camarines Norte", subtitle: "Santa Elena, Camarines Norte", aliases: ["senhs"] },
  { title: "Mercedes National High School", category: "Camarines Norte", subtitle: "Mercedes, Camarines Norte", aliases: ["mnhs"] },
  { title: "Our Lady of Lourdes College Foundation - HS", category: "Daet", subtitle: "Daet, Camarines Norte", aliases: ["ollcf hs", "lourdes hs"] },

  // Regional & Science High Schools
  { title: "Philippine Science High School - Bicol Region Campus", category: "Regional Science", subtitle: "Goa, Camarines Sur", aliases: ["pshs", "pisay", "pshs brc"] },
  { title: "Camarines Sur National High School (CSNHS)", category: "Bicol", subtitle: "Naga City", aliases: ["csnhs"] },
  { title: "Ateneo de Naga University - Junior/Senior High", category: "Bicol", subtitle: "Naga City", aliases: ["adnu hs", "ateneo hs"] },
  { title: "University of Nueva Caceres - High School", category: "Bicol", subtitle: "Naga City", aliases: ["unc hs"] },
  { title: "Bicol Regional Science High School", category: "Regional Science", subtitle: "Ligao City, Albay", aliases: ["brshs"] }
];

export const HIGH_SCHOOL_GRADE_LEVELS: AutocompleteSuggestion[] = [
  { title: "Grade 7", category: "Junior High", subtitle: "1st Year Junior High", aliases: ["g7", "grade 7", "grade7"] },
  { title: "Grade 8", category: "Junior High", subtitle: "2nd Year Junior High", aliases: ["g8", "grade 8", "grade8"] },
  { title: "Grade 9", category: "Junior High", subtitle: "3rd Year Junior High", aliases: ["g9", "grade 9", "grade9"] },
  { title: "Grade 10", category: "Junior High", subtitle: "Junior High Completer", aliases: ["g10", "grade 10", "grade10"] },
  { title: "Grade 11 - STEM", category: "Senior High", subtitle: "Science, Tech, Engineering & Math", aliases: ["stem", "grade 11 stem", "g11 stem", "stem 11"] },
  { title: "Grade 11 - ABM", category: "Senior High", subtitle: "Accountancy, Business & Management", aliases: ["abm", "grade 11 abm", "g11 abm", "abm 11"] },
  { title: "Grade 11 - HUMSS", category: "Senior High", subtitle: "Humanities & Social Sciences", aliases: ["humss", "grade 11 humss", "g11 humss", "humss 11"] },
  { title: "Grade 11 - GAS", category: "Senior High", subtitle: "General Academic Strand", aliases: ["gas", "grade 11 gas", "g11 gas", "gas 11"] },
  { title: "Grade 11 - TVL", category: "Senior High", subtitle: "Technical-Vocational-Livelihood", aliases: ["tvl", "grade 11 tvl", "g11 tvl", "tvl 11"] },
  { title: "Grade 12 - STEM", category: "Senior High", subtitle: "Science, Tech, Engineering & Math", aliases: ["stem", "grade 12 stem", "g12 stem", "stem 12"] },
  { title: "Grade 12 - ABM", category: "Senior High", subtitle: "Accountancy, Business & Management", aliases: ["abm", "grade 12 abm", "g12 abm", "abm 12"] },
  { title: "Grade 12 - HUMSS", category: "Senior High", subtitle: "Humanities & Social Sciences", aliases: ["humss", "grade 12 humss", "g12 humss", "humss 12"] },
  { title: "Grade 12 - GAS", category: "Senior High", subtitle: "General Academic Strand", aliases: ["gas", "grade 12 gas", "g12 gas", "gas 12"] },
  { title: "Grade 12 - TVL", category: "Senior High", subtitle: "Technical-Vocational-Livelihood", aliases: ["tvl", "grade 12 tvl", "g12 tvl", "tvl 12"] }
];

export const PHILIPPINE_COLLEGES_UNIVERSITIES: AutocompleteSuggestion[] = [
  // Local Camarines Norte & Bicol Colleges / Universities
  { title: "Camarines Norte State College (CNSC - Main Campus)", category: "Daet", subtitle: "F. Pimentel Ave, Daet", aliases: ["cnsc", "cnsc main", "camarines norte state college"] },
  { title: "Camarines Norte State College (CNSC - Abaño Campus)", category: "Daet", subtitle: "Abaño, Daet", aliases: ["cnsc abaño", "cnsc abano", "abaño campus"] },
  { title: "Camarines Norte State College (CNSC - Mercedes Campus)", category: "Mercedes", subtitle: "Mercedes, Camarines Norte", aliases: ["cnsc mercedes", "mercedes campus"] },
  { title: "Camarines Norte State College (CNSC - Labo Campus)", category: "Labo", subtitle: "Labo, Camarines Norte", aliases: ["cnsc labo", "labo campus"] },
  { title: "Camarines Norte State College (CNSC - Panganiban Campus)", category: "Panganiban", subtitle: "Jose Panganiban, Camarines Norte", aliases: ["cnsc panganiban", "panganiban campus"] },
  { title: "Mabini Colleges (MC)", category: "Daet", subtitle: "Gov. Panotes Ave, Daet", aliases: ["mc", "mabini", "mabini college", "mabini colleges daet"] },
  { title: "La Consolacion College of Daet (LCCD)", category: "Daet", subtitle: "F. Pimentel Ave, Daet", aliases: ["lccd", "la consolacion", "consolacion", "lcc"] },
  { title: "Our Lady of Lourdes College Foundation (OLLCF)", category: "Daet", subtitle: "Vinzons Ave, Daet", aliases: ["ollcf", "lourdes", "our lady of lourdes"] },
  { title: "STI College - Daet", category: "Daet", subtitle: "Daet, Camarines Norte", aliases: ["sti", "sti daet", "sti college"] },
  { title: "AMA Computer Learning Center - Daet", category: "Daet", subtitle: "Daet, Camarines Norte", aliases: ["ama", "aclc", "aclc daet", "ama computer college"] },

  // Major Bicol Regional Universities
  { title: "Ateneo de Naga University (ADNU)", category: "Bicol", subtitle: "Naga City", aliases: ["adnu", "ateneo", "ateneo de naga"] },
  { title: "University of Nueva Caceres (UNC)", category: "Bicol", subtitle: "Naga City", aliases: ["unc", "nueva caceres"] },
  { title: "Bicol University (BU)", category: "Bicol", subtitle: "Legazpi City, Albay", aliases: ["bu", "bicol u", "bicol university legazpi"] },
  { title: "Universidad de Santa Isabel (USI)", category: "Bicol", subtitle: "Naga City", aliases: ["usi", "santa isabel"] },
  { title: "Central Bicol State University of Agriculture (CBSUA)", category: "Bicol", subtitle: "Pili, Camarines Sur", aliases: ["cbsua", "cbsua pili"] },

  // Top National Universities
  { title: "University of the Philippines Diliman (UPD)", category: "National", subtitle: "Quezon City", aliases: ["up", "upd", "up diliman"] },
  { title: "University of the Philippines Los Baños (UPLB)", category: "National", subtitle: "Los Baños, Laguna", aliases: ["uplb", "up los banos"] },
  { title: "University of Santo Tomas (UST)", category: "National", subtitle: "España, Manila", aliases: ["ust", "santo tomas", "ust manila"] },
  { title: "De La Salle University (DLSU)", category: "National", subtitle: "Taft Ave, Manila", aliases: ["dlsu", "la salle", "lasalle"] },
  { title: "Ateneo de Manila University (ADMU)", category: "National", subtitle: "Katipunan, Quezon City", aliases: ["admu", "ateneo de manila"] },
  { title: "Polytechnic University of the Philippines (PUP)", category: "National", subtitle: "Sta. Mesa, Manila", aliases: ["pup", "pup sta mesa", "polytechnic"] },
  { title: "Far Eastern University (FEU)", category: "National", subtitle: "Manila", aliases: ["feu", "feu manila"] },
  { title: "Mapúa University", category: "National", subtitle: "Intramuros / Makati", aliases: ["mapua", "mit"] },
  { title: "Adamson University", category: "National", subtitle: "San Marcelino, Manila", aliases: ["adu", "adamson"] },
  { title: "Centro Escolar University (CEU)", category: "National", subtitle: "Mendiola, Manila", aliases: ["ceu"] },
  { title: "University of the East (UE)", category: "National", subtitle: "Manila / Caloocan", aliases: ["ue", "ue manila"] }
];

export const PHILIPPINE_DEGREE_PROGRAMS: AutocompleteSuggestion[] = [
  // Technology & Computing
  { title: "BS Information Technology (BSIT)", category: "Computing", subtitle: "CHED Accredited", aliases: ["bsit", "it", "infotech", "info tech", "information technology"] },
  { title: "BS Computer Science (BSCS)", category: "Computing", subtitle: "CHED Accredited", aliases: ["bscs", "cs", "comsci", "com sci", "computer science"] },
  { title: "BS Information Systems (BSIS)", category: "Computing", subtitle: "CHED Accredited", aliases: ["bsis", "is", "information systems"] },
  { title: "BS Computer Engineering (BSCpE)", category: "Engineering", subtitle: "CHED Accredited", aliases: ["bscpe", "cpe", "computer engineering", "comeng"] },

  // Health Sciences
  { title: "BS Nursing (BSN)", category: "Health", subtitle: "CHED Accredited", aliases: ["bsn", "nursing", "nurse", "bs nursing"] },
  { title: "BS Medical Technology (BSMT)", category: "Health", subtitle: "CHED Accredited", aliases: ["bsmt", "medtech", "med tech", "medical technology"] },
  { title: "BS Pharmacy", category: "Health", subtitle: "CHED Accredited", aliases: ["pharmacy", "pharma", "bs pharmacy"] },
  { title: "BS Physical Therapy (BSPT)", category: "Health", subtitle: "CHED Accredited", aliases: ["bspt", "pt", "physical therapy"] },
  { title: "BS Midwifery", category: "Health", subtitle: "CHED Accredited", aliases: ["midwifery"] },

  // Business, Management & Hospitality
  { title: "BS Accountancy (BSA)", category: "Business", subtitle: "CPA Board", aliases: ["bsa", "accountancy", "accounting", "bs accountancy"] },
  { title: "BS Management Accounting (BSMA)", category: "Business", subtitle: "CHED Accredited", aliases: ["bsma", "management accounting"] },
  { title: "BS Business Administration - Financial Management", category: "Business", subtitle: "CHED Accredited", aliases: ["bsba fm", "finman", "financial management", "bsba finance"] },
  { title: "BS Business Administration - Marketing Management", category: "Business", subtitle: "CHED Accredited", aliases: ["bsba mm", "marketing", "marketing management", "bsba marketing"] },
  { title: "BS Business Administration - Human Resource Management", category: "Business", subtitle: "CHED Accredited", aliases: ["bsba hr", "hr", "human resource", "bsba hrm"] },
  { title: "BS Hospitality Management (BSHM)", category: "Hospitality", subtitle: "CHED Accredited", aliases: ["bshm", "hm", "hotel and restaurant", "hospitality management", "hrm"] },
  { title: "BS Tourism Management (BSTM)", category: "Hospitality", subtitle: "CHED Accredited", aliases: ["bstm", "tm", "tourism", "tourism management"] },

  // Engineering & Architecture
  { title: "BS Civil Engineering (BSCE)", category: "Engineering", subtitle: "PRC Board", aliases: ["bsce", "ce", "civil engineering", "civil"] },
  { title: "BS Electrical Engineering (BSEE)", category: "Engineering", subtitle: "PRC Board", aliases: ["bsee", "ee", "electrical engineering", "electrical"] },
  { title: "BS Mechanical Engineering (BSME)", category: "Engineering", subtitle: "PRC Board", aliases: ["bsme", "me", "mechanical engineering", "mechanical"] },
  { title: "BS Electronics Engineering (BSECE)", category: "Engineering", subtitle: "PRC Board", aliases: ["bsece", "ece", "electronics engineering"] },
  { title: "BS Architecture", category: "Architecture", subtitle: "PRC Board", aliases: ["architecture", "archi", "bs archi"] },

  // Education & Arts
  { title: "Bachelor of Elementary Education (BEEd)", category: "Education", subtitle: "LET Board", aliases: ["beed", "elementary education", "educ elementary"] },
  { title: "Bachelor of Secondary Education - Major in English (BSEd)", category: "Education", subtitle: "LET Board", aliases: ["bsed english", "bsed eng", "english major", "education english"] },
  { title: "Bachelor of Secondary Education - Major in Mathematics (BSEd)", category: "Education", subtitle: "LET Board", aliases: ["bsed math", "math major", "education math"] },
  { title: "Bachelor of Secondary Education - Major in Science (BSEd)", category: "Education", subtitle: "LET Board", aliases: ["bsed science", "science major", "education science"] },
  { title: "Bachelor of Secondary Education - Major in Social Studies (BSEd)", category: "Education", subtitle: "LET Board", aliases: ["bsed soc stud", "social studies major", "education socstud"] },
  { title: "BS Psychology", category: "Arts & Sciences", subtitle: "Psychometrician Board", aliases: ["psychology", "psych", "bs psych"] },
  { title: "BA Communication", category: "Arts & Sciences", subtitle: "CHED Accredited", aliases: ["comm", "communication", "masscomm", "mass communication", "ba comm"] },
  { title: "BS Criminology (BSCrim)", category: "Criminal Justice", subtitle: "Criminologist Board", aliases: ["bscrim", "crim", "criminology", "bs criminology"] },
  { title: "BS Agriculture", category: "Agriculture", subtitle: "Agriculturist Board", aliases: ["agriculture", "agri", "bs agri"] },
  { title: "Bachelor of Public Administration (BPA)", category: "Governance", subtitle: "CHED Accredited", aliases: ["bpa", "public administration", "pubad"] }
];

export default SearchableAutocomplete;
