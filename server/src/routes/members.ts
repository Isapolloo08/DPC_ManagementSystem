import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { calculateAge } from "./ministries";
import { emitRealtimeEvent } from "../socket";
import { computeMemberAttendanceSummary } from "../utils/attendanceRules";

const router = Router();

function calculateBirthdayDetails(birthdateStr: string) {
  if (!birthdateStr) return null;
  // Support Date objects or strings like "YYYY-MM-DD"
  const str = typeof birthdateStr === "string" ? birthdateStr.split("T")[0] : new Date(birthdateStr).toISOString().split("T")[0];
  const parts = str.split("-").map(p => parseInt(p, 10));
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  const [bYear, bMonth, bDay] = parts;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let age = currentYear - bYear;
  if (currentMonth < bMonth || (currentMonth === bMonth && currentDay < bDay)) {
    age--;
  }

  const isToday = currentMonth === bMonth && currentDay === bDay;

  let nextBdayYear = currentYear;
  if (currentMonth > bMonth || (currentMonth === bMonth && currentDay > bDay)) {
    nextBdayYear = currentYear + 1;
  }

  const todayDateOnly = new Date(currentYear, currentMonth - 1, currentDay);
  const nextBdayDateOnly = new Date(nextBdayYear, bMonth - 1, bDay);
  const diffTime = nextBdayDateOnly.getTime() - todayDateOnly.getTime();
  const daysUntil = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  const turningAge = isToday ? age : age + 1;
  const isThisWeek = daysUntil >= 0 && daysUntil <= 7;
  const isThisMonth = currentMonth === bMonth;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const birthMonthName = monthNames[bMonth - 1] || "";

  return {
    birthdate: str,
    birth_month: bMonth,
    birth_day: bDay,
    birth_month_name: birthMonthName,
    current_age: age,
    turning_age: turningAge,
    days_until_birthday: daysUntil,
    is_today: isToday,
    is_this_week: isThisWeek,
    is_this_month: isThisMonth,
    next_birthday_date: `${nextBdayYear}-${String(bMonth).padStart(2, '0')}-${String(bDay).padStart(2, '0')}`
  };
}

