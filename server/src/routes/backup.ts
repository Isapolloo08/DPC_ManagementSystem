import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db, sql } from "../db/schema";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

// Require authenticated user
router.use(authMiddleware);

/**
 * Helper to verify current user's password
 */
async function verifyUserPassword(userId: number, passwordInput?: string): Promise<boolean> {
  if (!passwordInput || !passwordInput.trim()) return false;
  const user = await db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!user || !user.password_hash) return false;
  return await bcrypt.compare(passwordInput, user.password_hash);
}

/**
 * 1. GET /api/backup/summary
 * Returns database summary and yearly breakdown of transactional data
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    // 1. Overall table counts
    const [
      usersCount,
      membersCount,
      householdsCount,
      eventsCount,
      attendanceCount,
      donationsCount,
      fundsCount,
      groupsCount,
      dutySchedulesCount,
      dishwashingCount,
      announcementsCount,
      auditCount
    ] = await Promise.all([
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM users"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM members"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM households"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM events"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM attendance"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM donations"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM funds"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM bible_study_groups"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM duty_schedules"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM dishwashing_roster"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM announcements"),
      db.get<{ count: string }>("SELECT COUNT(*) as count FROM audit_logs")
    ]);

    const totalStats = {
      users: parseInt(usersCount?.count || "0", 10),
      members: parseInt(membersCount?.count || "0", 10),
      households: parseInt(householdsCount?.count || "0", 10),
      events: parseInt(eventsCount?.count || "0", 10),
      attendance: parseInt(attendanceCount?.count || "0", 10),
      donations: parseInt(donationsCount?.count || "0", 10),
      funds: parseInt(fundsCount?.count || "0", 10),
      bible_study_groups: parseInt(groupsCount?.count || "0", 10),
      duty_schedules: parseInt(dutySchedulesCount?.count || "0", 10),
      dishwashing_roster: parseInt(dishwashingCount?.count || "0", 10),
      announcements: parseInt(announcementsCount?.count || "0", 10),
      audit_logs: parseInt(auditCount?.count || "0", 10)
    };

    // 2. Discover all distinct years across date-bearing tables
    const yearsRows = await db.all<{ year: number }>(`
      SELECT DISTINCT year FROM (
        SELECT EXTRACT(YEAR FROM checked_in_at)::INT as year FROM attendance WHERE checked_in_at IS NOT NULL
        UNION
        SELECT EXTRACT(YEAR FROM donated_at)::INT as year FROM donations WHERE donated_at IS NOT NULL
        UNION
        SELECT EXTRACT(YEAR FROM start_time)::INT as year FROM events WHERE start_time IS NOT NULL
        UNION
        SELECT EXTRACT(YEAR FROM duty_date)::INT as year FROM duty_schedules WHERE duty_date IS NOT NULL
        UNION
        SELECT EXTRACT(YEAR FROM duty_date)::INT as year FROM dishwashing_roster WHERE duty_date IS NOT NULL
        UNION
        SELECT EXTRACT(YEAR FROM created_at)::INT as year FROM announcements WHERE created_at IS NOT NULL
        UNION
        SELECT EXTRACT(YEAR FROM created_at)::INT as year FROM members WHERE created_at IS NOT NULL
      ) all_years
      WHERE year IS NOT NULL AND year > 1900 AND year < 2100
      ORDER BY year DESC
    `);

    let yearsList = yearsRows.map(r => r.year);
    const currentYear = new Date().getFullYear();
    if (!yearsList.includes(currentYear)) {
      yearsList = [currentYear, ...yearsList];
    }

    // 3. For each year, fetch breakdown metrics
    const yearlyBreakdown = await Promise.all(
      yearsList.map(async (year) => {
        const [
          attRow,
          donRow,
          evtRow,
          dutyRow,
          dishRow,
          annRow,
          memRow
        ] = await Promise.all([
          db.get<{ count: string }>(
            "SELECT COUNT(*) as count FROM attendance WHERE EXTRACT(YEAR FROM checked_in_at) = $1",
            [year]
          ),
          db.get<{ count: string; total_amount: string }>(
            "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM donations WHERE EXTRACT(YEAR FROM donated_at) = $1",
            [year]
          ),
          db.get<{ count: string }>(
            "SELECT COUNT(*) as count FROM events WHERE EXTRACT(YEAR FROM start_time) = $1",
            [year]
          ),
          db.get<{ count: string }>(
            "SELECT COUNT(*) as count FROM duty_schedules WHERE EXTRACT(YEAR FROM duty_date) = $1",
            [year]
          ),
          db.get<{ count: string }>(
            "SELECT COUNT(*) as count FROM dishwashing_roster WHERE EXTRACT(YEAR FROM duty_date) = $1",
            [year]
          ),
          db.get<{ count: string }>(
            "SELECT COUNT(*) as count FROM announcements WHERE EXTRACT(YEAR FROM created_at) = $1",
            [year]
          ),
          db.get<{ count: string }>(
            "SELECT COUNT(*) as count FROM members WHERE EXTRACT(YEAR FROM created_at) = $1",
            [year]
          )
        ]);

        const attendance = parseInt(attRow?.count || "0", 10);
        const donationsCount = parseInt(donRow?.count || "0", 10);
        const donationsTotal = parseFloat(donRow?.total_amount || "0");
        const events = parseInt(evtRow?.count || "0", 10);
        const dutySchedules = parseInt(dutyRow?.count || "0", 10);
        const dishwashingRoster = parseInt(dishRow?.count || "0", 10);
        const announcements = parseInt(annRow?.count || "0", 10);
        const membersCreated = parseInt(memRow?.count || "0", 10);

        const totalRecords =
          attendance +
          donationsCount +
          events +
          dutySchedules +
          dishwashingRoster +
          announcements;

        return {
          year,
          totalRecords,
          attendance,
          donationsCount,
          donationsTotal,
          events,
          dutySchedules,
          dishwashingRoster,
          announcements,
          membersCreated
        };
      })
    );

    res.json({
      success: true,
      totalStats,
      yearlyBreakdown,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Backup summary error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch backup summary" });
  }
});

/**
 * 2. GET /api/backup/year-details/:year
 * Returns detailed table data previews for a specific year
 */
