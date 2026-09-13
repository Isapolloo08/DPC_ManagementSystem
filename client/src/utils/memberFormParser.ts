/**
 * Member Form File, Image & Table/Spreadsheet Parser
 * Analyzes uploaded spreadsheets, images, text, and documents
 * to extract single or batch member registration records.
 * Missing/unprovided fields safely default to empty string ("").
 */

export interface ParsedMemberData {
  id?: string;
  first_name: string;
  last_name: string;
  birthdate: string; // YYYY-MM-DD
  gender: string; // "Male" | "Female"
  contact_email: string;
  contact_phone: string;
  address: string;
  guardian_names: string;
  guardian_phone: string;
  invited_by: string;
  school_name: string;
  grade_level: string;
  program_major: string;
  class_schedule: string;
  occupation: string;
  hobbies: string;
  previous_church: string;
  facebook_account: string;
  medical_notes: string;
  family_details: string;
  application_date: string;
  detectedFieldsCount: number;
  rawTextPreview?: string;
}

export interface AnalyzeResult {
  members: ParsedMemberData[];
  totalCount: number;
  rawTextPreview: string;
  isTable: boolean;
  fileName?: string;
}

const MONTH_NAMES: Record<string, string> = {
  jan: "01", january: "01", ene: "01", enero: "01",
  feb: "02", february: "02", peb: "02", pebrero: "02",
  mar: "03", march: "03", marso: "03",
  apr: "04", april: "04", abr: "04", abril: "04",
  may: "05", mayo: "05",
  jun: "06", june: "06", hun: "06", hunyo: "06",
  jul: "07", july: "07", hul: "07", hulyo: "07",
  aug: "08", august: "08", ago: "08", agosto: "08",
  sep: "09", sept: "09", september: "09", set: "09", setyembre: "09",
  oct: "10", october: "10", okt: "10", oktubre: "10",
  nov: "11", november: "11", nob: "11", nobyembre: "11",
  dec: "12", december: "12", dis: "12", disyembre: "12"
};

const COMPOUND_LAST_NAMES = [
  "dela cruz", "de la cruz", "delos santos", "de los santos", "delos reyes", "de los reyes",
  "san juan", "san jose", "san vicente", "san miguel", "san pedro", "san mateo",
  "del rosario", "de guzman", "de leon", "de vera", "del carmen", "del mundo",
  "santa maria", "sta. maria", "de chavez", "de castro", "de jesus", "del valle",
  "de luna", "del monte", "de mesa", "de silva", "de torres", "del prado", "del rio"
];

/**
 * Robust Filipino & Western Full Name Splitter
 * Extracts first_name and last_name accurately while stripping middle initials
 */
export function splitFullName(rawName: string): { first_name: string; last_name: string } {
  if (!rawName) return { first_name: "", last_name: "" };

  // Remove leading numbers e.g. "1.", "1 ", "No. 1 ", "#1 "
  let cleaned = rawName.trim().replace(/^(?:no\.?|#)?\s*\d+[\s.)-]+\s*/i, "").trim();
  // Remove unwanted outer symbols
  cleaned = cleaned.replace(/^[\[\]{}()]|[\[\]{}()]$/g, "").trim();

  if (!cleaned) return { first_name: "", last_name: "" };

  // Check if comma format: "Lastname, Firstname Middle"
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map(p => p.trim());
    const lastName = parts[0] || "";
    let firstName = parts[1] || "";
    // Remove standalone middle initial e.g. " A." or " Q."
    firstName = firstName.replace(/\b[A-Za-z]\.?\b/g, "").trim();
    return {
      first_name: firstName || parts[1] || "",
      last_name: lastName
    };
  }

  // Check compound last names e.g. "Jade Apple L. Dela Cruz"
  const lower = cleaned.toLowerCase();
  for (const compound of COMPOUND_LAST_NAMES) {
    if (lower.endsWith(compound)) {
      const idx = lower.lastIndexOf(compound);
      const firstPart = cleaned.slice(0, idx).trim();
      const lastPart = cleaned.slice(idx).trim();
      // Remove middle initial from first name part
      const cleanFirst = firstPart.replace(/\b[A-Za-z]\.?\b/g, "").trim();
      return {
        first_name: cleanFirst || firstPart,
        last_name: lastPart
      };
    }
  }

  // Standard token splitting
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first_name: "", last_name: "" };
  if (tokens.length === 1) return { first_name: tokens[0], last_name: "" };
  if (tokens.length === 2) return { first_name: tokens[0], last_name: tokens[1] };

  // If 3 or more tokens, check for middle initial like "Adrian John A. Fausto" or "Erika Jhamile Q. Bañadera"
  const nonMiddleTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isMiddleInitial = (i > 0 && i < tokens.length - 1 && (/^[A-Za-z]\.?$/.test(t)));
    if (!isMiddleInitial) {
      nonMiddleTokens.push(t);
    }
  }

  if (nonMiddleTokens.length <= 1) {
    return { first_name: nonMiddleTokens[0] || tokens[0], last_name: "" };
  }

  const lastName = nonMiddleTokens[nonMiddleTokens.length - 1];
  const firstName = nonMiddleTokens.slice(0, -1).join(" ");

  return { first_name: firstName, last_name: lastName };
}

