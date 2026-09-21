import { Router, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, logAuditAction } from "../middleware/auth";

const router = Router();

// Helper to escape special ILIKE wildcards
function escapeIlikeWildcards(str: string): string {
  return str.replace(/([%_\\])/g, "\\$1");
}

// Auto-healing migration to guarantee attendance_log view contains event_id column
export async function ensureAttendanceLogViewWithEventId(): Promise<void> {
  try {
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_bs_att_member_date ON bible_study_attendance(member_id, session_date);
      CREATE INDEX IF NOT EXISTS idx_bs_att_group_date ON bible_study_attendance(group_id, session_date);
      CREATE INDEX IF NOT EXISTS idx_attendance_member_checked_in ON attendance(member_id, checked_in_at);

      DROP VIEW IF EXISTS attendance_log CASCADE;

      CREATE VIEW attendance_log AS
      SELECT
        'sunday_service'::VARCHAR(50) AS log_type,
        a.member_id,
        (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
        'present'::VARCHAR(20) AS status,
        NULL::INT AS group_id,
        NULL::INT AS event_id,
        a.checked_in_at AS recorded_at
      FROM attendance a
      WHERE a.event_id IS NULL

      UNION ALL

      SELECT
        'event'::VARCHAR(50) AS log_type,
        a.member_id,
        (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
        'present'::VARCHAR(20) AS status,
        NULL::INT AS group_id,
        a.event_id AS event_id,
        a.checked_in_at AS recorded_at
      FROM attendance a
      WHERE a.event_id IS NOT NULL

      UNION ALL

      SELECT
        'event'::VARCHAR(50) AS log_type,
        er.member_id,
        (COALESCE(e.start_time, er.created_at) AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
        'present'::VARCHAR(20) AS status,
        NULL::INT AS group_id,
        er.event_id AS event_id,
        er.created_at AS recorded_at
      FROM event_registrations er
      JOIN events e ON er.event_id = e.id
      WHERE er.status = 'attended'
        AND NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.event_id = er.event_id AND a.member_id = er.member_id
        )

      UNION ALL

      SELECT
        'bible_study'::VARCHAR(50) AS log_type,
        bsa.member_id,
        bsa.session_date AS log_date,
        bsa.status::VARCHAR(20) AS status,
        bsa.group_id,
        NULL::INT AS event_id,
        bsa.created_at AS recorded_at
      FROM bible_study_attendance bsa;
    `);
    console.log("✅ PostgreSQL attendance_log view upgraded with event_id column support.");
  } catch (err: any) {
    console.warn("Notice during attendance_log view upgrade:", err?.message);
  }
}

// Helper to calculate Asia/Manila current date and past 90 days default
function getDefaultDateRange(): { fromDate: string; toDate: string } {
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const now = new Date(today);
    const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(past90);
    return { fromDate: from, toDate: today };
  } catch {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { fromDate: past90, toDate: today };
  }
}

// Build SQL conditions and parameters for attendance log based on filters and RBAC
async function buildAttendanceLogQuery(
  user: { id: number; role_name: string; name: string; ministry_ids: number[] },
  query: Record<string, any>
): Promise<{ whereSql: string; params: any[]; emptyResult: boolean }> {
  const {
    from,
    to,
    type,
    status,
    ministryId,
    groupId,
    eventId,
    memberId,
    search
  } = query;

  const defaultDates = getDefaultDateRange();
  const filterFrom = typeof from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultDates.fromDate;
  const filterTo = typeof to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultDates.toDate;

  const conditions: string[] = [];
  const params: any[] = [];

  // Date range (inclusive)
  params.push(filterFrom);
  conditions.push(`v.log_date >= $${params.length}`);

  params.push(filterTo);
  conditions.push(`v.log_date <= $${params.length}`);

  // Type filter: sunday_service | bible_study | event
  if (type && (type === "sunday_service" || type === "bible_study" || type === "event")) {
    params.push(type);
    conditions.push(`v.log_type = $${params.length}`);
  }

  // Status filter: present | absent | excused
  if (status && ["present", "absent", "excused"].includes(String(status).toLowerCase())) {
    params.push(String(status).toLowerCase());
    conditions.push(`v.status = $${params.length}`);
  }

  // Ministry filter
  if (ministryId && !isNaN(Number(ministryId))) {
    params.push(Number(ministryId));
    conditions.push(`m.ministry_id = $${params.length}`);
  }

  // Bible Study Group filter
  if (groupId && !isNaN(Number(groupId))) {
    params.push(Number(groupId));
    conditions.push(`v.group_id = $${params.length}`);
  }

  // Event ID filter
  if (eventId && !isNaN(Number(eventId))) {
    params.push(Number(eventId));
    conditions.push(`v.event_id = $${params.length}`);
  }

  // Member ID filter
  if (memberId && !isNaN(Number(memberId))) {
    params.push(Number(memberId));
    conditions.push(`v.member_id = $${params.length}`);
  }

  // Search by member name
  if (search && typeof search === "string" && search.trim()) {
    const escaped = escapeIlikeWildcards(search.trim());
    params.push(`%${escaped}%`);
    conditions.push(`(m.first_name || ' ' || m.last_name) ILIKE $${params.length}`);
  }

  // RBAC SQL Enforcement
  if (user.role_name === "Admin") {
    // Admin has unrestricted access
  } else if (user.role_name === "Coordinator") {
    // Coordinator can only see members in their assigned ministries
    if (!user.ministry_ids || user.ministry_ids.length === 0) {
      return { whereSql: "", params: [], emptyResult: true };
    }
    params.push(user.ministry_ids);
    conditions.push(`m.ministry_id = ANY($${params.length}::int[])`);
  } else if (user.role_name === "Leader") {
    // Leader can only see Bible Study attendance for groups they lead
    // Match leader by user name or linked member name
    const leaderUserGroups = await db.all<{ id: number }>(`
      SELECT id FROM bible_study_groups
      WHERE leader_name ILIKE $1
         OR leader_name ILIKE (
           SELECT TRIM(first_name || ' ' || last_name) FROM members WHERE user_id = $2 LIMIT 1
         )
    `, [user.name, user.id]);

    const ledGroupIds = leaderUserGroups.map(g => g.id);
    if (ledGroupIds.length === 0) {
      return { whereSql: "", params: [], emptyResult: true };
    }

    // Leader only views Bible Study logs for their groups
    conditions.push(`v.log_type = 'bible_study'`);
    params.push(ledGroupIds);
    conditions.push(`v.group_id = ANY($${params.length}::int[])`);
  } else {
    // Other roles have no access (handled via 403 prior to query, but safe fallback)
    return { whereSql: "", params: [], emptyResult: true };
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereSql, params, emptyResult: false };
}

// 1. GET /api/attendance-log — Paginated attendance logs with summary statistics
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // RBAC: Only Admin, Coordinator, and Leader are allowed
    if (!["Admin", "Coordinator", "Leader"].includes(user.role_name)) {
      return res.status(403).json({ error: "Access denied. You do not have permission to view attendance logs." });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(5000, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50));
    const offset = (page - 1) * pageSize;

    const { whereSql, params, emptyResult } = await buildAttendanceLogQuery(user, req.query);

    if (emptyResult) {
      return res.json({
        rows: [],
        total: 0,
        page,
        pageSize,
        summary: {
          total: 0,
          present: 0,
          absent: 0,
          excused: 0
        }
      });
    }

    // Summary statistics query across all filtered records
    const summaryQuery = `
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE v.status = 'present')::INT AS present,
        COUNT(*) FILTER (WHERE v.status = 'absent')::INT AS absent,
        COUNT(*) FILTER (WHERE v.status = 'excused')::INT AS excused
      FROM attendance_log v
      JOIN members m ON v.member_id = m.id
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN bible_study_groups bg ON v.group_id = bg.id
      ${whereSql}
    `;

    // Paginated rows query
    const dataParams = [...params, pageSize, offset];
    const dataQuery = `
      SELECT
        v.log_type AS "logType",
        to_char(v.log_date, 'YYYY-MM-DD') AS "logDate",
        v.member_id AS "memberId",
        TRIM(m.first_name || ' ' || m.last_name) AS "memberName",
        m.ministry_id AS "ministryId",
        COALESCE(min.name, 'Unassigned') AS "ministryName",
        v.group_id AS "groupId",
        COALESCE(bg.name, '') AS "groupName",
        v.event_id AS "eventId",
        COALESCE(evt.title, '') AS "eventName",
        v.status,
        v.recorded_at AS "recordedAt"
      FROM attendance_log v
      JOIN members m ON v.member_id = m.id
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN bible_study_groups bg ON v.group_id = bg.id
      LEFT JOIN events evt ON v.event_id = evt.id
      ${whereSql}
      ORDER BY v.log_date DESC, (m.first_name || ' ' || m.last_name) ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    let summaryResult: { total: number; present: number; absent: number; excused: number } | null = null;
    let rows: any[] = [];

    try {
      [summaryResult, rows] = await Promise.all([
        db.get<{ total: number; present: number; absent: number; excused: number }>(summaryQuery, params),
        db.all(dataQuery, dataParams)
      ]);
    } catch (queryErr: any) {
      if (queryErr?.message?.includes("event_id") || queryErr?.code === "42703") {
        console.warn("⚠️ Column event_id not found in view, auto-migrating attendance_log view...");
        await ensureAttendanceLogViewWithEventId();
        [summaryResult, rows] = await Promise.all([
          db.get<{ total: number; present: number; absent: number; excused: number }>(summaryQuery, params),
          db.all(dataQuery, dataParams)
        ]);
      } else {
        throw queryErr;
      }
    }

    const total = summaryResult?.total || 0;
    const summary = {
      total,
      present: summaryResult?.present || 0,
      absent: summaryResult?.absent || 0,
      excused: summaryResult?.excused || 0
    };

    return res.json({
      rows,
      total,
      page,
      pageSize,
      summary
    });
  } catch (err: any) {
    console.error("Error in GET /api/attendance-log:", err);
    return res.status(500).json({ error: "Failed to fetch attendance logs", details: err?.message });
  }
});

