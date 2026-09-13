import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  Edit3,
  Check,
  RefreshCw,
  Layers,
  Search,
  ChevronDown,
  X,
  Navigation,
  Compass,
  WifiOff,
  Wifi,
  Sparkles,
  Info
} from "lucide-react";

export type IslandGroup = "Luzon" | "Visayas" | "Mindanao";

export interface PSGCItem {
  code: string;
  name: string;
  regionCode?: string;
  provinceCode?: string;
  cityOrMunicipalityCode?: string;
  islandGroup?: IslandGroup;
}

export interface AddressPickerProps {
  label?: string;
  value: string;
  onChange: (fullAddress: string) => void;
  required?: boolean;
  className?: string;
}

// Convert all-caps string (e.g., "CAMARINES NORTE", "BARANGAY I (ILAOD)") into clean Title Case
export const toTitleCase = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.startsWith("(") && word.length > 1) {
        return "(" + word.charAt(1).toUpperCase() + word.slice(2);
      }
      if (["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "ncr"].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

// =========================================================================
// COMPLETE PHILIPPINE PROVINCES & REGIONS (LUZON, VISAYAS, MINDANAO)
// =========================================================================
export const ALL_PHILIPPINE_PROVINCES: PSGCItem[] = [
  // --- LUZON (39) ---
  { code: "130000000", name: "Metro Manila (NCR)", islandGroup: "Luzon" },
  { code: "140100000", name: "Abra", islandGroup: "Luzon" },
  { code: "050500000", name: "Albay", islandGroup: "Luzon" },
  { code: "148100000", name: "Apayao", islandGroup: "Luzon" },
  { code: "037700000", name: "Aurora", islandGroup: "Luzon" },
  { code: "030800000", name: "Bataan", islandGroup: "Luzon" },
  { code: "020900000", name: "Batanes", islandGroup: "Luzon" },
  { code: "041000000", name: "Batangas", islandGroup: "Luzon" },
  { code: "141100000", name: "Benguet", islandGroup: "Luzon" },
  { code: "031400000", name: "Bulacan", islandGroup: "Luzon" },
  { code: "021500000", name: "Cagayan", islandGroup: "Luzon" },
  { code: "051600000", name: "Camarines Norte", islandGroup: "Luzon" },
  { code: "051700000", name: "Camarines Sur", islandGroup: "Luzon" },
  { code: "052000000", name: "Catanduanes", islandGroup: "Luzon" },
  { code: "042100000", name: "Cavite", islandGroup: "Luzon" },
  { code: "142700000", name: "Ifugao", islandGroup: "Luzon" },
  { code: "012800000", name: "Ilocos Norte", islandGroup: "Luzon" },
  { code: "012900000", name: "Ilocos Sur", islandGroup: "Luzon" },
  { code: "023100000", name: "Isabela", islandGroup: "Luzon" },
  { code: "143200000", name: "Kalinga", islandGroup: "Luzon" },
  { code: "013300000", name: "La Union", islandGroup: "Luzon" },
  { code: "043400000", name: "Laguna", islandGroup: "Luzon" },
  { code: "174000000", name: "Marinduque", islandGroup: "Luzon" },
  { code: "054100000", name: "Masbate", islandGroup: "Luzon" },
  { code: "144400000", name: "Mountain Province", islandGroup: "Luzon" },
  { code: "034900000", name: "Nueva Ecija", islandGroup: "Luzon" },
  { code: "025000000", name: "Nueva Vizcaya", islandGroup: "Luzon" },
  { code: "175100000", name: "Occidental Mindoro", islandGroup: "Luzon" },
  { code: "175200000", name: "Oriental Mindoro", islandGroup: "Luzon" },
  { code: "175300000", name: "Palawan", islandGroup: "Luzon" },
  { code: "035400000", name: "Pampanga", islandGroup: "Luzon" },
  { code: "015500000", name: "Pangasinan", islandGroup: "Luzon" },
  { code: "045600000", name: "Quezon", islandGroup: "Luzon" },
  { code: "025700000", name: "Quirino", islandGroup: "Luzon" },
  { code: "045800000", name: "Rizal", islandGroup: "Luzon" },
  { code: "175900000", name: "Romblon", islandGroup: "Luzon" },
  { code: "056200000", name: "Sorsogon", islandGroup: "Luzon" },
  { code: "036900000", name: "Tarlac", islandGroup: "Luzon" },
  { code: "037100000", name: "Zambales", islandGroup: "Luzon" },

  // --- VISAYAS (16) ---
  { code: "060400000", name: "Aklan", islandGroup: "Visayas" },
  { code: "060600000", name: "Antique", islandGroup: "Visayas" },
  { code: "087800000", name: "Biliran", islandGroup: "Visayas" },
  { code: "071200000", name: "Bohol", islandGroup: "Visayas" },
  { code: "061900000", name: "Capiz", islandGroup: "Visayas" },
  { code: "072200000", name: "Cebu", islandGroup: "Visayas" },
  { code: "082600000", name: "Eastern Samar", islandGroup: "Visayas" },
  { code: "067900000", name: "Guimaras", islandGroup: "Visayas" },
  { code: "063000000", name: "Iloilo", islandGroup: "Visayas" },
  { code: "083700000", name: "Leyte", islandGroup: "Visayas" },
  { code: "064500000", name: "Negros Occidental", islandGroup: "Visayas" },
  { code: "074600000", name: "Negros Oriental", islandGroup: "Visayas" },
  { code: "084800000", name: "Northern Samar", islandGroup: "Visayas" },
  { code: "086000000", name: "Samar (Western Samar)", islandGroup: "Visayas" },
  { code: "076100000", name: "Siquijor", islandGroup: "Visayas" },
  { code: "086400000", name: "Southern Leyte", islandGroup: "Visayas" },

  // --- MINDANAO (28) ---
  { code: "160200000", name: "Agusan del Norte", islandGroup: "Mindanao" },
  { code: "160300000", name: "Agusan del Sur", islandGroup: "Mindanao" },
  { code: "190700000", name: "Basilan", islandGroup: "Mindanao" },
  { code: "101300000", name: "Bukidnon", islandGroup: "Mindanao" },
  { code: "101800000", name: "Camiguin", islandGroup: "Mindanao" },
  { code: "124700000", name: "Cotabato (North Cotabato)", islandGroup: "Mindanao" },
  { code: "118200000", name: "Davao de Oro (Compostela Valley)", islandGroup: "Mindanao" },
  { code: "112300000", name: "Davao del Norte", islandGroup: "Mindanao" },
  { code: "112400000", name: "Davao del Sur", islandGroup: "Mindanao" },
  { code: "118600000", name: "Davao Occidental", islandGroup: "Mindanao" },
  { code: "112500000", name: "Davao Oriental", islandGroup: "Mindanao" },
  { code: "168500000", name: "Dinagat Islands", islandGroup: "Mindanao" },
  { code: "103500000", name: "Lanao del Norte", islandGroup: "Mindanao" },
  { code: "193600000", name: "Lanao del Sur", islandGroup: "Mindanao" },
  { code: "198700000", name: "Maguindanao del Norte", islandGroup: "Mindanao" },
  { code: "198800000", name: "Maguindanao del Sur", islandGroup: "Mindanao" },
  { code: "104200000", name: "Misamis Occidental", islandGroup: "Mindanao" },
  { code: "104300000", name: "Misamis Oriental", islandGroup: "Mindanao" },
  { code: "128000000", name: "Sarangani", islandGroup: "Mindanao" },
  { code: "126300000", name: "South Cotabato", islandGroup: "Mindanao" },
  { code: "126500000", name: "Sultan Kudarat", islandGroup: "Mindanao" },
  { code: "193700000", name: "Sulu", islandGroup: "Mindanao" },
  { code: "166700000", name: "Surigao del Norte", islandGroup: "Mindanao" },
  { code: "166800000", name: "Surigao del Sur", islandGroup: "Mindanao" },
  { code: "197000000", name: "Tawi-Tawi", islandGroup: "Mindanao" },
  { code: "097200000", name: "Zamboanga del Norte", islandGroup: "Mindanao" },
  { code: "097300000", name: "Zamboanga del Sur", islandGroup: "Mindanao" },
  { code: "098300000", name: "Zamboanga Sibugay", islandGroup: "Mindanao" }
];

const getIslandGroup = (name: string, code?: string): IslandGroup => {
  const match = ALL_PHILIPPINE_PROVINCES.find(
    (p) => (code && p.code === code) || p.name.toLowerCase() === name.toLowerCase()
  );
  if (match?.islandGroup) return match.islandGroup;
  const n = name.toLowerCase();
  if (
    n.includes("davao") ||
    n.includes("zamboanga") ||
    n.includes("cotabato") ||
    n.includes("agusan") ||
    n.includes("surigao") ||
    n.includes("lanao") ||
    n.includes("misamis") ||
    n.includes("bukidnon") ||
    n.includes("basilan") ||
    n.includes("sulu") ||
    n.includes("tawi")
  ) {
    return "Mindanao";
  }
  if (
    n.includes("cebu") ||
    n.includes("bohol") ||
    n.includes("leyte") ||
    n.includes("samar") ||
    n.includes("negros") ||
    n.includes("iloilo") ||
    n.includes("aklan") ||
    n.includes("antique") ||
    n.includes("capiz") ||
    n.includes("guimaras") ||
    n.includes("siquijor") ||
    n.includes("biliran")
  ) {
    return "Visayas";
  }
  return "Luzon";
};

// =========================================================================
// ZERO-LATENCY FALLBACK DATA FOR DAET, CAMARINES NORTE & METRO MANILA
// =========================================================================
const DEFAULT_PROVINCE_CODE = "051600000"; // Camarines Norte
const DEFAULT_PROVINCE_NAME = "Camarines Norte";
const DEFAULT_CITY_CODE = "051603000"; // Daet
const DEFAULT_CITY_NAME = "Daet";
const NCR_REGION_CODE = "130000000";

const METRO_MANILA_CITIES: PSGCItem[] = [
  { code: "133900000", name: "City of Manila", provinceCode: NCR_REGION_CODE },
  { code: "137404000", name: "Quezon City", provinceCode: NCR_REGION_CODE },
  { code: "137603000", name: "Makati", provinceCode: NCR_REGION_CODE },
  { code: "137612000", name: "Taguig", provinceCode: NCR_REGION_CODE },
  { code: "137403000", name: "Pasig", provinceCode: NCR_REGION_CODE },
  { code: "137605000", name: "Mandaluyong", provinceCode: NCR_REGION_CODE },
  { code: "137601000", name: "Caloocan", provinceCode: NCR_REGION_CODE },
  { code: "137602000", name: "Las Piñas", provinceCode: NCR_REGION_CODE },
  { code: "137604000", name: "Malabon", provinceCode: NCR_REGION_CODE },
  { code: "137606000", name: "Marikina", provinceCode: NCR_REGION_CODE },
  { code: "137607000", name: "Muntinlupa", provinceCode: NCR_REGION_CODE },
  { code: "137608000", name: "Navotas", provinceCode: NCR_REGION_CODE },
  { code: "137609000", name: "Parañaque", provinceCode: NCR_REGION_CODE },
  { code: "137610000", name: "Pasay", provinceCode: NCR_REGION_CODE },
  { code: "137611000", name: "Pateros", provinceCode: NCR_REGION_CODE },
  { code: "137405000", name: "San Juan", provinceCode: NCR_REGION_CODE },
  { code: "137504000", name: "Valenzuela", provinceCode: NCR_REGION_CODE }
];

const CAMARINES_NORTE_MUNICIPALITIES: PSGCItem[] = [
  { code: "051601000", name: "Basud", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051602000", name: "Capalonga", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051603000", name: "Daet", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051604000", name: "Jose Panganiban", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051605000", name: "Labo", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051606000", name: "Mercedes", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051607000", name: "Paracale", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051608000", name: "San Lorenzo Ruiz", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051609000", name: "San Vicente", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051610000", name: "Santa Elena", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051611000", name: "Talisay", provinceCode: DEFAULT_PROVINCE_CODE },
  { code: "051612000", name: "Vinzons", provinceCode: DEFAULT_PROVINCE_CODE }
];

const DAET_BARANGAYS: PSGCItem[] = [
  { code: "051603001", name: "Alawihao" },
  { code: "051603002", name: "Awitan" },
  { code: "051603003", name: "Bagasbas" },
  { code: "051603004", name: "Bagang" },
  { code: "051603005", name: "Barangay I (Ilaod)" },
  { code: "051603006", name: "Barangay II (Pasig)" },
  { code: "051603007", name: "Barangay III (Iraya)" },
  { code: "051603008", name: "Barangay IV" },
  { code: "051603009", name: "Barangay V" },
  { code: "051603010", name: "Barangay VI" },
  { code: "051603011", name: "Barangay VII" },
  { code: "051603012", name: "Barangay VIII" },
  { code: "051603013", name: "Bibirao" },
  { code: "051603014", name: "Borabod" },
  { code: "051603015", name: "Calasgasan" },
  { code: "051603016", name: "Camambugan" },
  { code: "051603017", name: "Cobangbang" },
  { code: "051603018", name: "Dogongan" },
  { code: "051603019", name: "Gahonon" },
  { code: "051603020", name: "Gubat" },
  { code: "051603021", name: "Lag-on" },
  { code: "051603022", name: "Magang" },
  { code: "051603023", name: "Mambalite" },
  { code: "051603024", name: "Mancruz" },
  { code: "051603025", name: "Pamorangon" },
  { code: "051603026", name: "San Isidro" }
];

// In-memory global cache across component mounts
const memoryCache: {
  rawDatasetLoaded: boolean;
  provinces: PSGCItem[];
  citiesByProvince: Record<string, PSGCItem[]>;
  barangaysByCity: Record<string, PSGCItem[]>;
} = {
  rawDatasetLoaded: false,
  provinces: ALL_PHILIPPINE_PROVINCES,
  citiesByProvince: {
    [DEFAULT_PROVINCE_CODE]: CAMARINES_NORTE_MUNICIPALITIES,
    [DEFAULT_PROVINCE_NAME.toLowerCase()]: CAMARINES_NORTE_MUNICIPALITIES,
    [NCR_REGION_CODE]: METRO_MANILA_CITIES,
    "metro manila": METRO_MANILA_CITIES
  },
  barangaysByCity: {
    [DEFAULT_CITY_CODE]: DAET_BARANGAYS,
    [DEFAULT_CITY_NAME.toLowerCase()]: DAET_BARANGAYS
  }
};

// =========================================================================
// FLORES-JACOB PHILIPPINE PSGC MASTER DATASET ENGINE
// =========================================================================
const FLORES_JACOB_CDN_URL =
  "https://cdn.jsdelivr.net/gh/flores-jacob/philippine-regions-provinces-cities-municipalities-barangays@master/philippine_provinces_cities_municipalities_and_barangays_2019v2.json";
const FLORES_JACOB_RAW_URL =
  "https://raw.githubusercontent.com/flores-jacob/philippine-regions-provinces-cities-municipalities-barangays/master/philippine_provinces_cities_municipalities_and_barangays_2019v2.json";

async function loadFloresJacobDataset(): Promise<boolean> {
  if (memoryCache.rawDatasetLoaded) return true;

  const urls = [FLORES_JACOB_CDN_URL, FLORES_JACOB_RAW_URL];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data || typeof data !== "object") continue;

      const provinceList: PSGCItem[] = [];
      const provinceSet = new Set<string>();

      // Iterate all regions in the flores-jacob dataset
      Object.keys(data).forEach((regionKey) => {
        const regionObj = data[regionKey];
        if (!regionObj || !regionObj.province_list) return;

        const pList = regionObj.province_list;
        Object.keys(pList).forEach((rawProvName) => {
          const provTitle = toTitleCase(rawProvName);
          const provObj = pList[rawProvName];
          if (!provObj) return;

          const provKey = provTitle.toLowerCase();
          if (!provinceSet.has(provKey)) {
            provinceSet.add(provKey);
            provinceList.push({
              code: rawProvName,
              name: provTitle,
              islandGroup: getIslandGroup(provTitle)
            });
          }

          // Build cities/municipalities for this province
          const munList = provObj.municipality_list;
          if (munList) {
            const cityItems: PSGCItem[] = Object.keys(munList).map((rawMunName) => {
              const munTitle = toTitleCase(rawMunName);
              const munObj = munList[rawMunName];
              const munKey = `${provKey}_${munTitle.toLowerCase()}`;

              // Build barangays for this municipality
              if (munObj && Array.isArray(munObj.barangay_list)) {
                const bgyItems: PSGCItem[] = munObj.barangay_list.map((rawBgyName: string, bIdx: number) => ({
                  code: `${rawMunName}_${bIdx}`,
                  name: toTitleCase(rawBgyName)
                }));
                memoryCache.barangaysByCity[munKey] = bgyItems;
                memoryCache.barangaysByCity[munTitle.toLowerCase()] = bgyItems;
                memoryCache.barangaysByCity[rawMunName] = bgyItems;
              }

              return {
                code: rawMunName,
                name: munTitle,
                provinceCode: rawProvName
              };
            });

            cityItems.sort((a, b) => a.name.localeCompare(b.name));
            memoryCache.citiesByProvince[rawProvName] = cityItems;
            memoryCache.citiesByProvince[provKey] = cityItems;
          }
        });
      });

      // Include Metro Manila if present or ensure NCR entries
      if (!provinceSet.has("metro manila (ncr)") && !provinceSet.has("metro manila")) {
        provinceList.push({
          code: NCR_REGION_CODE,
          name: "Metro Manila (NCR)",
          islandGroup: "Luzon"
        });
      }

      provinceList.sort((a, b) => a.name.localeCompare(b.name));
      memoryCache.provinces = provinceList;
      memoryCache.rawDatasetLoaded = true;
      return true;
    } catch {
      // Try next mirror
    }
  }

  return false;
}

