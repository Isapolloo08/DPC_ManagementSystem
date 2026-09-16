import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { calculateAge } from "./ministries";

const router = Router();

// Main dashboard reporting KPI aggregations
router.get("/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id } = req.query;
    const scopedMinistryId = ministry_id ? Number(ministry_id) : null;
    const filterParam = scopedMinistryId ? [scopedMinistryId] : [];

    // 1. Consolidated KPI Metrics Query in a single database roundtrip
    const metricsSql = `
      SELECT
        (SELECT COUNT(*) FROM members WHERE status = 'active' ${scopedMinistryId ? "AND ministry_id = $1" : ""}) as total_active_members,
        (SELECT COUNT(*) FROM households) as total_households,
        (SELECT COUNT(*) FROM attendance WHERE checked_in_at::date = CURRENT_DATE ${scopedMinistryId ? "AND ministry_id = $1" : ""}) as today_checkins,
        (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE EXTRACT(YEAR FROM donated_at) = EXTRACT(YEAR FROM CURRENT_DATE)) as ytd_giving_amount,
        (SELECT COUNT(*) FROM announcements) as active_announcements,
        (SELECT COUNT(*) FROM events WHERE start_time >= CURRENT_TIMESTAMP ${scopedMinistryId ? "AND (ministry_id = $1 OR ministry_id IS NULL)" : ""}) as upcoming_events_count
    `;

    // 2. Consolidated Ministry Breakdown in a single joined aggregation
    const breakdownSql = `
      SELECT 
        min.id,
        min.name,
        min.color,
        COALESCE(mem.member_count, 0) as member_count,
        COALESCE(att.today_checkins, 0) as today_checkins
      FROM ministries min
      LEFT JOIN (
        SELECT ministry_id, COUNT(*) as member_count
        FROM members
        WHERE status = 'active'
        GROUP BY ministry_id
      ) mem ON mem.ministry_id = min.id
      LEFT JOIN (
        SELECT ministry_id, COUNT(*) as today_checkins
        FROM attendance
        WHERE checked_in_at::date = CURRENT_DATE
        GROUP BY ministry_id
      ) att ON att.ministry_id = min.id
      ${scopedMinistryId ? "WHERE min.id = $1" : ""}
      ORDER BY min.id ASC
    `;

    // 3. Aging-out query (only active members with max_age)
    const agingOutSql = `
      SELECT m.birthdate, min.max_age
      FROM members m
      JOIN ministries min ON m.ministry_id = min.id
      WHERE m.status = 'active' AND min.max_age IS NOT NULL
      ${scopedMinistryId ? "AND m.ministry_id = $1" : ""}
    `;

    // Run all 3 queries concurrently in parallel
    const [metricsRow, ministryBreakdown, agingMembers] = await Promise.all([
      db.get<any>(metricsSql, filterParam),
      db.all<any>(breakdownSql, filterParam),
      db.all<any>(agingOutSql, filterParam)
    ]);

    const agingOutAlertsCount = (agingMembers || []).filter(m => {
      const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
      const age = calculateAge(bStr);
      return age > m.max_age;
    }).length;

    res.json({
      metrics: {
        total_active_members: Number(metricsRow?.total_active_members || 0),
        total_households: Number(metricsRow?.total_households || 0),
        today_checkins: Number(metricsRow?.today_checkins || 0),
        ytd_giving_amount: Number(metricsRow?.ytd_giving_amount || 0),
        active_announcements: Number(metricsRow?.active_announcements || 0),
        upcoming_events_count: Number(metricsRow?.upcoming_events_count || 0),
        aging_out_alerts_count: agingOutAlertsCount
      },
      ministry_breakdown: (ministryBreakdown || []).map(m => ({
        id: m.id,
        name: m.name,
        color: m.color,
        member_count: Number(m.member_count || 0),
        today_checkins: Number(m.today_checkins || 0)
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
