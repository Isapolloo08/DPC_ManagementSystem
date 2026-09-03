"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const ministries_1 = require("./ministries");
const router = (0, express_1.Router)();
function calculateBirthdayDetails(birthdateStr) {
    if (!birthdateStr)
        return null;
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
// Get list of members with search and filter
router.get("/", async (req, res) => {
    try {
        const { ministry_id, household_id, status, search } = req.query;
        let query = `
      SELECT m.*, 
             min.name as ministry_name, min.color as ministry_color, min.min_age, min.max_age,
             h.name as household_name, h.primary_contact_phone as household_phone,
             u.email as user_email
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE 1=1
    `;
        const params = [];
        if (ministry_id) {
            params.push(ministry_id);
            query += ` AND m.ministry_id = $${params.length}`;
        }
        if (household_id) {
            params.push(household_id);
            query += ` AND m.household_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND m.status = $${params.length}`;
        }
        if (search && typeof search === "string") {
            params.push(`%${search}%`);
            const pIdx = params.length;
            query += ` AND (m.first_name ILIKE $${pIdx} OR m.last_name ILIKE $${pIdx} OR m.contact_email ILIKE $${pIdx} OR m.contact_phone ILIKE $${pIdx})`;
        }
        query += " ORDER BY m.last_name ASC, m.first_name ASC";
        const members = await schema_1.db.all(query, params);
        // Attach calculated age, aging-out flag, and birthday calculation
        const enriched = members.map(m => {
            const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
            const age = (0, ministries_1.calculateAge)(birthdateStr);
            const isAgingOut = m.max_age !== null && age > m.max_age;
            const bday = calculateBirthdayDetails(birthdateStr);
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
                next_birthday_date: bday?.next_birthday_date
            };
        });
        res.json(enriched);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get upcoming birthday celebrants
router.get("/birthdays", async (req, res) => {
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
        const params = [];
        if (ministry_id) {
            params.push(ministry_id);
            query += ` AND m.ministry_id = $${params.length}`;
        }
        const members = await schema_1.db.all(query, params);
        const enriched = members
            .map(m => {
            const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
            const bday = calculateBirthdayDetails(birthdateStr);
            if (!bday)
                return null;
            return { ...m, birthdate: birthdateStr, ...bday };
        })
            .filter(Boolean);
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
        }
        else if (timeframe === "this_week") {
            filtered = filtered.filter(m => m.is_this_week);
        }
        else if (timeframe === "this_month") {
            filtered = filtered.filter(m => m.is_this_month);
        }
        else if (timeframe === "next_30_days") {
            filtered = filtered.filter(m => m.days_until_birthday <= 30);
        }
        filtered.sort((a, b) => a.days_until_birthday - b.days_until_birthday);
        res.json({
            celebrants: filtered,
            counts,
            monthly_distribution: monthlyDistribution
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Send birthday greeting
router.post("/:id/birthday-greeting", auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const member = await schema_1.db.get(`
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
        let announcementId;
        if (channel === "announcement") {
            const authorId = req.user?.id || 1;
            const result = await schema_1.db.run(`
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
        await (0, auth_1.logAuditAction)(req.user?.id || null, "CREATE", "members", Number(id), `Sent birthday blessing greeting to ${member.first_name} ${member.last_name}`);
        res.json({
            message: "Birthday greeting sent successfully!",
            blessing: greetingText,
            announcement_id: announcementId
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get members aging out of their current ministry
router.get("/aging-out", async (req, res) => {
    try {
        const members = await schema_1.db.all(`
      SELECT m.*, 
             min.name as current_ministry_name, min.max_age as current_max_age,
             h.name as household_name
      FROM members m
      JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.status = 'active' AND min.max_age IS NOT NULL
    `);
        const ministries = await schema_1.db.all("SELECT * FROM ministries ORDER BY min_age ASC");
        const agingOutList = members
            .map(m => {
            const birthdateStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
            const age = (0, ministries_1.calculateAge)(birthdateStr);
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get specific member
router.get("/:id", async (req, res) => {
    try {
        const member = await schema_1.db.get(`
      SELECT m.*, 
             min.name as ministry_name, min.color as ministry_color, min.min_age, min.max_age,
             h.name as household_name, h.address as household_address, h.primary_contact_phone as household_phone
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.id = $1
    `, [req.params.id]);
        if (!member) {
            return res.status(404).json({ error: "Member not found" });
        }
        const birthdateStr = member.birthdate ? (typeof member.birthdate === "string" ? member.birthdate : new Date(member.birthdate).toISOString().split("T")[0]) : "";
        const age = (0, ministries_1.calculateAge)(birthdateStr);
        member.birthdate = birthdateStr;
        member.age = age;
        member.is_aging_out = member.max_age !== null && age > member.max_age;
        // Fetch household family members
        let familyMembers = [];
        if (member.household_id) {
            familyMembers = await schema_1.db.all(`
        SELECT id, first_name, last_name, birthdate, ministry_id
        FROM members
        WHERE household_id = $1 AND id != $2
      `, [member.household_id, member.id]);
        }
        // Fetch recent attendance
        const attendanceHistory = await schema_1.db.all(`
      SELECT a.*, e.title as event_title, min.name as ministry_name
      FROM attendance a
      LEFT JOIN events e ON a.event_id = e.id
      LEFT JOIN ministries min ON a.ministry_id = min.id
      WHERE a.member_id = $1
      ORDER BY a.checked_in_at DESC
      LIMIT 10
    `, [member.id]);
        // Fetch giving history
        const donations = await schema_1.db.all(`
      SELECT d.*, f.name as fund_name
      FROM donations d
      JOIN funds f ON d.fund_id = f.id
      WHERE d.member_id = $1
      ORDER BY d.donated_at DESC
    `, [member.id]);
        res.json({
            ...member,
            family_members: familyMembers,
            attendance_history: attendanceHistory,
            donations
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create new member
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { first_name, last_name, birthdate, gender, contact_email, contact_phone, household_id, ministry_id, status = "active", medical_notes, grade_level, address, guardian_names, guardian_phone, invited_by, school_name, program_major, class_schedule, occupation, hobbies, previous_church, facebook_account, family_details, application_date } = req.body;
        if (!first_name || !last_name || !birthdate) {
            return res.status(400).json({ error: "First name, last name, and birthdate are required" });
        }
        let targetMinistryId = ministry_id;
        if (!targetMinistryId) {
            const age = (0, ministries_1.calculateAge)(birthdate);
            const ministries = await schema_1.db.all("SELECT * FROM ministries ORDER BY min_age ASC");
            const match = ministries.find(m => {
                const min = m.min_age ?? 0;
                const max = m.max_age ?? 999;
                return age >= min && age <= max;
            });
            targetMinistryId = match ? match.id : (ministries[ministries.length - 1]?.id || null);
        }
        const result = await schema_1.db.run(`
      INSERT INTO members (
        first_name, last_name, birthdate, gender, contact_email, contact_phone,
        household_id, ministry_id, status, medical_notes, grade_level,
        address, guardian_names, guardian_phone, invited_by, school_name,
        program_major, class_schedule, occupation, hobbies, previous_church,
        facebook_account, family_details, application_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24
      )
      RETURNING id
    `, [
            first_name,
            last_name,
            birthdate,
            gender || null,
            contact_email || null,
            contact_phone || null,
            household_id || null,
            targetMinistryId,
            status,
            medical_notes || null,
            grade_level || null,
            address || null,
            guardian_names || null,
            guardian_phone || null,
            invited_by || null,
            school_name || null,
            program_major || null,
            class_schedule || null,
            occupation || null,
            hobbies || null,
            previous_church || null,
            facebook_account || null,
            family_details || null,
            application_date || null
        ]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user?.id || null, "CREATE", "members", newId, `Created member ${first_name} ${last_name}`);
        res.status(201).json({ id: newId, message: "Member created successfully", ministry_id: targetMinistryId });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update member
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const id = req.params.id;
        const { first_name, last_name, birthdate, gender, contact_email, contact_phone, household_id, ministry_id, status, medical_notes, grade_level, address, guardian_names, guardian_phone, invited_by, school_name, program_major, class_schedule, occupation, hobbies, previous_church, facebook_account, family_details, application_date } = req.body;
        await schema_1.db.run(`
      UPDATE members
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          birthdate = COALESCE($3, birthdate),
          gender = COALESCE($4, gender),
          contact_email = COALESCE($5, contact_email),
          contact_phone = COALESCE($6, contact_phone),
          household_id = COALESCE($7, household_id),
          ministry_id = COALESCE($8, ministry_id),
          status = COALESCE($9, status),
          medical_notes = COALESCE($10, medical_notes),
          grade_level = COALESCE($11, grade_level),
          address = COALESCE($12, address),
          guardian_names = COALESCE($13, guardian_names),
          guardian_phone = COALESCE($14, guardian_phone),
          invited_by = COALESCE($15, invited_by),
          school_name = COALESCE($16, school_name),
          program_major = COALESCE($17, program_major),
          class_schedule = COALESCE($18, class_schedule),
          occupation = COALESCE($19, occupation),
          hobbies = COALESCE($20, hobbies),
          previous_church = COALESCE($21, previous_church),
          facebook_account = COALESCE($22, facebook_account),
          family_details = COALESCE($23, family_details),
          application_date = COALESCE($24, application_date)
      WHERE id = $25
    `, [
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
            id
        ]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "UPDATE", "members", Number(id), `Updated member #${id}`);
        res.json({ message: "Member updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete member
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const id = req.params.id;
        await schema_1.db.run("DELETE FROM members WHERE id = $1", [id]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "DELETE", "members", Number(id), `Deleted member #${id}`);
        res.json({ message: "Member deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