// =========================================================================
// REUSABLE SEARCHABLE SELECT DROPDOWN COMPONENT (WITH PORTAL & FILTER)
// =========================================================================
interface SearchableSelectProps {
  label: string;
  items: PSGCItem[];
  selectedCode?: string;
  selectedName?: string;
  onSelect: (item: PSGCItem) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  emptyNotice?: string;
  icon?: React.ReactNode;
  showIslandTabs?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  items,
  selectedCode,
  selectedName,
  onSelect,
  placeholder = "-- Select --",
  searchPlaceholder = "Type to search...",
  disabled = false,
  loading = false,
  required = false,
  emptyNotice = "No options available",
  icon,
  showIslandTabs = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIslandFilter, setActiveIslandFilter] = useState<"All" | IslandGroup>("All");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(() => {
    if (selectedCode) {
      const byCode = items.find((i) => i.code === selectedCode);
      if (byCode) return byCode;
    }
    if (selectedName) {
      return items.find((i) => i.name.toLowerCase() === selectedName.toLowerCase());
    }
    return null;
  }, [items, selectedCode, selectedName]);

  const displayText = selectedItem ? selectedItem.name : selectedName || "";

  const filteredItems = useMemo(() => {
    let result = items;

    if (showIslandTabs && activeIslandFilter !== "All") {
      result = result.filter((item) => item.islandGroup === activeIslandFilter);
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();

    return result.filter((item) => {
      const name = item.name.toLowerCase();
      const group = item.islandGroup ? item.islandGroup.toLowerCase() : "";
      if (q === "manila" && name.includes("metro manila")) return true;
      if (group && group.includes(q)) return true;
      return name.includes(q);
    });
  }, [items, searchQuery, activeIslandFilter, showIslandTabs]);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = Math.max(rect.width, 270);
      const popoverHeight = showIslandTabs ? 330 : 280;

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

  const handleOpen = () => {
    if (disabled || loading) return;
    setSearchQuery("");
    setActiveIslandFilter("All");
    updatePosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      const handleScrollOrResize = () => {
        updatePosition();
      };

      const handleClickOutside = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
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
        clearTimeout(timer);
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize, true);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen]);

  const handleSelectItem = (item: PSGCItem) => {
    onSelect(item);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative">
      <label className="block font-bold text-[11px] text-indigo-950 mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1">
          {icon}
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
        </span>
        {loading && (
          <span className="text-[9px] text-amber-600 font-semibold flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Loading...</span>
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        onClick={handleOpen}
        className={`w-full bg-white px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 shadow-2xs text-xs font-bold transition-all ${
          disabled
            ? "opacity-60 bg-gray-100 cursor-not-allowed border-gray-200 text-charcoal/40"
            : isOpen
            ? "border-indigo ring-2 ring-indigo-100 text-indigo-950 bg-indigo-50/20"
            : displayText
            ? "border-indigo-200/90 text-indigo-950 hover:border-indigo-400"
            : "border-indigo-200/80 text-charcoal/50 hover:border-indigo-400"
        }`}
      >
        <span className="truncate">{displayText || placeholder}</span>
        <div className="flex items-center gap-1 shrink-0 text-charcoal/40">
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo" : ""
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: showIslandTabs ? "340px" : "300px"
            }}
            className="z-[120] bg-white rounded-2xl shadow-2xl border border-indigo-200 p-2.5 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-indigo-900/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-indigo-50/40 pl-8 pr-7 py-1.5 rounded-xl border border-indigo-100 text-xs font-semibold text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-indigo focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-charcoal/40 hover:text-charcoal absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Island Group Filter Tabs */}
            {showIslandTabs && (
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-gray-100 rounded-lg text-[10px] font-bold text-charcoal/70">
                {(["All", "Luzon", "Visayas", "Mindanao"] as const).map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setActiveIslandFilter(group)}
                    className={`py-1 rounded-md transition-colors text-center cursor-pointer ${
                      activeIslandFilter === group
                        ? "bg-white text-indigo-950 font-black shadow-2xs"
                        : "hover:text-charcoal hover:bg-gray-200/60"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            )}

            {/* Item Count / Scope Bar */}
            <div className="px-1 flex items-center justify-between text-[10px] text-charcoal/50 font-bold border-b border-gray-100 pb-1">
              <span>{label}</span>
              <span>
                {filteredItems.length} {filteredItems.length === 1 ? "option" : "options"}
              </span>
            </div>

            {/* Scrollable Results List */}
            <div className="overflow-y-auto max-h-[185px] space-y-0.5 pr-0.5 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="py-6 px-3 text-center space-y-2">
                  <p className="text-xs text-charcoal/60 font-medium">
                    {searchQuery ? `No match for "${searchQuery}"` : emptyNotice}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setActiveIslandFilter("All");
                      }}
                      className="text-[11px] font-bold text-indigo hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected =
                    (selectedCode && item.code === selectedCode) ||
                    (displayText && item.name.toLowerCase() === displayText.toLowerCase());

                  return (
                    <button
                      key={`${item.code}_${item.name}`}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo text-white font-bold shadow-2xs"
                          : "hover:bg-indigo-50/80 text-charcoal font-medium hover:text-indigo-950"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{item.name}</span>
                        {item.islandGroup && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-black tracking-wide shrink-0 ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : item.islandGroup === "Luzon"
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : item.islandGroup === "Visayas"
                                ? "bg-amber-50 text-amber-800 border border-amber-100"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            }`}
                          >
                            {item.islandGroup}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
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
// MAIN PHILIPPINE ADDRESS PICKER WITH FLORES-JACOB DATASET + OFFLINE
// =========================================================================
export const AddressPicker: React.FC<AddressPickerProps> = ({
  label = "Present Address",
  value,
  onChange,
  required = false,
  className = ""
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isManualMode, setIsManualMode] = useState(!navigator.onLine);
  const [autoOfflineSwitched, setAutoOfflineSwitched] = useState(!navigator.onLine);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Address state parts
  const [provinces, setProvinces] = useState<PSGCItem[]>(memoryCache.provinces);
  const [selectedProvince, setSelectedProvince] = useState<PSGCItem>({
    code: DEFAULT_PROVINCE_CODE,
    name: DEFAULT_PROVINCE_NAME,
    islandGroup: "Luzon"
  });

  const [cities, setCities] = useState<PSGCItem[]>(CAMARINES_NORTE_MUNICIPALITIES);
  const [selectedCity, setSelectedCity] = useState<PSGCItem>({
    code: DEFAULT_CITY_CODE,
    name: DEFAULT_CITY_NAME
  });

  const [barangays, setBarangays] = useState<PSGCItem[]>(DAET_BARANGAYS);
  const [selectedBarangay, setSelectedBarangay] = useState<string>("");
  const [streetDetails, setStreetDetails] = useState<string>("");

  const isInitialMount = useRef(true);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsManualMode(true);
      setAutoOfflineSwitched(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch flores-jacob Philippine PSGC Master Dataset on mount
  useEffect(() => {
    let mounted = true;

    const initDataset = async () => {
      if (!navigator.onLine) {
        if (mounted) setProvinces(ALL_PHILIPPINE_PROVINCES);
        return;
      }

      try {
        setLoadingProvinces(true);
        const loaded = await loadFloresJacobDataset();
        if (loaded && mounted) {
          setProvinces(memoryCache.provinces);
          const camNorte = memoryCache.provinces.find((p) => p.name.toLowerCase().includes("camarines norte"));
          if (camNorte) {
            setSelectedProvince(camNorte);
          }
        }
      } catch (err) {
        console.warn("Could not load flores-jacob PSGC dataset, using bundled master provinces:", err);
        if (mounted) setProvinces(ALL_PHILIPPINE_PROVINCES);
      } finally {
        if (mounted) setLoadingProvinces(false);
      }
    };

    initDataset();
    return () => {
      mounted = false;
    };
  }, []);

  // When Province Changes: Load its Municipalities / Cities instantly from memoryCache
  const handleProvinceChange = (provCode: string, provName?: string) => {
    const pName = provName || provCode;
    const provObj = provinces.find((p) => p.code === provCode || p.name.toLowerCase() === pName.toLowerCase()) || {
      code: provCode,
      name: toTitleCase(pName),
      islandGroup: getIslandGroup(pName, provCode)
    };

    setSelectedProvince(provObj);
    setSelectedBarangay("");

    const provKey = provObj.name.toLowerCase();
    const rawKey = provObj.code;

    // Look up in memory cache (flores-jacob parsed tree)
    const cachedCities =
      memoryCache.citiesByProvince[rawKey] ||
      memoryCache.citiesByProvince[provKey] ||
      (provKey.includes("camarines norte") ? CAMARINES_NORTE_MUNICIPALITIES : null) ||
      (provKey.includes("metro manila") || provKey.includes("ncr") ? METRO_MANILA_CITIES : null);

    if (cachedCities && cachedCities.length > 0) {
      setCities(cachedCities);
      setSelectedCity(cachedCities[0]);
      loadBarangaysForCity(cachedCities[0].code, cachedCities[0].name, provObj.name);
    } else {
      setCities([]);
      setSelectedCity({ code: "", name: "" });
      setBarangays([]);
    }
  };

  // When City / Municipality Changes: Load its Barangays instantly from memoryCache
  const loadBarangaysForCity = (cityCode: string, cityName?: string, provName?: string) => {
    if (!cityCode && !cityName) {
      setBarangays([]);
      return;
    }

    const cName = (cityName || cityCode).toLowerCase();
    const pName = (provName || selectedProvince.name || "").toLowerCase();
    const combinedKey = `${pName}_${cName}`;

    const cachedBarangays =
      memoryCache.barangaysByCity[combinedKey] ||
      memoryCache.barangaysByCity[cityCode] ||
      memoryCache.barangaysByCity[cName] ||
      (cName === "daet" ? DAET_BARANGAYS : null);

    if (cachedBarangays && cachedBarangays.length > 0) {
      setBarangays(cachedBarangays);
    } else {
      setBarangays([]);
    }
  };

  const handleCityChange = (cityCode: string, cityName?: string) => {
    const city = cities.find((c) => c.code === cityCode || c.name === cityName) || {
      code: cityCode,
      name: cityName || cityCode
    };
    setSelectedCity(city);
    setSelectedBarangay("");
    loadBarangaysForCity(cityCode, city.name, selectedProvince.name);
  };

  // Synchronize combined address string to parent form
  useEffect(() => {
    if (isManualMode) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (value && value.trim()) {
        const lower = value.toLowerCase();
        const matchedBgy = DAET_BARANGAYS.find((b) => lower.includes(b.name.toLowerCase()));
        if (matchedBgy) {
          setSelectedBarangay(matchedBgy.name);
          const parts = value.split(new RegExp(`(?:brgy\\.?|barangay)?\\s*${matchedBgy.name}`, "i"));
          if (parts[0] && parts[0].trim()) {
            setStreetDetails(parts[0].replace(/,\s*$/, "").trim());
          }
        }
      }
      return;
    }

    const parts: string[] = [];
    if (streetDetails.trim()) {
      parts.push(streetDetails.trim());
    }
    if (selectedBarangay.trim()) {
      parts.push(`Brgy. ${selectedBarangay.trim()}`);
    }
    if (selectedCity.name) {
      parts.push(selectedCity.name);
    }
    if (selectedProvince.name) {
      parts.push(selectedProvince.name);
    }

    const compiled = parts.join(", ");
    if (compiled) {
      onChange(compiled);
    }
  }, [streetDetails, selectedBarangay, selectedCity, selectedProvince, isManualMode]);

  // Toggle between Dropdown Mode and Manual Freeform Mode
  const handleToggleManualMode = (targetMode: boolean) => {
    setIsManualMode(targetMode);
    setAutoOfflineSwitched(false);
    if (targetMode && !value) {
      const parts: string[] = [];
      if (streetDetails.trim()) parts.push(streetDetails.trim());
      if (selectedBarangay.trim()) parts.push(`Brgy. ${selectedBarangay.trim()}`);
      if (selectedCity.name) parts.push(selectedCity.name);
      if (selectedProvince.name) parts.push(selectedProvince.name);
      const compiled = parts.join(", ");
      if (compiled) onChange(compiled);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Label & Network / Mode Status Header */}
      <div className="flex items-center justify-between">
        <label className="block font-bold text-xs text-charcoal/80 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {!isOnline && (
            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold flex items-center gap-1 border border-amber-200">
              <WifiOff className="w-2.5 h-2.5 text-amber-700" />
              <span>Offline</span>
            </span>
          )}
        </label>

        {/* 1-Click Manual / Dropdown Switch */}
        <button
          type="button"
          onClick={() => handleToggleManualMode(!isManualMode)}
          className={`text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all px-2.5 py-1 rounded-xl shadow-2xs border ${
            isManualMode
              ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-200"
              : "bg-white hover:bg-gray-50 text-indigo-800 border-indigo-200/80 hover:border-indigo-300"
          }`}
        >
          {isManualMode ? (
            <>
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Switch to Dropdown Selector</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Type Manually</span>
            </>
          )}
        </button>
      </div>

      {/* Automatic Offline Notification Banner */}
      {autoOfflineSwitched && !isOnline && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-[11px] text-amber-950 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">
              <strong>No Wi-Fi detected:</strong> Switched to <strong>Manual Address Mode</strong> so you can type any location immediately.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleToggleManualMode(false)}
            className="text-[10px] text-indigo-900 font-bold underline hover:text-indigo-950 cursor-pointer ml-2 shrink-0"
          >
            Use Offline Dropdowns (Daet)
          </button>
        </div>
      )}

      {isManualMode ? (
        /* Manual Freeform Input Card */
        <div className="p-3.5 bg-gradient-to-br from-amber-50/40 via-white to-ivory-light rounded-2xl border border-amber-200/90 shadow-2xs space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Manual Address Input Mode</span>
            </span>
            <span className="text-[10px] text-charcoal/50 font-medium">
              Type full address, sitios, puroks, or landmarks
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              required={required}
              placeholder="e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-white p-2.5 pr-8 rounded-xl border border-amber-300/80 focus:outline-none focus:border-indigo text-xs font-semibold text-charcoal shadow-2xs placeholder:text-charcoal/40"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="p-1 text-charcoal/40 hover:text-charcoal absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Presets for Convenient Offline Typing */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-100 flex-wrap text-[10px]">
            <span className="text-charcoal/50 font-bold">Quick Presets:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onChange(value ? `${value}, Daet, Camarines Norte` : "Daet, Camarines Norte")}
                className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100/70 border border-amber-200 font-bold text-amber-950 transition-colors cursor-pointer"
              >
                + Daet, Cam Norte
              </button>
              <button
                type="button"
                onClick={() => onChange(value ? `${value}, Metro Manila` : "Metro Manila")}
                className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100/70 border border-indigo-200 font-bold text-indigo-950 transition-colors cursor-pointer"
              >
                + Metro Manila
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Standardized Cascading Philippine Address Dropdown Selector with Search */
        <div className="p-3 bg-gradient-to-br from-indigo-50/40 via-ivory-light to-amber-50/30 rounded-2xl border border-indigo-100/90 shadow-2xs space-y-2.5">
          {/* Row 1: Searchable Province & City/Municipality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* 1. Searchable Province Dropdown with Luzon / Visayas / Mindanao tabs */}
            <SearchableSelect
              label="Province / Region"
              required={required}
              items={provinces}
              selectedCode={selectedProvince.code}
              selectedName={selectedProvince.name}
              onSelect={(item) => handleProvinceChange(item.code, item.name)}
              placeholder="-- Select Province / Region --"
              searchPlaceholder="Search all provinces (Luzon, Visayas, Mindanao)..."
              loading={loadingProvinces}
              showIslandTabs={true}
              icon={<Compass className="w-3 h-3 text-indigo-700" />}
            />

            {/* 2. Searchable City / Municipality Dropdown */}
            <SearchableSelect
              label="City / Municipality"
              required={required}
              items={cities}
              selectedCode={selectedCity.code}
              selectedName={selectedCity.name}
              onSelect={(item) => handleCityChange(item.code, item.name)}
              placeholder="-- Select City / Municipality --"
              searchPlaceholder="Search city/municipality..."
              disabled={loadingCities || cities.length === 0}
              loading={loadingCities}
            />
          </div>

          {/* Row 2: Searchable Barangay Dropdown & Street / Subdivision */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* 3. Searchable Barangay Dropdown */}
            <SearchableSelect
              label="Barangay"
              required={required}
              items={barangays}
              selectedName={selectedBarangay}
              onSelect={(item) => setSelectedBarangay(item.name)}
              placeholder="-- Select Barangay --"
              searchPlaceholder="Search barangay (e.g. Bagang, Bagasbas, Lag-on)..."
              disabled={loadingBarangays || barangays.length === 0}
              loading={loadingBarangays}
            />

            {/* 4. Street / Building / House / Subdivision Details */}
            <div>
              <label className="block font-bold text-[11px] text-indigo-950 mb-1">
                Street / Subdivision / House No.
              </label>
              <input
                type="text"
                placeholder="e.g. Phase 3, Happy Homes / P. Burgos St."
                value={streetDetails}
                onChange={(e) => setStreetDetails(e.target.value)}
                className="w-full bg-white px-3 py-2 rounded-xl border border-indigo-200/80 text-xs font-medium text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-indigo shadow-2xs"
              />
            </div>
          </div>

          {/* Real-time Compiled Address Preview Chip */}
          {value && (
            <div className="p-2 rounded-xl bg-white/95 border border-indigo-100/90 flex items-start gap-2 text-[11px] shadow-2xs">
              <span className="font-bold text-indigo-900 shrink-0 text-[10px] uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mt-0.5 flex items-center gap-1">
                <Navigation className="w-2.5 h-2.5 text-indigo-600" />
                <span>Full Address:</span>
              </span>
              <span className="font-bold text-indigo-950 truncate flex-1">{value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddressPicker;
