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

    let totalMembersQuery = "SELECT COUNT(*) as count FROM members WHERE status = 'active'";
    let todayCheckinsQuery = "SELECT COUNT(*) as count FROM attendance WHERE DATE(checked_in_at) = CURRENT_DATE";
    let upcomingEventsQuery = "SELECT COUNT(*) as count FROM events WHERE start_time >= CURRENT_TIMESTAMP";
    const queryParams: any[] = [];

    if (scopedMinistryId) {
      queryParams.push(scopedMinistryId);
      totalMembersQuery += " AND ministry_id = $1";
      todayCheckinsQuery += " AND ministry_id = $1";
      upcomingEventsQuery += " AND (ministry_id = $1 OR ministry_id IS NULL)";
    }

    const totalMembers = await db.get<{ count: string | number }>(totalMembersQuery, queryParams);
    const totalHouseholds = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM households");
    const todayCheckins = await db.get<{ count: string | number }>(todayCheckinsQuery, queryParams);
    const totalDonationsYTD = await db.get<{ total: string | number }>("SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE EXTRACT(YEAR FROM donated_at) = EXTRACT(YEAR FROM CURRENT_DATE)");
    const openPrayers = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM prayer_requests WHERE status = 'open'");
    const upcomingEvents = await db.get<{ count: string | number }>(upcomingEventsQuery, queryParams);

    // Ministry member breakdown
    let minQuery = "SELECT * FROM ministries";
    const minParams: any[] = [];
    if (scopedMinistryId) {
      minParams.push(scopedMinistryId);
      minQuery += " WHERE id = $1";
    } else {
      minQuery += " ORDER BY id ASC";
    }
    const ministries = await db.all(minQuery, minParams);
    const ministryBreakdown = await Promise.all(ministries.map(async (m) => {
      const count = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM members WHERE ministry_id = $1 AND status = 'active'", [m.id]);
      const checkins = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM attendance WHERE ministry_id = $1 AND DATE(checked_in_at) = CURRENT_DATE", [m.id]);
      return {
        id: m.id,
        name: m.name,
        color: m.color,
        member_count: Number(count?.count || 0),
        today_checkins: Number(checkins?.count || 0)
      };
    }));

    // Check for aging-out alerts
    let agingOutQuery = `
      SELECT m.*, min.name as ministry_name, min.max_age
      FROM members m
      JOIN ministries min ON m.ministry_id = min.id
      WHERE m.status = 'active' AND min.max_age IS NOT NULL
    `;
    const agingParams: any[] = [];
    if (scopedMinistryId) {
      agingParams.push(scopedMinistryId);
      agingOutQuery += " AND m.ministry_id = $1";
    }
    const members = await db.all(agingOutQuery, agingParams);

    const agingOutAlerts = members.filter(m => {
      const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
      const age = calculateAge(bStr);
      return age > m.max_age;
    }).length;

    res.json({
      metrics: {
        total_active_members: Number(totalMembers?.count || 0),
        total_households: Number(totalHouseholds?.count || 0),
        today_checkins: Number(todayCheckins?.count || 0),
        ytd_giving_amount: Number(totalDonationsYTD?.total || 0),
        open_prayer_requests: Number(openPrayers?.count || 0),
        upcoming_events_count: Number(upcomingEvents?.count || 0),
        aging_out_alerts_count: agingOutAlerts
      },
      ministry_breakdown: ministryBreakdown
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