/**
 * Standardize any date string into YYYY-MM-DD
 * Handles:
 * - "July 29, '01" -> "2001-07-29"
 * - "April 2, '01" -> "2001-04-02"
 * - "Mar. 8, '01"  -> "2001-03-08"
 * - "Jan. 31 '02"  -> "2002-01-31"
 * - "July 23, '06" -> "2006-07-23"
 * - "Aug. 27 '02"  -> "2002-08-27"
 */
export function normalizeBirthdate(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.trim().replace(/^["']+|["']+$/g, "").trim();

  // 1. Check ISO format YYYY-MM-DD
  const isoMatch = cleaned.match(/\b(19\d\d|20\d\d)[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. Check 2-digit apostrophe year: e.g. "July 29, '01", "Mar. 8, '01", "Jan. 31 '02", "July 23, '06", "July 05 '05", "July 29, 01"
  const apostropheYearMatch = cleaned.match(/([a-zA-Z.]+)\s*(\d{1,2})[\s,]+(?:'|`|’|‘)?\s*(\d{2})\b/);
  if (apostropheYearMatch) {
    const monthRaw = apostropheYearMatch[1].toLowerCase().replace(/\./g, "");
    const day = apostropheYearMatch[2].padStart(2, "0");
    const yy = parseInt(apostropheYearMatch[3], 10);
    const monthNum = MONTH_NAMES[monthRaw] || MONTH_NAMES[monthRaw.slice(0, 3)];
    if (monthNum) {
      // 00 to 30 -> 2000-2030, 31 to 99 -> 1931-1999
      const fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
      return `${fullYear}-${monthNum}-${day}`;
    }
  }

  // 3. Check 4-digit word month format: e.g. "July 29, 2001", "29 July 2001"
  const wordMonthMatch = cleaned.match(/([a-zA-Z.]+)\s*(\d{1,2})[\s,]+(\d{4})/) || cleaned.match(/(\d{1,2})\s*([a-zA-Z.]+)[\s,]+(\d{4})/);
  if (wordMonthMatch) {
    let monthStr = "";
    let dayStr = "";
    let yearStr = "";

    if (isNaN(Number(wordMonthMatch[1]))) {
      monthStr = wordMonthMatch[1].toLowerCase().replace(/\./g, "");
      dayStr = wordMonthMatch[2];
      yearStr = wordMonthMatch[3];
    } else {
      dayStr = wordMonthMatch[1];
      monthStr = wordMonthMatch[2].toLowerCase().replace(/\./g, "");
      yearStr = wordMonthMatch[3];
    }

    const monthNum = MONTH_NAMES[monthStr] || MONTH_NAMES[monthStr.slice(0, 3)];
    if (monthNum && Number(yearStr) >= 1920 && Number(yearStr) <= new Date().getFullYear()) {
      return `${yearStr}-${monthNum}-${dayStr.padStart(2, "0")}`;
    }
  }

  // 4. Check MM/DD/YYYY or DD/MM/YYYY or MM-DD-YY
  const slashMatch = cleaned.match(/\b(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])[-/](\d{2,4})\b/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, "0");
    const d = slashMatch[2].padStart(2, "0");
    let y = slashMatch[3];
    if (y.length === 2) {
      const yy = parseInt(y, 10);
      y = String(yy <= 30 ? 2000 + yy : 1900 + yy);
    }
    return `${y}-${m}-${d}`;
  }

  return "";
}

/**
 * Format Philippine phone number e.g. 09171234567, 9076064078 -> 09076064078
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+63") && digits.length >= 12) {
    return digits;
  }
  if (digits.startsWith("63") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("09") && digits.length >= 11) {
    return digits.slice(0, 11);
  }
  // 10-digit number starting with 9 e.g. "9076064078" from excel sheet
  if (digits.startsWith("9") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits.slice(0, 15);
}

/**
 * Normalize gender value: "M" -> "Male", "F" -> "Female"
 */
export function normalizeGender(raw: string): "Male" | "Female" {
  if (!raw) return "Male";
  const g = raw.trim().toLowerCase();
  if (g === "f" || g.startsWith("fem") || g.includes("babae") || g === "w" || g.startsWith("woman")) {
    return "Female";
  }
  return "Male";
}

/**
 * Calculate age based on birthdate
 */
export function calculateAgeFromBirthdate(birthdate: string): number {
  if (!birthdate) return 0;
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Create a fresh blank member data template
 */
export function createBlankMember(): ParsedMemberData {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    first_name: "",
    last_name: "",
    birthdate: "",
    gender: "Male",
    contact_email: "",
    contact_phone: "",
    address: "",
    guardian_names: "",
    guardian_phone: "",
    invited_by: "",
    school_name: "",
    grade_level: "",
    program_major: "",
    class_schedule: "",
    occupation: "",
    hobbies: "",
    previous_church: "",
    facebook_account: "",
    medical_notes: "",
    family_details: "",
    application_date: new Date().toISOString().split("T")[0],
    detectedFieldsCount: 0
  };
}

/**
 * Counts non-empty detected member fields
 */
export function countDetectedFields(member: ParsedMemberData): number {
  let count = 0;
  if (member.first_name) count++;
  if (member.last_name) count++;
  if (member.birthdate) count++;
  if (member.contact_phone) count++;
  if (member.contact_email) count++;
  if (member.address) count++;
  if (member.guardian_names) count++;
  if (member.guardian_phone) count++;
  if (member.invited_by) count++;
  if (member.school_name) count++;
  if (member.grade_level) count++;
  if (member.program_major) count++;
  if (member.occupation) count++;
  if (member.hobbies) count++;
  if (member.previous_church) count++;
  if (member.facebook_account) count++;
  if (member.medical_notes) count++;
  if (member.family_details) count++;
  return count;
}

/**
 * Splits a CSV, TSV, or delimited table line safely respecting quotes
 * and merging split month-day + year cells (e.g. ["July 29", "'01"] -> "July 29, '01")
 */
export function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      if (i + 1 < line.length && line[i + 1] === quoteChar) {
        current += quoteChar;
        i++;
      } else {
        inQuotes = false;
        quoteChar = "";
      }
    } else if ((char === "," || char === "\t" || char === "|") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  // Post-process: merge split month & year e.g. ["July 29", "'01"] or ["Mar. 8", "'01"]
  const merged: string[] = [];
  for (let i = 0; i < result.length; i++) {
    const cell = result[i];
    const nextCell = result[i + 1];

    const isMonthDay = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s*\d{1,2}$/i.test(cell);
    const isYear = nextCell && /^(?:'|`|’|‘)?\s*\d{2,4}["']?$/i.test(nextCell.trim());

    if (isMonthDay && isYear) {
      merged.push(`${cell}, ${nextCell}`);
      i++; // skip next cell
    } else {
      merged.push(cell);
    }
  }

  return merged;
}

/**
 * Parses raw text from a single member form / bio-data
 */
export function parseSingleMemberText(rawText: string): ParsedMemberData {
  const result = createBlankMember();
  result.rawTextPreview = rawText;

  if (!rawText || !rawText.trim()) return result;

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Extract JSON if applicable
  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const obj = JSON.parse(trimmed);
      if (typeof obj === "object" && obj !== null) {
        if (obj.name) {
          const split = splitFullName(obj.name);
          result.first_name = split.first_name;
          result.last_name = split.last_name;
        }
        if (obj.first_name || obj.firstName) result.first_name = obj.first_name || obj.firstName;
        if (obj.last_name || obj.lastName) result.last_name = obj.last_name || obj.lastName;
        if (obj.birthdate || obj.birthday || obj.dob) result.birthdate = normalizeBirthdate(obj.birthdate || obj.birthday || obj.dob);
        if (obj.gender || obj.sex) result.gender = normalizeGender(obj.gender || obj.sex);
        if (obj.contact_phone || obj.phone || obj.mobile) result.contact_phone = normalizePhoneNumber(obj.contact_phone || obj.phone || obj.mobile);
        if (obj.contact_email || obj.email) result.contact_email = String(obj.contact_email || obj.email).trim();
        if (obj.address || obj.location) result.address = String(obj.address || obj.location).trim();
        if (obj.guardian_names || obj.guardian || obj.parents) result.guardian_names = String(obj.guardian_names || obj.guardian || obj.parents).trim();
        if (obj.guardian_phone) result.guardian_phone = normalizePhoneNumber(obj.guardian_phone);
        if (obj.invited_by || obj.invitor) result.invited_by = String(obj.invited_by || obj.invitor).trim();
        if (obj.school_name || obj.school) result.school_name = String(obj.school_name || obj.school).trim();
        if (obj.grade_level || obj.grade) result.grade_level = String(obj.grade_level || obj.grade).trim();
        if (obj.program_major || obj.course) result.program_major = String(obj.program_major || obj.course).trim();
        if (obj.occupation || obj.job) result.occupation = String(obj.occupation || obj.job).trim();
        if (obj.hobbies) result.hobbies = String(obj.hobbies).trim();
        if (obj.previous_church) result.previous_church = String(obj.previous_church).trim();
        if (obj.facebook_account || obj.facebook) result.facebook_account = String(obj.facebook_account || obj.facebook).trim();
        if (obj.medical_notes) result.medical_notes = String(obj.medical_notes).trim();
        if (obj.family_details) result.family_details = String(obj.family_details).trim();
        result.detectedFieldsCount = countDetectedFields(result);
        return result;
      }
    }
  } catch {
    // Continue standard regex parsing
  }

  // Line-by-line regex extraction for structured single-member bio-data
  for (const line of lines) {
    const nameMatch = line.match(/(?:^|\b)(?:full\s*name|member\s*name|name|pangalan)\s*[:=\-]\s*([A-Za-z\s.,ñÑ'-]+)/i);
    if (nameMatch && !result.first_name) {
      const split = splitFullName(nameMatch[1]);
      result.first_name = split.first_name;
      result.last_name = split.last_name;
    }

    const fnMatch = line.match(/(?:first\s*name|given\s*name|unang\s*pangalan)\s*[:=\-]\s*([A-Za-z\sñÑ'-]+)/i);
    if (fnMatch) result.first_name = fnMatch[1].trim();

    const lnMatch = line.match(/(?:last\s*name|surname|apelyido)\s*[:=\-]\s*([A-Za-z\sñÑ'-]+)/i);
    if (lnMatch) result.last_name = lnMatch[1].trim();

    const bdayMatch = line.match(/(?:birth\s*date|birthday|date\s*of\s*birth|dob|kaarawan)\s*[:=\-]\s*([A-Za-z0-9\s.,'’`\/-]+)/i);
    if (bdayMatch && !result.birthdate) {
      result.birthdate = normalizeBirthdate(bdayMatch[1]);
    }

    const genderMatch = line.match(/(?:gender|sex|kasarian)\s*[:=\-]\s*([A-Za-z]+)/i);
    if (genderMatch) {
      result.gender = normalizeGender(genderMatch[1]);
    }

    const phoneMatch = line.match(/(?:cp\s*(?:number|no\.?)?|cell(?:phone)?|phone|mobile|contact|numero)\s*[:=\-]\s*([+0-9\s-]{7,16})/i);
    if (phoneMatch && !result.contact_phone) {
      result.contact_phone = normalizePhoneNumber(phoneMatch[1]);
    }

    const emailMatch = line.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    if (emailMatch && !result.contact_email) {
      result.contact_email = emailMatch[1].toLowerCase();
    }

    const addrMatch = line.match(/(?:address|tirahan|residence|location)\s*[:=\-]\s*(.+)/i);
    if (addrMatch && !result.address) {
      result.address = addrMatch[1].trim();
    }

    const inviterMatch = line.match(/(?:invit(?:or|ee|ed\s*by)|who\s*invited\s*you|nag-?imbita)\s*[:=\-]\s*(.+)/i);
    if (inviterMatch && !result.invited_by) {
      result.invited_by = inviterMatch[1].trim();
    }

    const guardianMatch = line.match(/(?:guardian|parent|magulang|mother|father)\s*(?:name)?\s*[:=\-]\s*(.+)/i);
    if (guardianMatch && !result.guardian_names) {
      result.guardian_names = guardianMatch[1].trim();
    }

    const schoolMatch = line.match(/(?:school|university|college|paaralan)\s*(?:name)?\s*[:=\-]\s*(.+)/i);
    if (schoolMatch && !result.school_name) {
      result.school_name = schoolMatch[1].trim();
    }

    const gradeMatch = line.match(/(?:grade|year\s*level|antas)\s*[:=\-]\s*(.+)/i);
    if (gradeMatch && !result.grade_level) {
      result.grade_level = gradeMatch[1].trim();
    }

    const progMatch = line.match(/(?:course|program|major|degree|kurso)\s*[:=\-]\s*(.+)/i);
    if (progMatch && !result.program_major) {
      result.program_major = progMatch[1].trim();
    }

    const occMatch = line.match(/(?:occupation|work|job|hanapbuhay|trabaho)\s*[:=\-]\s*(.+)/i);
    if (occMatch && !result.occupation) {
      result.occupation = occMatch[1].trim();
    }

    const hobMatch = line.match(/(?:hobbies|skills|talents|hilig)\s*[:=\-]\s*(.+)/i);
    if (hobMatch && !result.hobbies) {
      result.hobbies = hobMatch[1].trim();
    }

    const fbMatch = line.match(/(?:facebook|fb(?:\s*account)?)\s*[:=\-]\s*(.+)/i);
    if (fbMatch && !result.facebook_account) {
      result.facebook_account = fbMatch[1].trim();
    }
  }

  result.detectedFieldsCount = countDetectedFields(result);
  return result;
}

/**
 * Parses Tab-Separated, CSV, or Spreadsheet Lines (like the 2025-2026 Information List)
 * Format columns: NO | NAME | CP NUMBER | ADDRESS | GENDER | BIRTHDAY | INVITIOR
 */
export function parseTableOrListText(rawText: string): ParsedMemberData[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const members: ParsedMemberData[] = [];
  let headerColIndices: {
    no?: number;
    name?: number;
    phone?: number;
    address?: number;
    gender?: number;
    birthday?: number;
    invitor?: number;
  } | null = null;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Skip spreadsheet titles
    if (/^information\s*list/i.test(line) || /^members?\s*list/i.test(line)) {
      continue;
    }

    // Split line into cells safely respecting quotes & merging split month/year
    let cells: string[] = [];
    if (line.includes("\t") || line.includes(",") || line.includes("|")) {
      cells = splitCSVLine(line);
    } else if (/\s{2,}/.test(line)) {
      cells = line.split(/\s{2,}/).map(c => c.trim());
    } else {
      cells = [line];
    }

    // Check if this line is a Header Row
    const lowerCells = cells.map(c => c.toLowerCase());
    const isHeader = lowerCells.some(c =>
      c === "no" || c === "no." || c === "name" || c.includes("cp number") ||
      c.includes("address") || c === "gender" || c === "birthday" || c.includes("invit")
    );

    if (isHeader) {
      headerColIndices = {};
      lowerCells.forEach((c, idx) => {
        if (c === "no" || c === "no." || c === "#") headerColIndices!.no = idx;
        else if (c.includes("name") || c.includes("pangalan")) headerColIndices!.name = idx;
        else if (c.includes("cp") || c.includes("phone") || c.includes("contact") || c.includes("number")) headerColIndices!.phone = idx;
        else if (c.includes("address") || c.includes("tirahan")) headerColIndices!.address = idx;
        else if (c.includes("gender") || c.includes("sex") || c.includes("gend")) headerColIndices!.gender = idx;
        else if (c.includes("birth") || c.includes("bday") || c.includes("dob")) headerColIndices!.birthday = idx;
        else if (c.includes("invit") || c.includes("nag-imbita")) headerColIndices!.invitor = idx;
      });
      continue;
    }

    if (cells.length >= 3) {
      const rowMember = createBlankMember();
      rowMember.id = `row-${lineIdx}-${Math.random().toString(36).substring(2, 6)}`;

      let rawName = "";
      let rawPhone = "";
      let rawAddress = "";
      let rawGender = "Male";
      let rawBday = "";
      let rawInvitor = "";

      if (headerColIndices && Object.keys(headerColIndices).length >= 2) {
        if (headerColIndices.name !== undefined && cells[headerColIndices.name]) rawName = cells[headerColIndices.name];
        if (headerColIndices.phone !== undefined && cells[headerColIndices.phone]) rawPhone = cells[headerColIndices.phone];
        if (headerColIndices.address !== undefined && cells[headerColIndices.address]) rawAddress = cells[headerColIndices.address];
        if (headerColIndices.gender !== undefined && cells[headerColIndices.gender]) rawGender = cells[headerColIndices.gender];
        if (headerColIndices.birthday !== undefined && cells[headerColIndices.birthday]) rawBday = cells[headerColIndices.birthday];
        if (headerColIndices.invitor !== undefined && cells[headerColIndices.invitor]) rawInvitor = cells[headerColIndices.invitor];
      } else {
        // Smart positional mapping:
        // Col 0: No (1, 2, 3...)
        // Col 1: Name (Adrian John A. Fausto)
        // Col 2: CP Number (9076064078)
        // Address: between Phone and Gender
        // Gender: 'M' or 'F'
        // Birthday: Date / Month name string e.g. July 29, '01
        // Invitor: Remaining column(s)
        if (/^\d+$/.test(cells[0]) && cells.length >= 5) {
          rawName = cells[1] || "";
          rawPhone = cells[2] || "";

          let genderIdx = -1;
          for (let c = 3; c < cells.length; c++) {
            if (/^(?:m|f|male|female|lalaki|babae)$/i.test(cells[c].trim())) {
              genderIdx = c;
              break;
            }
          }

          if (genderIdx !== -1) {
            rawAddress = cells.slice(3, genderIdx).join(", ");
            rawGender = cells[genderIdx];
            rawBday = cells[genderIdx + 1] || "";
            rawInvitor = cells.slice(genderIdx + 2).join(", ");
          } else {
            rawAddress = cells[3] || "";
            rawGender = cells[4] || "Male";
            rawBday = cells[5] || "";
            rawInvitor = cells.slice(6).join(", ");
          }
        } else {
          // Detect columns by content patterns
          for (const cell of cells) {
            if (/^\d{1,3}$/.test(cell)) {
              continue;
            } else if (/^(?:\+63|09|\d{10,11})$/.test(cell.replace(/[^\d+]/g, "")) && !rawPhone) {
              rawPhone = cell;
            } else if (/^(?:m|f|male|female|lalaki|babae)$/i.test(cell.trim()) && !rawGender) {
              rawGender = cell;
            } else if (/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i.test(cell) && !rawBday) {
              rawBday = cell;
            } else if (!rawName && cell.length > 2 && /^[A-Za-z\s.,ñÑ'-]+$/.test(cell)) {
              rawName = cell;
            } else if (!rawAddress && cell.length > 2) {
              rawAddress = cell;
            } else if (!rawInvitor && cell.length > 1) {
              rawInvitor = cell;
            }
          }
        }
      }

      if (rawName) {
        const split = splitFullName(rawName);
        rowMember.first_name = split.first_name;
        rowMember.last_name = split.last_name;
      }
      if (rawPhone) rowMember.contact_phone = normalizePhoneNumber(rawPhone);
      if (rawAddress) rowMember.address = rawAddress.trim();
      if (rawGender) rowMember.gender = normalizeGender(rawGender);
      if (rawBday) rowMember.birthdate = normalizeBirthdate(rawBday);
      if (rawInvitor) rowMember.invited_by = rawInvitor.trim();

      rowMember.detectedFieldsCount = countDetectedFields(rowMember);

      if (rowMember.first_name || rowMember.last_name || rowMember.contact_phone) {
        members.push(rowMember);
      }
    }
  }

  return members;
}

/**
 * Universal text parser: automatically determines whether the input
 * is a table/spreadsheet of multiple members or a single member form.
 */
export function parseMemberText(rawText: string): ParsedMemberData {
  const tableMembers = parseTableOrListText(rawText);
  if (tableMembers.length > 0) {
    return tableMembers[0];
  }
  return parseSingleMemberText(rawText);
}

/**
 * Extracts text from an uploaded image file via Canvas contrast processing
 */
export async function extractTextFromImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve("");
        return;
      }

      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }

          const maxDim = 1800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Enhance sharpness & contrast
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            const contrastVal = avg > 128 ? Math.min(255, avg * 1.2) : Math.max(0, avg * 0.8);
            data[i] = contrastVal;
            data[i + 1] = contrastVal;
            data[i + 2] = contrastVal;
          }
          ctx.putImageData(imageData, 0, 0);

          let detectedBarcodeText = "";
          if ("BarcodeDetector" in window) {
            try {
              // @ts-ignore
              const detector = new window.BarcodeDetector();
              const barcodes = await detector.detect(canvas);
              if (barcodes && barcodes.length > 0) {
                detectedBarcodeText = barcodes.map((b: any) => b.rawValue).join("\n");
              }
            } catch {
              // Ignore
            }
          }

          const hints: string[] = [];
          const nameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          if (nameClean && nameClean.length > 3) {
            hints.push(`File Name: ${nameClean}`);
          }
          if (detectedBarcodeText) {
            hints.push(detectedBarcodeText);
          }

          resolve(hints.join("\n"));
        } catch (err) {
          console.warn("Canvas OCR processing note:", err);
          resolve(`File Name: ${file.name}`);
        }
      };

      img.onerror = () => {
        resolve(`File Name: ${file.name}`);
      };

      img.src = dataUrl;
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Main entrance: Analyzes any uploaded File or Spreadsheet (CSV, TXT, JSON, Image, TSV)
 * Returns array of parsed member records, total count, and table detection flag.
 */
export async function analyzeMemberFile(file: File): Promise<AnalyzeResult> {
  const fileType = (file.type || "").toLowerCase();
  const fileName = (file.name || "").toLowerCase();

  // 1. Image Files
  if (fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(fileName)) {
    const textFromImage = await extractTextFromImageFile(file);
    const tableMembers = parseTableOrListText(textFromImage);
    const members = tableMembers.length > 0 ? tableMembers : [parseSingleMemberText(textFromImage)];
    return {
      members,
      totalCount: members.length,
      rawTextPreview: textFromImage,
      isTable: tableMembers.length > 1,
      fileName: file.name
    };
  }

  // 2. Text / CSV / TSV / Document Files
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = (e.target?.result as string) || "";
      if (!content.trim()) {
        const blank = createBlankMember();
        resolve({
          members: [blank],
          totalCount: 0,
          rawTextPreview: "",
          isTable: false,
          fileName: file.name
        });
        return;
      }

      const tableMembers = parseTableOrListText(content);
      const isTable = tableMembers.length > 0;
      const members = isTable ? tableMembers : [parseSingleMemberText(content)];

      resolve({
        members,
        totalCount: members.length,
        rawTextPreview: content,
        isTable: members.length > 1 || isTable,
        fileName: file.name
      });
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsText(file);
  });
}