router.get("/year-details/:year", async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return res.status(400).json({ error: "Invalid year parameter" });
    }

    const [
      attendanceList,
      donationsList,
      eventsList,
      dutyList,
      dishwashingList,
      announcementsList,
      membersList
    ] = await Promise.all([
      db.all(`
        SELECT a.id, a.member_id, m.first_name || ' ' || m.last_name as member_name, 
               min.name as ministry_name, e.title as event_title, a.checked_in_at, a.checked_out_at, a.security_code, a.notes
        FROM attendance a
        LEFT JOIN members m ON a.member_id = m.id
        LEFT JOIN ministries min ON a.ministry_id = min.id
        LEFT JOIN events e ON a.event_id = e.id
        WHERE EXTRACT(YEAR FROM a.checked_in_at) = $1
        ORDER BY a.checked_in_at DESC
        LIMIT 100
      `, [year]),
      db.all(`
        SELECT d.id, d.amount, d.method, d.donated_at, d.notes,
               f.name as fund_name,
               m.first_name || ' ' || m.last_name as member_name
        FROM donations d
        LEFT JOIN funds f ON d.fund_id = f.id
        LEFT JOIN members m ON d.member_id = m.id
        WHERE EXTRACT(YEAR FROM d.donated_at) = $1
        ORDER BY d.donated_at DESC
        LIMIT 100
      `, [year]),
      db.all(`
        SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.location,
               min.name as ministry_name
        FROM events e
        LEFT JOIN ministries min ON e.ministry_id = min.id
        WHERE EXTRACT(YEAR FROM e.start_time) = $1
        ORDER BY e.start_time DESC
        LIMIT 100
      `, [year]),
      db.all(`
        SELECT s.id, s.duty_date, s.status, s.notes, t.name as team_name, min.name as ministry_name
        FROM duty_schedules s
        LEFT JOIN duty_teams t ON s.team_id = t.id
        LEFT JOIN ministries min ON s.ministry_id = min.id
        WHERE EXTRACT(YEAR FROM s.duty_date) = $1
        ORDER BY s.duty_date DESC
        LIMIT 100
      `, [year]),
      db.all(`
        SELECT r.id, r.duty_date, r.event_name, r.assigned_name, r.leader_name, r.status, r.volunteers_count, r.notes
        FROM dishwashing_roster r
        WHERE EXTRACT(YEAR FROM r.duty_date) = $1
        ORDER BY r.duty_date DESC
        LIMIT 100
      `, [year]),
      db.all(`
        SELECT a.id, a.title, a.body, a.is_pinned, a.created_at, u.name as author_name, min.name as ministry_name
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        LEFT JOIN ministries min ON a.ministry_id = min.id
        WHERE EXTRACT(YEAR FROM a.created_at) = $1
        ORDER BY a.created_at DESC
        LIMIT 100
      `, [year]),
      db.all(`
        SELECT m.id, m.first_name, m.last_name, m.gender, m.contact_email, m.contact_phone, m.status, m.created_at, min.name as ministry_name
        FROM members m
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE EXTRACT(YEAR FROM m.created_at) = $1
        ORDER BY m.created_at DESC
        LIMIT 100
      `, [year])
    ]);

    res.json({
      success: true,
      year,
      tables: {
        attendance: attendanceList,
        donations: donationsList,
        events: eventsList,
        duty_schedules: dutyList,
        dishwashing_roster: dishwashingList,
        announcements: announcementsList,
        members_created: membersList
      }
    });
  } catch (error: any) {
    console.error("Year details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch year details" });
  }
});