// Helper for CSV cell sanitization and formula injection prevention
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  // Formula injection defense: prefix with apostrophe if starts with =, +, -, @
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  // Escape quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

// 2. GET /api/attendance-log/export.csv — UTF-8 BOM CSV Export (filtered data or capped at 10,000 rows)
router.get("/export.csv", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!["Admin", "Coordinator", "Leader"].includes(user.role_name)) {
      return res.status(403).json({ error: "Access denied. You do not have permission to export attendance logs." });
    }

    const { whereSql, params, emptyResult } = await buildAttendanceLogQuery(user, req.query);

    const defaultDates = getDefaultDateRange();
    const fromStr = typeof req.query.from === "string" ? req.query.from : defaultDates.fromDate;
    const toStr = typeof req.query.to === "string" ? req.query.to : defaultDates.toDate;
    const filename = `attendance_log_${fromStr}_to_${toStr}.csv`;

    let rows: any[] = [];
    if (!emptyResult) {
      const exportLimit = 10000;
      const exportParams = [...params, exportLimit];
      const exportQuery = `
        SELECT
          v.log_type AS "logType",
          to_char(v.log_date, 'YYYY-MM-DD') AS "logDate",
          v.member_id AS "memberId",
          TRIM(m.first_name || ' ' || m.last_name) AS "memberName",
          COALESCE(min.name, 'Unassigned') AS "ministryName",
          COALESCE(bg.name, '') AS "groupName",
          COALESCE(evt.title, '') AS "eventName",
          v.status,
          to_char(v.recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') AS "recordedAt"
        FROM attendance_log v
        JOIN members m ON v.member_id = m.id
        LEFT JOIN ministries min ON m.ministry_id = min.id
        LEFT JOIN bible_study_groups bg ON v.group_id = bg.id
        LEFT JOIN events evt ON v.event_id = evt.id
        ${whereSql}
        ORDER BY v.log_date DESC, (m.first_name || ' ' || m.last_name) ASC
        LIMIT $${exportParams.length}
      `;

      try {
        rows = await db.all(exportQuery, exportParams);
      } catch (exportErr: any) {
        if (exportErr?.message?.includes("event_id") || exportErr?.code === "42703") {
          console.warn("⚠️ Column event_id not found in view during CSV export, auto-migrating attendance_log view...");
          await ensureAttendanceLogViewWithEventId();
          rows = await db.all(exportQuery, exportParams);
        } else {
          throw exportErr;
        }
      }
    }

    // Build CSV content with BOM & CRLF
    const headers = [
      "Date",
      "Type",
      "Member Name",
      "Ministry",
      "Bible Study Group / Event",
      "Status",
      "Recorded At (Asia/Manila)"
    ];

    const headerLine = headers.map(h => sanitizeCsvCell(h)).join(",");
    const dataLines = rows.map(r => {
      let typeLabel = "Sunday Service";
      let contextLabel = "-";
      if (r.logType === "bible_study") {
        typeLabel = "Bible Study";
        contextLabel = r.groupName || "-";
      } else if (r.logType === "event") {
        typeLabel = "Special Event";
        contextLabel = r.eventName || "Event";
      }

      const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      return [
        sanitizeCsvCell(r.logDate),
        sanitizeCsvCell(typeLabel),
        sanitizeCsvCell(r.memberName),
        sanitizeCsvCell(r.ministryName),
        sanitizeCsvCell(contextLabel),
        sanitizeCsvCell(statusLabel),
        sanitizeCsvCell(r.recordedAt || "-")
      ].join(",");
    });

    const csvBody = [headerLine, ...dataLines].join("\r\n") + "\r\n";
    const csvBuffer = Buffer.from("\uFEFF" + csvBody, "utf-8");

    // Write audit log entry
    await logAuditAction(
      user.id,
      "EXPORT",
      "attendance_log",
      null,
      `Exported ${rows.length} attendance log rows to CSV (from: ${fromStr}, to: ${toStr})`
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvBuffer);
  } catch (err: any) {
    console.error("Error in GET /api/attendance-log/export.csv:", err);
    return res.status(500).json({ error: "Failed to export attendance log CSV", details: err?.message });
  }
});

export default router;