// Compute comprehensive membership classification & attendance health indicators
function computeAttendanceHealthAndStatus(member: any, attendanceRecords: any[] = [], bibleStudyInfo?: any) {
  const isBaptized = member.is_baptized === true || member.baptism_status === "baptized";
  let membershipType: "baptized_regular" | "unbaptized_regular" | "guest" | "inactive" = "unbaptized_regular";

  if (member.status === "visitor") {
    membershipType = "guest";
  } else if (member.status === "inactive") {
    membershipType = "inactive";
  } else if (isBaptized) {
    membershipType = "baptized_regular";
  } else {
    membershipType = "unbaptized_regular";
  }

  // Calculate last attended date and consecutive absences
  let lastAttendedDate: string | null = null;
  let consecutiveAbsences = 0;
  let countingConsecutive = true;

  for (const record of attendanceRecords) {
    const isAbsent = record.notes && (record.notes.includes("[ABSENT]") || record.notes.includes("[EXCUSED]"));
    if (!isAbsent && !lastAttendedDate) {
      lastAttendedDate = typeof record.checked_in_at === "string"
        ? record.checked_in_at.split("T")[0]
        : new Date(record.checked_in_at).toISOString().split("T")[0];
    }
    if (countingConsecutive) {
      if (isAbsent) {
        consecutiveAbsences++;
      } else {
        countingConsecutive = false;
      }
    }
  }

  // Calculate days since last attendance
  let daysSinceLastAttended: number | null = null;
  if (lastAttendedDate) {
    const diffMs = new Date().getTime() - new Date(lastAttendedDate).getTime();
    daysSinceLastAttended = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  let attendanceHealth: "healthy" | "warning" | "action_required" | "inactive" = "healthy";

  if (member.status === "inactive") {
    attendanceHealth = "inactive";
  } else if (
    consecutiveAbsences >= 3 ||
    (daysSinceLastAttended !== null && daysSinceLastAttended >= 21)
  ) {
    attendanceHealth = "action_required";
  } else if (
    consecutiveAbsences >= 1 ||
    (daysSinceLastAttended !== null && daysSinceLastAttended >= 10 && member.status !== "visitor")
  ) {
    attendanceHealth = "warning";
  } else {
    attendanceHealth = "healthy";
  }

  return {
    membership_type: membershipType,
    attendance_health: attendanceHealth,
    consecutive_absences: consecutiveAbsences,
    last_attended_date: lastAttendedDate,
    bible_study_group_id: bibleStudyInfo?.group_id || null,
    bible_study_group_name: bibleStudyInfo?.group_name || null,
    bible_study_leader_name: bibleStudyInfo?.leader_name || null
  };
}

// Get list of members with search, filter, and pagination
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      ministry_id,
      household_id,
      status,
      search,
      birthday_filter,
      membership_filter,
      attendance_health_filter,
      page,
      limit
    } = req.query;

    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      whereClause += ` AND m.ministry_id = $${params.length}`;
    }

    if (household_id) {
      params.push(household_id);
      whereClause += ` AND m.household_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND m.status = $${params.length}`;
    }

    // Specific Membership Status Filter
    if (membership_filter && typeof membership_filter === "string") {
      if (membership_filter === "baptized_regular") {
        whereClause += ` AND m.status = 'active' AND (m.is_baptized = TRUE OR m.baptism_status = 'baptized')`;
      } else if (membership_filter === "unbaptized_regular") {
        whereClause += ` AND m.status = 'active' AND (m.is_baptized IS NOT TRUE AND (m.baptism_status IS NULL OR m.baptism_status != 'baptized'))`;
      } else if (membership_filter === "guest" || membership_filter === "visitor") {
        whereClause += ` AND m.status = 'visitor'`;
      } else if (membership_filter === "inactive") {
        whereClause += ` AND m.status = 'inactive'`;
      }
    }

    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      whereClause += ` AND (m.first_name ILIKE $${pIdx} OR m.last_name ILIKE $${pIdx} OR m.contact_email ILIKE $${pIdx} OR m.contact_phone ILIKE $${pIdx} OR m.address ILIKE $${pIdx} OR m.invited_by ILIKE $${pIdx})`;
    }

    if (birthday_filter && typeof birthday_filter === "string") {
      if (birthday_filter === "today") {
        whereClause += ` AND m.birthdate IS NOT NULL AND EXTRACT(MONTH FROM m.birthdate) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM m.birthdate) = EXTRACT(DAY FROM CURRENT_DATE)`;
      } else if (birthday_filter === "this_month") {
        whereClause += ` AND m.birthdate IS NOT NULL AND EXTRACT(MONTH FROM m.birthdate) = EXTRACT(MONTH FROM CURRENT_DATE)`;
      } else if (birthday_filter.startsWith("month_")) {
        const mNum = parseInt(birthday_filter.replace("month_", ""), 10);
        if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
          params.push(mNum);
          whereClause += ` AND m.birthdate IS NOT NULL AND EXTRACT(MONTH FROM m.birthdate) = $${params.length}`;
        }
      }
    }

    const isPaginated = page !== undefined || limit !== undefined;
    let totalCount = 0;
    const curPage = Math.max(1, page ? parseInt(String(page), 10) : 1);
    const curLimit = Math.max(1, limit ? parseInt(String(limit), 10) : 30);

    if (isPaginated) {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM members m
        LEFT JOIN ministries min ON m.ministry_id = min.id
        LEFT JOIN households h ON m.household_id = h.id
        LEFT JOIN users u ON m.user_id = u.id
        ${whereClause}
      `;
      const countRes = await db.get<{ total: string | number }>(countQuery, params);
      totalCount = parseInt(String(countRes?.total || 0), 10);
    }

    let query = `
      SELECT m.*, 
             min.name as ministry_name, min.color as ministry_color, min.min_age, min.max_age,
             h.name as household_name, h.primary_contact_phone as household_phone,
             u.email as user_email,
             sp.first_name as linked_spouse_first_name, sp.last_name as linked_spouse_last_name
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN members sp ON m.spouse_id = sp.id
      ${whereClause}
      ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
    `;

    let members: any[] = [];
    if (isPaginated) {
      const offset = (curPage - 1) * curLimit;
      const paginatedParams = [...params, curLimit, offset];
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      members = await db.all(query, paginatedParams);
    } else {
      members = await db.all(query, params);
    }

    // Fetch batch attendance history and small group data for all members
    const memberIds = members.map(m => m.id);
    const attendanceMap = new Map<number, any[]>();
    const bsMap = new Map<number, any>();

    if (memberIds.length > 0) {
      const [attRows, bsRows] = await Promise.all([
        db.all(`
          SELECT member_id, checked_in_at, notes
          FROM attendance
          WHERE member_id = ANY($1)
          ORDER BY checked_in_at DESC
        `, [memberIds]).catch(() => []),
        db.all(`
          SELECT bsm.member_id, bsg.id as group_id, bsg.name as group_name, bsg.leader_name
          FROM bible_study_members bsm
          JOIN bible_study_groups bsg ON bsm.group_id = bsg.id
          WHERE bsm.member_id = ANY($1)
        `, [memberIds]).catch(() => [])
      ]);

      for (const r of attRows) {
        if (!attendanceMap.has(r.member_id)) attendanceMap.set(r.member_id, []);
        attendanceMap.get(r.member_id)!.push(r);
      }

      for (const r of bsRows) {
        bsMap.set(r.member_id, r);
      }
    }

    // Attach calculated age, aging-out flag, birthday calculation, and attendance health indicators
    let enriched = members.map(m => {
      const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
      const age = calculateAge(birthdateStr);
      const isAgingOut = m.max_age !== null && age > m.max_age;
      const bday = calculateBirthdayDetails(birthdateStr);
      const healthInfo = computeAttendanceHealthAndStatus(m, attendanceMap.get(m.id) || [], bsMap.get(m.id));

      return {
        ...m,
        birthdate: birthdateStr,
        age,
        is_aging_out: isAgingOut,
        birth_month: bday?.birth_month,
        birth_day: bday?.birth_day,
        birth_month_name: bday?.birth_month_name,
        turning_age: bday?.turning_age,
        days_until_birthday: bday?.days_until_birthday,
        is_birthday_today: bday?.is_today,
        is_birthday_this_week: bday?.is_this_week,
        is_birthday_this_month: bday?.is_this_month,
        next_birthday_date: bday?.next_birthday_date,
        ...healthInfo
      };
    });

    if (attendance_health_filter && typeof attendance_health_filter === "string") {
      enriched = enriched.filter(m => m.attendance_health === attendance_health_filter);
    }

    if (isPaginated) {
      res.json({
        data: enriched,
        pagination: {
          total: totalCount,
          page: curPage,
          limit: curLimit,
          totalPages: Math.ceil(totalCount / curLimit) || 1
        }
      });
    } else {
      res.json(enriched);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get upcoming birthday celebrants
router.get("/birthdays", async (req: Request, res: Response) => {
  try {
    const { timeframe = "all", month, ministry_id } = req.query;

    let query = `
      SELECT m.*, 
             min.name as ministry_name, min.color as ministry_color,
             h.name as household_name
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.status = 'active'
    `;
    const params: any[] = [];
    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND m.ministry_id = $${params.length}`;
    }

    const members = await db.all(query, params);
    const enriched = members
      .map(m => {
        const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
        const bday = calculateBirthdayDetails(birthdateStr);
        if (!bday) return null;
        return { ...m, birthdate: birthdateStr, ...bday };
      })
      .filter(Boolean) as any[];

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const monthlyDistribution = Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const monthMembers = enriched.filter(m => m.birth_month === mNum);
      return {
        month: mNum,
        month_name: monthNames[i],
        count: monthMembers.length,
        celebrants: monthMembers.map(m => ({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          birth_day: m.birth_day,
          ministry_name: m.ministry_name
        }))
      };
    });

    const counts = {
      today: enriched.filter(m => m.is_today).length,
      this_week: enriched.filter(m => m.is_this_week).length,
      this_month: enriched.filter(m => m.is_this_month).length,
      next_30_days: enriched.filter(m => m.days_until_birthday <= 30).length,
      total_active: enriched.length
    };

    let filtered = [...enriched];
    if (month) {
      const mNum = parseInt(String(month), 10);
      if (!isNaN(mNum)) {
        filtered = filtered.filter(m => m.birth_month === mNum);
      }
    }

    if (timeframe === "today") {
      filtered = filtered.filter(m => m.is_today);
    } else if (timeframe === "this_week") {
      filtered = filtered.filter(m => m.is_this_week);
    } else if (timeframe === "this_month") {
      filtered = filtered.filter(m => m.is_this_month);
    } else if (timeframe === "next_30_days") {
      filtered = filtered.filter(m => m.days_until_birthday <= 30);
    }

    filtered.sort((a, b) => a.days_until_birthday - b.days_until_birthday);

    res.json({
      celebrants: filtered,
      counts,
      monthly_distribution: monthlyDistribution
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send birthday greeting
router.post("/:id/birthday-greeting", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const member = await db.get(`
      SELECT m.*, min.name as ministry_name 
      FROM members m 
      LEFT JOIN ministries min ON m.ministry_id = min.id 
      WHERE m.id = $1
    `, [id]);

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const { message, channel = "announcement" } = req.body;
    const birthdateStr = member.birthdate ? (typeof member.birthdate === "string" ? member.birthdate : new Date(member.birthdate).toISOString().split("T")[0]) : "";
    const bday = calculateBirthdayDetails(birthdateStr);
    const turningAge = bday ? bday.turning_age : "";

    const defaultBlessing = `Happy ${turningAge ? `${turningAge}th ` : ''}Birthday, ${member.first_name}! 🎂 "The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25). May God fill your upcoming year with abundant joy, peace, and spiritual growth!`;
    const greetingText = message?.trim() || defaultBlessing;

    let announcementId: number | undefined;

    if (channel === "announcement") {
      const authorId = req.user?.id || 1;
      const result = await db.run(`
        INSERT INTO announcements (ministry_id, author_id, title, body, is_pinned)
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING id
      `, [
        member.ministry_id || null,
        authorId,
        `🎂 Happy Birthday to ${member.first_name} ${member.last_name}!`,
        greetingText
      ]);
      announcementId = result.lastInsertRowid;
    }

    await logAuditAction(req.user?.id || null, "CREATE", "members", Number(id), `Sent birthday blessing greeting to ${member.first_name} ${member.last_name}`);

    res.json({
      message: "Birthday greeting sent successfully!",
      blessing: greetingText,
      announcement_id: announcementId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get members aging out of their current ministry
router.get("/aging-out", async (req: Request, res: Response) => {
  try {
    const members = await db.all(`
      SELECT m.*, 
             min.name as current_ministry_name, min.max_age as current_max_age,
             h.name as household_name
      FROM members m
      JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.status = 'active' AND min.max_age IS NOT NULL
    `);

    const ministries = await db.all("SELECT * FROM ministries ORDER BY min_age ASC");

    const agingOutList = members
      .map(m => {
        const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
        const age = calculateAge(birthdateStr);
        if (age > m.current_max_age) {
          const nextMinistry = ministries.find(nextMin => {
            const min = nextMin.min_age ?? 0;
            const max = nextMin.max_age ?? 999;
            return age >= min && age <= max;
          });
          return {
            ...m,
            birthdate: birthdateStr,
            current_age: age,
            suggested_next_ministry: nextMinistry || null
          };
        }
        return null;
      })
      .filter(Boolean);

    res.json(agingOutList);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-transition all aging out members to their respective age-bracket ministry
router.post("/auto-transition", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const members = await db.all(`
      SELECT m.id, m.first_name, m.last_name, m.birthdate, m.ministry_id, min.name as current_min_name, min.max_age
      FROM members m
      JOIN ministries min ON m.ministry_id = min.id
      WHERE m.status = 'active' AND min.max_age IS NOT NULL
    `);

    const ministries = await db.all("SELECT * FROM ministries ORDER BY min_age ASC");
    let transitionedCount = 0;

    for (const m of members) {
      const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
      const age = calculateAge(birthdateStr);

      if (age > m.max_age) {
        const nextMinistry = ministries.find(nextMin => {
          const min = nextMin.min_age ?? 0;
          const max = nextMin.max_age ?? 999;
          return age >= min && age <= max && nextMin.id !== m.ministry_id;
        });

        if (nextMinistry) {
          await db.run("UPDATE members SET ministry_id = $1 WHERE id = $2", [nextMinistry.id, m.id]);
          transitionedCount++;
        }
      }
    }

    if (transitionedCount > 0) {
      await logAuditAction(req.user?.id || null, "UPDATE", "members", 0, `Auto-transitioned ${transitionedCount} aging-out members to their matching age ministries`);
      emitRealtimeEvent("members:changed", { action: "auto_transition", count: transitionedCount });
      emitRealtimeEvent("reports:changed");
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// Real-time duplicate member verification across entire database
router.get("/check-duplicate", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, exclude_id } = req.query;
    const excludeId = exclude_id ? parseInt(String(exclude_id), 10) : null;

    let duplicateNameMember: any = null;
    let duplicateEmailMember: any = null;
    let duplicatePhoneMember: any = null;

    if (name && typeof name === "string" && name.trim().length >= 2) {
      const cleanName = name.trim().replace(/\s+/g, " ");
      const nameParts = cleanName.split(" ");

      // 1. Exact match on combined full name: LOWER(TRIM(first_name || ' ' || last_name))
      let nameQuery = `
        SELECT m.id, m.first_name, m.last_name, m.birthdate, m.status, min.name as ministry_name
        FROM members m
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE (
          LOWER(TRIM(m.first_name || ' ' || m.last_name)) = LOWER($1)
          OR LOWER(TRIM(m.first_name)) = LOWER($1)
        )
      `;
      const params: any[] = [cleanName];
      if (excludeId) {
        nameQuery += ` AND m.id != $2`;
        params.push(excludeId);
      }
      duplicateNameMember = await db.get(nameQuery, params);

      // 2. If not matched, try splitting into firstName and lastName
      if (!duplicateNameMember && nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts.slice(0, nameParts.length - 1).join(" ");
        let splitQuery = `
          SELECT m.id, m.first_name, m.last_name, m.birthdate, m.status, min.name as ministry_name
          FROM members m
          LEFT JOIN ministries min ON m.ministry_id = min.id
          WHERE LOWER(TRIM(m.first_name)) = LOWER($1) AND LOWER(TRIM(m.last_name)) = LOWER($2)
        `;
        const splitParams: any[] = [firstName, lastName];
        if (excludeId) {
          splitQuery += ` AND m.id != $3`;
          splitParams.push(excludeId);
        }
        duplicateNameMember = await db.get(splitQuery, splitParams);
      }
    }

    if (email && typeof email === "string" && email.trim()) {
      let emailQuery = `
        SELECT m.id, m.first_name, m.last_name, m.contact_email
        FROM members m
        WHERE LOWER(TRIM(m.contact_email)) = LOWER($1)
      `;
      const emailParams: any[] = [email.trim()];
      if (excludeId) {
        emailQuery += ` AND m.id != $2`;
        emailParams.push(excludeId);
      }
      duplicateEmailMember = await db.get(emailQuery, emailParams);
    }

    if (phone && typeof phone === "string" && phone.trim()) {
      const cleanDigits = phone.replace(/\D/g, "");
      if (cleanDigits.length >= 7) {
        let phoneQuery = `
          SELECT m.id, m.first_name, m.last_name, m.contact_phone
          FROM members m
          WHERE m.contact_phone IS NOT NULL AND REPLACE(REPLACE(REPLACE(REPLACE(m.contact_phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE $1
        `;
        const phoneParams: any[] = [`%${cleanDigits.slice(-7)}%`];
        if (excludeId) {
          phoneQuery += ` AND m.id != $2`;
          phoneParams.push(excludeId);
        }
        duplicatePhoneMember = await db.get(phoneQuery, phoneParams);
      }
    }

    res.json({
      exists: !!(duplicateNameMember || duplicateEmailMember || duplicatePhoneMember),
      duplicateName: duplicateNameMember || null,
      duplicateEmail: duplicateEmailMember || null,
      duplicatePhone: duplicatePhoneMember || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get qualified baptism candidates (members with ~1 year faithful attendance or 0 absences)
router.get("/baptism-candidates/qualified", async (req: Request, res: Response) => {
  try {
    const { ministry_id } = req.query;

    let query = `
      SELECT m.*, 
             min.name as ministry_name, min.color as ministry_color, min.min_age, min.max_age,
             h.name as household_name
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.status = 'active'
        AND (m.is_baptized IS NOT TRUE)
        AND (m.baptism_status IS NULL OR m.baptism_status != 'baptized')
    `;
    const params: any[] = [];
    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND m.ministry_id = $${params.length}`;
    }

    const members = await db.all(query, params);
    if (members.length === 0) {
      return res.json({
        candidates: [],
        counts: {
          total_qualified: 0,
          already_candidates: 0,
          pending_nomination: 0
        }
      });
    }

    const memberIds = members.map(m => m.id);
    const [attendanceRecords, bsRows] = await Promise.all([
      db.all(`
        SELECT member_id, checked_in_at, notes, status
        FROM attendance
        WHERE member_id = ANY($1)
        ORDER BY checked_in_at DESC
      `, [memberIds]).catch(() => []),
      db.all(`
        SELECT bsm.member_id, bsg.id as group_id, bsg.name as group_name, bsg.leader_name, bsg.meeting_day
        FROM bible_study_members bsm
        JOIN bible_study_groups bsg ON bsm.group_id = bsg.id
        WHERE bsm.member_id = ANY($1)
      `, [memberIds]).catch(() => [])
    ]);

    const attMap = new Map<number, any[]>();
    for (const r of attendanceRecords) {
      if (!attMap.has(r.member_id)) attMap.set(r.member_id, []);
      attMap.get(r.member_id)!.push(r);
    }

    const bsMap = new Map<number, any>();
    for (const b of bsRows) {
      bsMap.set(b.member_id, b);
    }

    const qualifiedList: any[] = [];

    for (const member of members) {
      const records = attMap.get(member.id) || [];
      const bsInfo = bsMap.get(member.id) || null;
      let presentCount = 0;
      let absentCount = 0;
      let excusedCount = 0;

      for (const r of records) {
        const isAbsent = r.status === "absent" || (r.notes && r.notes.includes("[ABSENT]"));
        const isExcused = r.status === "excused" || (r.notes && r.notes.includes("[EXCUSED]"));
        if (isAbsent) {
          absentCount++;
        } else if (isExcused) {
          excusedCount++;
        } else {
          presentCount++;
        }
      }

      const totalLogged = presentCount + absentCount + excusedCount;
      const consistencyRate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 0;
      const isCandidate = member.baptism_status === "candidate" || member.baptism_status === "scheduled";
      const hasBibleStudy = !!bsInfo;

      // Qualification Logic:
      // Evaluates ~1 year Sunday attendance (benchmark 52 Sundays) + active Bible study discipleship
      // 1. If already tagged as candidate
      // 2. Or attended >= 10 services (almost 1 year / consistent regular)
      // 3. Or attended >= 4 services with 0 absences (100% faithful attendance without absent)
      // 4. Or attended >= 6 services with >= 70% consistency rate
      const isQualifiedByAttendance = presentCount >= 10 || (presentCount >= 4 && absentCount === 0) || (presentCount >= 6 && consistencyRate >= 70);

      if (isCandidate || isQualifiedByAttendance) {
        let reason = "Qualified Candidate for Water Baptism";
        const groupName = bsInfo?.group_name ? `Active in ${bsInfo.group_name}` : "Enrolled in Discipleship";

        if (isCandidate) {
          reason = `🔖 Official Candidate for Water Baptism Ceremony (${groupName})`;
        } else if (absentCount === 0 && presentCount >= 4) {
          reason = `🌟 100% Perfect Attendance (0 Absences across ${presentCount} Sundays + ${groupName})`;
        } else if (presentCount >= 10) {
          reason = `🌊 Faithful ~1 Year Worship (${presentCount}/52 Sundays + ${groupName})`;
        } else if (consistencyRate >= 70) {
          reason = `✨ High Loyalty (${consistencyRate}% consistency across Sundays + ${groupName})`;
        }

        const birthdateStr = member.birthdate ? (typeof member.birthdate === "string" ? member.birthdate : new Date(member.birthdate).toISOString().split("T")[0]) : "";
        const age = calculateAge(birthdateStr);

        qualifiedList.push({
          id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          gender: member.gender,
          birthdate: birthdateStr,
          age,
          contact_phone: member.contact_phone,
          ministry_id: member.ministry_id,
          ministry_name: member.ministry_name,
          ministry_color: member.ministry_color,
          household_name: member.household_name,
          application_date: member.application_date,
          baptism_status: member.baptism_status || "not_baptized",
          is_baptized: false,
          total_present: presentCount,
          total_absent: absentCount,
          total_excused: excusedCount,
          total_logged: totalLogged,
          consistency_rate: consistencyRate,
          annual_sundays_target: 52,
          has_bible_study: hasBibleStudy,
          bible_study_group_id: bsInfo?.group_id || null,
          bible_study_group_name: bsInfo?.group_name || null,
          bible_study_leader_name: bsInfo?.leader_name || null,
          is_candidate: isCandidate,
          is_ready_for_nomination: !isCandidate,
          qualification_reason: reason
        });
      }
    }

    // Sort: Pending nominations first, then by highest consistency rate & attendances
    qualifiedList.sort((a, b) => {
      if (a.is_ready_for_nomination && !b.is_ready_for_nomination) return -1;
      if (!a.is_ready_for_nomination && b.is_ready_for_nomination) return 1;
      if (b.consistency_rate !== a.consistency_rate) return b.consistency_rate - a.consistency_rate;
      return b.total_present - a.total_present;
    });

    const alreadyCount = qualifiedList.filter(c => c.is_candidate).length;
    const pendingCount = qualifiedList.filter(c => c.is_ready_for_nomination).length;

    res.json({
      candidates: qualifiedList,
      counts: {
        total_qualified: qualifiedList.length,
        already_candidates: alreadyCount,
        pending_nomination: pendingCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Nominate one or multiple members as Baptism Candidates
router.post("/baptism-candidates/nominate", authMiddleware, requireRoles("Admin", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const { member_ids, notes } = req.body;
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ error: "member_ids array is required" });
    }

    const validIds = member_ids.map(Number).filter(id => !isNaN(id) && id > 0);
    if (validIds.length === 0) {
      return res.status(400).json({ error: "No valid member IDs provided" });
    }

    await db.run(`
      UPDATE members
      SET baptism_status = 'candidate',
          is_baptized = FALSE,
          baptism_notes = COALESCE($1, baptism_notes)
      WHERE id = ANY($2)
    `, [notes || "Nominated as candidate for Water Baptism ceremony based on faithful attendance", validIds]);

    await logAuditAction(
      req.user?.id || null,
      "UPDATE_BAPTISM",
      "members",
      validIds[0] || 0,
      `Nominated ${validIds.length} member(s) as candidates for Water Baptism Ceremony (IDs: ${validIds.join(", ")})`
    );

    emitRealtimeEvent("members:changed", { action: "nominate_baptism_candidates", member_ids: validIds });

    res.json({
      success: true,
      count: validIds.length,
      member_ids: validIds,
      message: `Successfully nominated ${validIds.length} member(s) as candidate(s) for the Water Baptism ceremony!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific member
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const member = await db.get(`
      SELECT m.*, 
             min.name as ministry_name, min.color as ministry_color, min.min_age, min.max_age,
             h.name as household_name, h.address as household_address, h.primary_contact_phone as household_phone,
             sp.first_name as linked_spouse_first_name, sp.last_name as linked_spouse_last_name,
             sp.birthdate as linked_spouse_birthdate, sp.ministry_id as linked_spouse_ministry_id,
             sp_min.name as linked_spouse_ministry_name
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      LEFT JOIN members sp ON m.spouse_id = sp.id
      LEFT JOIN ministries sp_min ON sp.ministry_id = sp_min.id
      WHERE m.id = $1
    `, [req.params.id]);

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const birthdateStr = member.birthdate ? (typeof member.birthdate === "string" ? member.birthdate : new Date(member.birthdate).toISOString().split("T")[0]) : "";
    const age = calculateAge(birthdateStr);
    member.birthdate = birthdateStr;
    member.age = age;
    member.is_aging_out = member.max_age !== null && age > member.max_age;

    // Fetch household family members
    let familyMembers: any[] = [];
    if (member.household_id) {
      familyMembers = await db.all(`
        SELECT id, first_name, last_name, birthdate, ministry_id
        FROM members
        WHERE household_id = $1 AND id != $2
      `, [member.household_id, member.id]);
    }

    // Fetch recent attendance
    const attendanceHistory = await db.all(`
      SELECT a.*, e.title as event_title, min.name as ministry_name
      FROM attendance a
      LEFT JOIN events e ON a.event_id = e.id
      LEFT JOIN ministries min ON a.ministry_id = min.id
      WHERE a.member_id = $1
      ORDER BY a.checked_in_at DESC
      LIMIT 10
    `, [member.id]);

    // Fetch giving history
    const donations = await db.all(`
      SELECT d.*, f.name as fund_name
      FROM donations d
      JOIN funds f ON d.fund_id = f.id
      WHERE d.member_id = $1
      ORDER BY d.donated_at DESC
    `, [member.id]);

    // Fetch Bible study group info
    const bsInfo = await db.get(`
      SELECT bsm.member_id, bsg.id as group_id, bsg.name as group_name, bsg.leader_name
      FROM bible_study_members bsm
      JOIN bible_study_groups bsg ON bsm.group_id = bsg.id
      WHERE bsm.member_id = $1
    `, [member.id]);

    const healthInfo = computeAttendanceHealthAndStatus(member, attendanceHistory, bsInfo);

    res.json({
      ...member,
      ...healthInfo,
      family_members: familyMembers,
      attendance_history: attendanceHistory,
      donations
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get comprehensive attendance summary & streaks for a specific member
router.get("/:id/attendance-summary", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const memberId = parseInt(req.params.id, 10);
    if (isNaN(memberId) || memberId <= 0) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const member = await db.get(`
      SELECT m.*, min.name as ministry_name, min.color as ministry_color, h.name as household_name
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.id = $1
    `, [memberId]);

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // RBAC validation
    const user = req.user!;
    if (user.role_name === "Admin") {
      // Unrestricted
    } else if (user.role_name === "Coordinator") {
      if (!user.ministry_ids || !user.ministry_ids.includes(member.ministry_id)) {
        return res.status(403).json({ error: "Access denied. Member is outside your assigned ministries." });
      }
    } else if (user.role_name === "Leader") {
      // Allowed if member belongs to a group led by this leader
      const isLeaderOfMember = await db.get(`
        SELECT 1 FROM bible_study_members bsm
        JOIN bible_study_groups bsg ON bsm.group_id = bsg.id
        WHERE bsm.member_id = $1 AND (
          bsg.leader_name ILIKE $2 OR bsg.leader_name ILIKE (
            SELECT TRIM(first_name || ' ' || last_name) FROM members WHERE user_id = $3 LIMIT 1
          )
        )
      `, [memberId, user.name, user.id]);

      if (!isLeaderOfMember) {
        return res.status(403).json({ error: "Access denied. Member is not in any Bible Study group you lead." });
      }
    } else {
      // Volunteer / Member can only view own summary
      const linkedMember = await db.get("SELECT id FROM members WHERE user_id = $1", [user.id]);
      if (!linkedMember || linkedMember.id !== memberId) {
        return res.status(403).json({ error: "Access denied. You may only view your own attendance summary." });
      }
    }

    // Date range
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const [y, m, d] = todayStr.split("-").map(Number);
    const defaultFrom = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(y, m - 1, d - 12 * 7) // 12 weeks back
    );

    const fromDate = typeof req.query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
      ? req.query.from
      : defaultFrom;
    const toDate = typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
      ? req.query.to
      : todayStr;

    const summary = await computeMemberAttendanceSummary(memberId, fromDate, toDate);

    // Compute age if birthdate is present
    let age: number | null = null;
    if (member.birthdate) {
      const birth = new Date(member.birthdate);
      const now = new Date();
      age = now.getFullYear() - birth.getFullYear();
      const mDiff = now.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
    }

    res.json({
      member: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        birthdate: member.birthdate || null,
        age,
        gender: member.gender || null,
        civil_status: member.civil_status || null,
        ministry_id: member.ministry_id,
        ministry_name: member.ministry_name || "Unassigned",
        ministry_color: member.ministry_color || null,
        household_id: member.household_id || null,
        household_name: member.household_name || null,
        photo_url: member.photo_url || null,
        status: member.status,
        is_baptized: Boolean(member.is_baptized || member.baptism_status === "baptized"),
        baptism_status: member.baptism_status || (member.is_baptized ? "baptized" : "not_baptized"),
        baptism_date: member.baptism_date || null,
        baptism_notes: member.baptism_notes || null
      },
      ...summary
    });
  } catch (err: any) {
    console.error("Error in GET /api/members/:id/attendance-summary:", err);
    res.status(500).json({ error: "Failed to compute member attendance summary", details: err?.message });
  }
});

// Create new member
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      first_name,
      last_name,
      birthdate,
      gender,
      contact_email,
      contact_phone,
      household_id,
      ministry_id,
      status = "active",
      medical_notes,
      grade_level,
      address,
      guardian_names,
      guardian_phone,
      invited_by,
      school_name,
      program_major,
      class_schedule,
      occupation,
      hobbies,
      previous_church,
      facebook_account,
      family_details,
      application_date,
      civil_status = "Single",
      spouse_name,
      spouse_id,
      partner_record,
      is_baptized,
      baptism_status,
      baptism_date,
      baptism_notes
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !birthdate) {
      return res.status(400).json({ error: "First name, last name, and birthdate are required" });
    }

    // Check duplicate member with same full name
    const existingName = await db.get(
      "SELECT id, first_name, last_name FROM members WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)",
      [first_name.trim(), last_name.trim()]
    );
    if (existingName) {
      return res.status(400).json({ error: `A member named "${existingName.first_name} ${existingName.last_name}" already exists` });
    }

    if (contact_email && contact_email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email.trim())) {
        return res.status(400).json({ error: "Invalid email address format" });
      }
      const existingEmail = await db.get(
        "SELECT id, first_name, last_name FROM members WHERE LOWER(contact_email) = LOWER($1)",
        [contact_email.trim()]
      );
      if (existingEmail) {
        return res.status(400).json({ error: `The email "${contact_email.trim()}" is already registered to ${existingEmail.first_name} ${existingEmail.last_name}` });
      }
    }

    if (contact_phone && contact_phone.trim()) {
      const cleanPhone = contact_phone.replace(/\D/g, "");
      if (cleanPhone.length !== 11 || !cleanPhone.startsWith("09")) {
        return res.status(400).json({ error: "Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09123456789)" });
      }
    }

    if (guardian_phone && guardian_phone.trim()) {
      const cleanGPhone = guardian_phone.replace(/\D/g, "");
      if (cleanGPhone.length !== 11 || !cleanGPhone.startsWith("09")) {
        return res.status(400).json({ error: "Guardian contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09123456789)" });
      }
    }

    let targetMinistryId = ministry_id;
    if (!targetMinistryId) {
      const ministries = await db.all("SELECT * FROM ministries ORDER BY min_age ASC");
      if (civil_status === "Married") {
        const jaMin = ministries.find(m => m.name.toLowerCase().includes("junior") || m.name.toLowerCase().includes("adult"));
        targetMinistryId = jaMin ? jaMin.id : (ministries[ministries.length - 1]?.id || null);
      } else {
        const age = calculateAge(birthdate);
        const match = ministries.find(m => {
          const min = m.min_age ?? 0;
          const max = m.max_age ?? 999;
          return age >= min && age <= max;
        });
        targetMinistryId = match ? match.id : (ministries[ministries.length - 1]?.id || null);
      }
    }

    let resolvedSpouseId = spouse_id || null;
    let resolvedSpouseName = spouse_name || null;

    // If a partner record was supplied to be created simultaneously
    if (partner_record && partner_record.first_name && partner_record.last_name) {
      const partnerRes = await db.run(`
        INSERT INTO members (
          first_name, last_name, birthdate, gender, contact_email, contact_phone,
          household_id, ministry_id, status, medical_notes, grade_level,
          address, guardian_names, guardian_phone, invited_by, school_name,
          program_major, class_schedule, occupation, hobbies, previous_church,
          facebook_account, family_details, application_date, civil_status, spouse_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26
        )
        RETURNING id
      `, [
        partner_record.first_name,
        partner_record.last_name,
        partner_record.birthdate || birthdate,
        partner_record.gender || (gender === "Male" ? "Female" : "Male"),
        partner_record.contact_email || null,
        partner_record.contact_phone || null,
        partner_record.household_id || household_id || null,
        targetMinistryId,
        "active",
        partner_record.medical_notes || null,
        null,
        partner_record.address || address || null,
        null,
        null,
        partner_record.invited_by || invited_by || null,
        null,
        null,
        null,
        partner_record.occupation || null,
        partner_record.hobbies || null,
        partner_record.previous_church || previous_church || null,
        partner_record.facebook_account || null,
        partner_record.family_details || family_details || null,
        partner_record.application_date || application_date || null,
        "Married",
        `${first_name} ${last_name}`
      ]);

      resolvedSpouseId = partnerRes.lastInsertRowid;
      resolvedSpouseName = `${partner_record.first_name} ${partner_record.last_name}`;
    }

    const resolvedIsBaptized = is_baptized !== undefined ? Boolean(is_baptized) : (baptism_status === "baptized");
    const resolvedBaptismStatus = baptism_status || (resolvedIsBaptized ? "baptized" : "not_baptized");

    const result = await db.run(`
      INSERT INTO members (
        first_name, last_name, birthdate, gender, contact_email, contact_phone,
        household_id, ministry_id, status, medical_notes, grade_level,
        address, guardian_names, guardian_phone, invited_by, school_name,
        program_major, class_schedule, occupation, hobbies, previous_church,
        facebook_account, family_details, application_date, civil_status, spouse_name, spouse_id,
        is_baptized, baptism_status, baptism_date, baptism_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31
      )
      RETURNING id
    `, [
      first_name?.trim(),
      last_name?.trim(),
      birthdate,
      gender || null,
      contact_email?.trim() || null,
      contact_phone?.trim() || null,
      household_id ? Number(household_id) : null,
      targetMinistryId ? Number(targetMinistryId) : null,
      status || "active",
      medical_notes?.trim() || null,
      grade_level?.trim() || null,
      address?.trim() || null,
      guardian_names?.trim() || null,
      guardian_phone?.trim() || null,
      invited_by?.trim() || null,
      school_name?.trim() || null,
      program_major?.trim() || null,
      class_schedule?.trim() || null,
      occupation?.trim() || null,
      hobbies?.trim() || null,
      previous_church?.trim() || null,
      facebook_account?.trim() || null,
      family_details?.trim() || null,
      application_date || null,
      civil_status || "Single",
      resolvedSpouseName || null,
      resolvedSpouseId || null,
      resolvedIsBaptized,
      resolvedBaptismStatus,
      baptism_date || null,
      baptism_notes?.trim() || null
    ]);

    const newId = result.lastInsertRowid;

    // Reciprocally update spouse if spouse_id was linked
    if (resolvedSpouseId) {
      await db.run(`
        UPDATE members 
        SET spouse_id = $1, 
            spouse_name = $2, 
            civil_status = 'Married'
        WHERE id = $3
      `, [newId, `${first_name} ${last_name}`, resolvedSpouseId]);
    }

    await logAuditAction(req.user?.id || null, "CREATE", "members", newId, `Created member ${first_name} ${last_name}`);

    emitRealtimeEvent("members:changed", { action: "create", id: newId });

    res.status(201).json({
      id: newId,
      message: "Member created successfully",
      ministry_id: targetMinistryId,
      spouse_id: resolvedSpouseId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update member
router.put("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const currentMember = await db.get("SELECT * FROM members WHERE id = $1", [id]);
    if (!currentMember) {
      return res.status(404).json({ error: "Member not found" });
    }

    const {
      first_name,
      last_name,
      birthdate,
      gender,
      contact_email,
      contact_phone,
      household_id,
      ministry_id,
      status,
      medical_notes,
      grade_level,
      address,
      guardian_names,
      guardian_phone,
      invited_by,
      school_name,
      program_major,
      class_schedule,
      occupation,
      hobbies,
      previous_church,
      facebook_account,
      family_details,
      application_date,
      civil_status,
      spouse_name,
      spouse_id,
      is_baptized,
      baptism_status,
      baptism_date,
      baptism_notes
    } = req.body;

    const effectiveFirstName = first_name !== undefined ? (first_name?.trim() || currentMember.first_name) : currentMember.first_name;
    const effectiveLastName = last_name !== undefined ? (last_name?.trim() || currentMember.last_name) : currentMember.last_name;

    if (first_name !== undefined && last_name !== undefined && effectiveFirstName && effectiveLastName) {
      const existingName = await db.get(
        "SELECT id, first_name, last_name FROM members WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) AND id != $3",
        [effectiveFirstName, effectiveLastName, id]
      );
      if (existingName) {
        return res.status(400).json({ error: `Another member named "${existingName.first_name} ${existingName.last_name}" already exists` });
      }
    }

    if (contact_email !== undefined && contact_email && contact_email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email.trim())) {
        return res.status(400).json({ error: "Invalid email address format" });
      }
      const existingEmail = await db.get(
        "SELECT id, first_name, last_name FROM members WHERE LOWER(contact_email) = LOWER($1) AND id != $2",
        [contact_email.trim(), id]
      );
      if (existingEmail) {
        return res.status(400).json({ error: `The email "${contact_email.trim()}" is already registered to ${existingEmail.first_name} ${existingEmail.last_name}` });
      }
    }

    if (contact_phone !== undefined && contact_phone && contact_phone.trim()) {
      const cleanPhone = contact_phone.replace(/\D/g, "");
      if (cleanPhone.length !== 11 || !cleanPhone.startsWith("09")) {
        return res.status(400).json({ error: "Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09123456789)" });
      }
    }

    if (guardian_phone !== undefined && guardian_phone && guardian_phone.trim()) {
      const cleanGPhone = guardian_phone.replace(/\D/g, "");
      if (cleanGPhone.length !== 11 || !cleanGPhone.startsWith("09")) {
        return res.status(400).json({ error: "Guardian contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09123456789)" });
      }
    }

    let resolvedSpouseId = spouse_id !== undefined ? (spouse_id ? Number(spouse_id) : null) : currentMember.spouse_id;
    let resolvedSpouseName = spouse_name !== undefined ? (spouse_name?.trim() || null) : currentMember.spouse_name;

    // Handle new partner registration during edit
    const { partner_record } = req.body;
    if (civil_status === "Married" && partner_record && partner_record.first_name?.trim()) {
      const juniorAdultMinistry = await db.get(
        "SELECT id FROM ministries WHERE LOWER(name) LIKE '%junior%' LIMIT 1"
      );
      const targetPartnerMinistryId = juniorAdultMinistry?.id || ministry_id || null;

      const partnerRes = await db.run(`
        INSERT INTO members (
          first_name, last_name, birthdate, gender, contact_email, contact_phone,
          household_id, ministry_id, status, medical_notes, grade_level,
          address, guardian_names, guardian_phone, invited_by, school_name,
          program_major, class_schedule, occupation, hobbies, previous_church,
          facebook_account, family_details, application_date, civil_status, spouse_name, spouse_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27
        )
        RETURNING id
      `, [
        partner_record.first_name.trim(),
        partner_record.last_name?.trim() || effectiveLastName,
        partner_record.birthdate || birthdate || "1990-01-01",
        partner_record.gender || (gender === "Male" ? "Female" : "Male"),
        partner_record.contact_email?.trim() || null,
        partner_record.contact_phone?.trim() || null,
        household_id ? Number(household_id) : null,
        targetPartnerMinistryId ? Number(targetPartnerMinistryId) : null,
        "active",
        partner_record.medical_notes?.trim() || null,
        null,
        partner_record.address?.trim() || (address?.trim() || null),
        null,
        null,
        partner_record.invited_by?.trim() || (invited_by?.trim() || null),
        null,
        null,
        null,
        partner_record.occupation?.trim() || null,
        partner_record.hobbies?.trim() || null,
        partner_record.previous_church?.trim() || (previous_church?.trim() || null),
        partner_record.facebook_account?.trim() || null,
        partner_record.family_details?.trim() || (family_details?.trim() || null),
        partner_record.application_date || application_date || null,
        "Married",
        `${effectiveFirstName} ${effectiveLastName}`,
        Number(id)
      ]);

      resolvedSpouseId = partnerRes.lastInsertRowid;
      resolvedSpouseName = `${partner_record.first_name} ${partner_record.last_name || effectiveLastName}`;
    }

    const valOrCurrent = (val: any, current: any, isString = true) => {
      if (val === undefined) return current;
      if (val === null) return null;
      if (isString && typeof val === "string") {
        const trimmed = val.trim();
        return trimmed === "" ? null : trimmed;
      }
      return val;
    };

    const resolvedIsBaptized = is_baptized !== undefined ? Boolean(is_baptized) : (baptism_status === "baptized" ? true : currentMember.is_baptized);
    const resolvedBaptismStatus = valOrCurrent(baptism_status, currentMember.baptism_status) || (resolvedIsBaptized ? "baptized" : "not_baptized");

    await db.run(`
      UPDATE members
      SET first_name = $1,
          last_name = $2,
          birthdate = $3,
          gender = $4,
          contact_email = $5,
          contact_phone = $6,
          household_id = $7,
          ministry_id = $8,
          status = $9,
          medical_notes = $10,
          grade_level = $11,
          address = $12,
          guardian_names = $13,
          guardian_phone = $14,
          invited_by = $15,
          school_name = $16,
          program_major = $17,
          class_schedule = $18,
          occupation = $19,
          hobbies = $20,
          previous_church = $21,
          facebook_account = $22,
          family_details = $23,
          application_date = $24,
          civil_status = $25,
          spouse_name = $26,
          spouse_id = $27,
          is_baptized = $28,
          baptism_status = $29,
          baptism_date = $30,
          baptism_notes = $31
      WHERE id = $32
    `, [
      effectiveFirstName,
      effectiveLastName,
      valOrCurrent(birthdate, currentMember.birthdate, false),
      valOrCurrent(gender, currentMember.gender),
      valOrCurrent(contact_email, currentMember.contact_email),
      valOrCurrent(contact_phone, currentMember.contact_phone),
      household_id !== undefined ? (household_id ? Number(household_id) : null) : currentMember.household_id,
      ministry_id !== undefined ? (ministry_id ? Number(ministry_id) : null) : currentMember.ministry_id,
      valOrCurrent(status, currentMember.status) || "active",
      valOrCurrent(medical_notes, currentMember.medical_notes),
      valOrCurrent(grade_level, currentMember.grade_level),
      valOrCurrent(address, currentMember.address),
      valOrCurrent(guardian_names, currentMember.guardian_names),
      valOrCurrent(guardian_phone, currentMember.guardian_phone),
      valOrCurrent(invited_by, currentMember.invited_by),
      valOrCurrent(school_name, currentMember.school_name),
      valOrCurrent(program_major, currentMember.program_major),
      valOrCurrent(class_schedule, currentMember.class_schedule),
      valOrCurrent(occupation, currentMember.occupation),
      valOrCurrent(hobbies, currentMember.hobbies),
      valOrCurrent(previous_church, currentMember.previous_church),
      valOrCurrent(facebook_account, currentMember.facebook_account),
      valOrCurrent(family_details, currentMember.family_details),
      valOrCurrent(application_date, currentMember.application_date, false),
      valOrCurrent(civil_status, currentMember.civil_status) || "Single",
      resolvedSpouseName,
      resolvedSpouseId,
      resolvedIsBaptized,
      resolvedBaptismStatus,
      valOrCurrent(baptism_date, currentMember.baptism_date, false),
      valOrCurrent(baptism_notes, currentMember.baptism_notes),
      id
    ]);

    // Reciprocally update or unlink spouse
    if (currentMember.spouse_id && currentMember.spouse_id !== resolvedSpouseId) {
      await db.run(
        "UPDATE members SET spouse_id = NULL, spouse_name = NULL, civil_status = 'Single' WHERE id = $1 AND spouse_id = $2",
        [currentMember.spouse_id, id]
      );
    }

    if (resolvedSpouseId) {
      await db.run(`
        UPDATE members 
        SET spouse_id = $1, 
            spouse_name = $2, 
            civil_status = 'Married'
        WHERE id = $3
      `, [id, `${effectiveFirstName} ${effectiveLastName}`, resolvedSpouseId]);
    }

    await logAuditAction(req.user?.id || null, "UPDATE", "members", Number(id), `Updated member #${id}`);

    emitRealtimeEvent("members:changed", { action: "update", id: Number(id) });

    res.json({ message: "Member updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Member Baptism Ceremony Status & Readiness
router.put("/:id/baptism", authMiddleware, requireRoles("Admin", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { baptism_status, is_baptized, baptism_date, baptism_notes } = req.body;

    const currentMember = await db.get("SELECT id, first_name, last_name FROM members WHERE id = $1", [id]);
    if (!currentMember) {
      return res.status(404).json({ error: "Member not found" });
    }

    const resolvedIsBaptized = is_baptized !== undefined ? is_baptized : (baptism_status === "baptized");

    await db.run(`
      UPDATE members
      SET baptism_status = $1,
          is_baptized = $2,
          baptism_date = $3,
          baptism_notes = $4
      WHERE id = $5
    `, [
      baptism_status || (resolvedIsBaptized ? "baptized" : "candidate"),
      resolvedIsBaptized,
      baptism_date || null,
      baptism_notes || null,
      id
    ]);

    await logAuditAction(
      req.user?.id || null,
      "UPDATE_BAPTISM",
      "members",
      id,
      `Updated baptism status for ${currentMember.first_name} ${currentMember.last_name}: ${baptism_status?.toUpperCase() || (resolvedIsBaptized ? "BAPTIZED" : "CANDIDATE")}`
    );

    emitRealtimeEvent("members:changed", { action: "update_baptism", id, baptism_status, is_baptized: resolvedIsBaptized });

    res.json({
      success: true,
      message: `Baptism status updated for ${currentMember.first_name} ${currentMember.last_name}!`,
      baptism_status: baptism_status || (resolvedIsBaptized ? "baptized" : "candidate"),
      is_baptized: resolvedIsBaptized
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete member
router.delete("/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM members WHERE id = $1", [id]);
    await logAuditAction(req.user?.id || null, "DELETE", "members", Number(id), `Deleted member #${id}`);

    emitRealtimeEvent("members:changed", { action: "delete", id: Number(id) });

    res.json({ message: "Member deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