/**
 * 3. POST /api/backup/export
 * Exports full database or specific year snapshot as JSON with password verification
 */
router.post("/export", async (req: AuthRequest, res: Response) => {
  try {
    const { year, password } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user password
    const isPasswordValid = await verifyUserPassword(userId, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Incorrect account password. Authorization failed." });
    }

    const isYearSpecific = year && year !== "all" && !isNaN(Number(year));
    const targetYear = isYearSpecific ? Number(year) : null;

    const tables: Record<string, any[]> = {};

    if (!targetYear) {
      // FULL DATABASE BACKUP (No prayer_requests)
      const [
        roles,
        ministries,
        system_lookups,
        system_settings,
        users,
        user_ministries,
        households,
        members,
        funds,
        donations,
        events,
        event_registrations,
        attendance,
        announcements,
        bible_study_topics,
        bible_study_groups,
        bible_study_members,
        duty_teams,
        duty_team_members,
        duty_schedules,
        dishwashing_roster,
        audit_logs
      ] = await Promise.all([
        db.all("SELECT * FROM roles ORDER BY id ASC"),
        db.all("SELECT * FROM ministries ORDER BY id ASC"),
        db.all("SELECT * FROM system_lookups ORDER BY id ASC"),
        db.all("SELECT * FROM system_settings ORDER BY key ASC"),
        db.all("SELECT id, name, username, email, password_hash, role_id, created_at FROM users ORDER BY id ASC"),
        db.all("SELECT * FROM user_ministries ORDER BY id ASC"),
        db.all("SELECT * FROM households ORDER BY id ASC"),
        db.all("SELECT * FROM members ORDER BY id ASC"),
        db.all("SELECT * FROM funds ORDER BY id ASC"),
        db.all("SELECT * FROM donations ORDER BY id ASC"),
        db.all("SELECT * FROM events ORDER BY id ASC"),
        db.all("SELECT * FROM event_registrations ORDER BY id ASC"),
        db.all("SELECT * FROM attendance ORDER BY id ASC"),
        db.all("SELECT * FROM announcements ORDER BY id ASC"),
        db.all("SELECT * FROM bible_study_topics ORDER BY id ASC"),
        db.all("SELECT * FROM bible_study_groups ORDER BY id ASC"),
        db.all("SELECT * FROM bible_study_members ORDER BY id ASC"),
        db.all("SELECT * FROM duty_teams ORDER BY id ASC"),
        db.all("SELECT * FROM duty_team_members ORDER BY id ASC"),
        db.all("SELECT * FROM duty_schedules ORDER BY id ASC"),
        db.all("SELECT * FROM dishwashing_roster ORDER BY id ASC"),
        db.all("SELECT * FROM audit_logs ORDER BY id ASC LIMIT 5000")
      ]);

      tables.roles = roles;
      tables.ministries = ministries;
      tables.system_lookups = system_lookups;
      tables.system_settings = system_settings;
      tables.users = users;
      tables.user_ministries = user_ministries;
      tables.households = households;
      tables.members = members;
      tables.funds = funds;
      tables.donations = donations;
      tables.events = events;
      tables.event_registrations = event_registrations;
      tables.attendance = attendance;
      tables.announcements = announcements;
      tables.bible_study_topics = bible_study_topics;
      tables.bible_study_groups = bible_study_groups;
      tables.bible_study_members = bible_study_members;
      tables.duty_teams = duty_teams;
      tables.duty_team_members = duty_team_members;
      tables.duty_schedules = duty_schedules;
      tables.dishwashing_roster = dishwashing_roster;
      tables.audit_logs = audit_logs;
    } else {
      // YEAR SPECIFIC BACKUP
      const [
        events,
        event_registrations,
        attendance,
        donations,
        duty_schedules,
        dishwashing_roster,
        announcements,
        members_in_year
      ] = await Promise.all([
        db.all("SELECT * FROM events WHERE EXTRACT(YEAR FROM start_time) = $1 ORDER BY id ASC", [targetYear]),
        db.all(`
          SELECT er.* FROM event_registrations er
          JOIN events e ON er.event_id = e.id
          WHERE EXTRACT(YEAR FROM e.start_time) = $1
          ORDER BY er.id ASC
        `, [targetYear]),
        db.all("SELECT * FROM attendance WHERE EXTRACT(YEAR FROM checked_in_at) = $1 ORDER BY id ASC", [targetYear]),
        db.all("SELECT * FROM donations WHERE EXTRACT(YEAR FROM donated_at) = $1 ORDER BY id ASC", [targetYear]),
        db.all("SELECT * FROM duty_schedules WHERE EXTRACT(YEAR FROM duty_date) = $1 ORDER BY id ASC", [targetYear]),
        db.all("SELECT * FROM dishwashing_roster WHERE EXTRACT(YEAR FROM duty_date) = $1 ORDER BY id ASC", [targetYear]),
        db.all("SELECT * FROM announcements WHERE EXTRACT(YEAR FROM created_at) = $1 ORDER BY id ASC", [targetYear]),
        db.all("SELECT * FROM members WHERE EXTRACT(YEAR FROM created_at) = $1 ORDER BY id ASC", [targetYear])
      ]);

      tables.events = events;
      tables.event_registrations = event_registrations;
      tables.attendance = attendance;
      tables.donations = donations;
      tables.duty_schedules = duty_schedules;
      tables.dishwashing_roster = dishwashing_roster;
      tables.announcements = announcements;
      tables.members = members_in_year;
    }

    const rowCounts: Record<string, number> = {};
    let totalRowCount = 0;
    for (const [tName, tRows] of Object.entries(tables)) {
      rowCounts[tName] = tRows.length;
      totalRowCount += tRows.length;
    }

    const backupPayload = {
      system: "DPC-ManagementSystem",
      version: "1.0",
      backupType: targetYear ? `Year_${targetYear}` : "Full_Database",
      targetYear: targetYear || "ALL",
      createdAt: new Date().toISOString(),
      exportedBy: req.user?.name || "System User",
      totalRows: totalRowCount,
      tableCounts: rowCounts,
      data: tables
    };

    // Log audit
    await db.all(
      "INSERT INTO audit_logs (user_id, action, target_table, target_id, details) VALUES ($1, $2, $3, $4, $5)",
      [
        req.user?.id || null,
        "BACKUP_EXPORT",
        "system",
        targetYear || 0,
        `Exported ${backupPayload.backupType} backup (${totalRowCount} records)`
      ]
    );

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dpc_backup_${targetYear ? targetYear : 'full'}_${Date.now()}.json"`
    );
    res.json(backupPayload);
  } catch (error: any) {
    console.error("Backup export error:", error);
    res.status(500).json({ error: error.message || "Failed to generate backup export" });
  }
});

/**
 * 4. POST /api/backup/preview
 * Analyzes uploaded backup JSON before restoring
 */
router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid backup file structure" });
    }

    const backupData = data.data || data;
    const tableCounts: Record<string, number> = {};
    let totalRows = 0;

    const knownTables = [
      "roles", "ministries", "system_lookups", "system_settings", "users",
      "user_ministries", "households", "members", "funds", "donations",
      "events", "event_registrations", "attendance", "announcements",
      "bible_study_topics", "bible_study_groups",
      "bible_study_members", "duty_teams", "duty_team_members",
      "duty_schedules", "dishwashing_roster", "audit_logs"
    ];

    const samplePreviews: Record<string, any[]> = {};

    for (const tbl of knownTables) {
      if (Array.isArray(backupData[tbl])) {
        const count = backupData[tbl].length;
        tableCounts[tbl] = count;
        totalRows += count;
        samplePreviews[tbl] = backupData[tbl].slice(0, 5); // top 5 rows sample
      }
    }

    res.json({
      success: true,
      system: data.system || "Unknown",
      backupType: data.backupType || "Database_Payload",
      targetYear: data.targetYear || "Unknown",
      createdAt: data.createdAt || new Date().toISOString(),
      exportedBy: data.exportedBy || "Unknown",
      totalRows,
      tableCounts,
      samplePreviews
    });
  } catch (error: any) {
    console.error("Backup preview error:", error);
    res.status(500).json({ error: error.message || "Failed to inspect backup file" });
  }
});

/**
 * 5. POST /api/backup/restore
 * Restores database from uploaded backup JSON with password verification
 */
router.post("/restore", async (req: AuthRequest, res: Response) => {
  try {
    const { data, mode = "replace", password } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user password
    const isPasswordValid = await verifyUserPassword(userId, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Incorrect account password. Restore authorization failed." });
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid backup payload" });
    }

    const payload = data.data || data;
    const restoredCounts: Record<string, number> = {};

    // Execute in PostgreSQL transaction with correct insertion order
    await sql.begin(async (tx) => {
      // If mode is 'replace', truncate transactional and master tables safely
      if (mode === "replace") {
        await tx.unsafe(`
          TRUNCATE TABLE 
            attendance,
            donations,
            funds,
            event_registrations,
            events,
            announcements,
            bible_study_members,
            bible_study_topics,
            bible_study_groups,
            duty_team_members,
            duty_schedules,
            duty_teams,
            dishwashing_roster,
            members,
            households,
            user_ministries,
            audit_logs
          RESTART IDENTITY CASCADE;
        `);
      }

      // Helper function to insert rows for a table safely with conflict handling
      const insertRows = async (tableName: string, rows: any[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return 0;
        
        let count = 0;
        for (const row of rows) {
          const keys = Object.keys(row).filter(k => row[k] !== undefined);
          if (keys.length === 0) continue;

          const columns = keys.map(k => `"${k}"`).join(", ");
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const values = keys.map(k => row[k]);

          let conflictClause = "ON CONFLICT DO NOTHING";

          if (tableName === "system_settings") {
            const updateCols = keys.filter(k => k !== "key");
            if (updateCols.length > 0) {
              conflictClause = `ON CONFLICT ("key") DO UPDATE SET ${updateCols.map(k => `"${k}" = EXCLUDED."${k}"`).join(", ")}`;
            } else {
              conflictClause = `ON CONFLICT ("key") DO NOTHING`;
            }
          } else if (mode === "replace" && row.id !== undefined && ["roles", "ministries", "system_lookups", "users"].includes(tableName)) {
            // For master tables that aren't truncated during replace, update matching ID
            const updateCols = keys.filter(k => k !== "id");
            if (updateCols.length > 0) {
              conflictClause = `ON CONFLICT ("id") DO UPDATE SET ${updateCols.map(k => `"${k}" = EXCLUDED."${k}"`).join(", ")}`;
            } else {
              conflictClause = `ON CONFLICT ("id") DO NOTHING`;
            }
          } else {
            conflictClause = `ON CONFLICT DO NOTHING`;
          }

          try {
            await tx.unsafe(
              `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders}) ${conflictClause};`,
              values
            );
            count++;
          } catch (rowErr: any) {
            // Fallback: If ON CONFLICT (id) failed due to a secondary unique constraint (e.g. username/email/name),
            // retry with general ON CONFLICT DO NOTHING to ensure restore completes without throwing
            try {
              await tx.unsafe(
                `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`,
                values
              );
              count++;
            } catch (ignoreErr) {
              console.warn(`[RESTORE] Skipped duplicate/incompatible row for table ${tableName}:`, ignoreErr);
            }
          }
        }
        return count;
      };

      // Ordered restoration for foreign key compliance
      const restoreOrder = [
        "roles",
        "ministries",
        "system_lookups",
        "system_settings",
        "users",
        "user_ministries",
        "households",
        "members",
        "funds",
        "donations",
        "events",
        "event_registrations",
        "attendance",
        "announcements",
        "bible_study_topics",
        "bible_study_groups",
        "bible_study_members",
        "duty_teams",
        "duty_team_members",
        "duty_schedules",
        "dishwashing_roster",
        "audit_logs"
      ];

      for (const table of restoreOrder) {
        if (payload[table] && Array.isArray(payload[table])) {
          const inserted = await insertRows(table, payload[table]);
          restoredCounts[table] = inserted;
        }
      }

      // Synchronize all sequence counters
      const sequenceTables = [
        "roles", "ministries", "system_lookups", "users", "user_ministries",
        "households", "members", "funds", "donations", "events",
        "event_registrations", "attendance", "announcements",
        "bible_study_topics", "bible_study_groups", "bible_study_members",
        "duty_teams", "duty_team_members", "duty_schedules", "dishwashing_roster",
        "audit_logs"
      ];

      for (const t of sequenceTables) {
        try {
          await tx.unsafe(`
            SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1));
          `);
        } catch {
          // ignore tables without serial PKs
        }
      }
    });

    // Log restore audit
    await db.all(
      "INSERT INTO audit_logs (user_id, action, target_table, target_id, details) VALUES ($1, $2, $3, $4, $5)",
      [
        req.user?.id || null,
        "BACKUP_RESTORE",
        "database",
        0,
        `Restored database in ${mode} mode. Tables restored: ${Object.keys(restoredCounts).length}`
      ]
    );

    emitRealtimeEvent("settings:changed", { action: "restore" });
    emitRealtimeEvent("members:changed", { action: "restore" });
    emitRealtimeEvent("attendance:changed", { action: "restore" });
    emitRealtimeEvent("finance:changed", { action: "restore" });
    emitRealtimeEvent("duty:changed", { action: "restore" });
    emitRealtimeEvent("dishwashing:changed", { action: "restore" });

    res.json({
      success: true,
      message: `Database restored successfully (${mode} mode)!`,
      restoredCounts
    });
  } catch (error: any) {
    console.error("Backup restore error:", error);
    res.status(500).json({ error: error.message || "Failed to restore database from backup" });
  }
});

/**
 * 6. POST /api/backup/delete-by-year
 * Deletes transactional records for a specific year with password verification
 */
router.post("/delete-by-year", async (req: AuthRequest, res: Response) => {
  try {
    const { year, confirmYear, password } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user password
    const isPasswordValid = await verifyUserPassword(userId, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Incorrect account password. Deletion authorization failed." });
    }

    const targetYear = parseInt(year, 10);

    if (isNaN(targetYear) || targetYear < 1900 || targetYear > 2100) {
      return res.status(400).json({ error: "Invalid year parameter for deletion" });
    }

    if (parseInt(confirmYear, 10) !== targetYear) {
      return res.status(400).json({ error: "Confirmation year does not match target year" });
    }

    const deletedCounts: Record<string, number> = {};

    await sql.begin(async (tx) => {
      // 1. Attendance for year
      const attResult = await tx.unsafe(
        "DELETE FROM attendance WHERE EXTRACT(YEAR FROM checked_in_at) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.attendance = attResult.length;

      // 2. Donations for year
      const donResult = await tx.unsafe(
        "DELETE FROM donations WHERE EXTRACT(YEAR FROM donated_at) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.donations = donResult.length;

      // 3. Duty schedules for year
      const dutyResult = await tx.unsafe(
        "DELETE FROM duty_schedules WHERE EXTRACT(YEAR FROM duty_date) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.duty_schedules = dutyResult.length;

      // 4. Dishwashing roster for year
      const dishResult = await tx.unsafe(
        "DELETE FROM dishwashing_roster WHERE EXTRACT(YEAR FROM duty_date) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.dishwashing_roster = dishResult.length;

      // 5. Event registrations for events in target year
      const evtRegResult = await tx.unsafe(`
        DELETE FROM event_registrations 
        WHERE event_id IN (
          SELECT id FROM events WHERE EXTRACT(YEAR FROM start_time) = $1
        )
        RETURNING id
      `, [targetYear]);
      deletedCounts.event_registrations = evtRegResult.length;

      // 6. Events in target year
      const evtResult = await tx.unsafe(
        "DELETE FROM events WHERE EXTRACT(YEAR FROM start_time) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.events = evtResult.length;

      // 7. Announcements in target year
      const annResult = await tx.unsafe(
        "DELETE FROM announcements WHERE EXTRACT(YEAR FROM created_at) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.announcements = annResult.length;

      // 8. Audit logs in target year
      const auditResult = await tx.unsafe(
        "DELETE FROM audit_logs WHERE EXTRACT(YEAR FROM created_at) = $1 RETURNING id",
        [targetYear]
      );
      deletedCounts.audit_logs = auditResult.length;
    });

    // Log deletion in audit trail
    await db.all(
      "INSERT INTO audit_logs (user_id, action, target_table, target_id, details) VALUES ($1, $2, $3, $4, $5)",
      [
        req.user?.id || null,
        "PURGE_YEAR_DATA",
        "database",
        targetYear,
        `Purged transactional records for year ${targetYear}. Deleted: ${JSON.stringify(deletedCounts)}`
      ]
    );

    emitRealtimeEvent("attendance:changed", { action: "purge_year", year: targetYear });
    emitRealtimeEvent("finance:changed", { action: "purge_year", year: targetYear });
    emitRealtimeEvent("duty:changed", { action: "purge_year", year: targetYear });
    emitRealtimeEvent("dishwashing:changed", { action: "purge_year", year: targetYear });
    emitRealtimeEvent("communications:changed", { action: "purge_year", year: targetYear });

    res.json({
      success: true,
      message: `Successfully purged all records for year ${targetYear}!`,
      deletedCounts
    });
  } catch (error: any) {
    console.error("Purge year error:", error);
    res.status(500).json({ error: error.message || "Failed to purge year records" });
  }
});

export default router;
