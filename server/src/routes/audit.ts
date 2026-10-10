import { isCalendarDate, parsePagination, queryPage, validatePagination } from "../utils/pagination";
import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles } from "../middleware/auth";

const router = Router();

// Filter and paginate the ledger in SQL; never filter just the visible page.
router.get("/", authMiddleware, requireRoles("Admin", "Pastor"), validatePagination, async (req: AuthRequest, res: Response) => {
  try {
    const params: unknown[] = [];
    let where = " WHERE 1=1";
    const equal = (column: string, value: unknown, upper = false) => {
      if (typeof value !== "string" || !value || value === "ALL") return;
      params.push(upper ? value.toUpperCase() : value);
      where += ` AND ${upper ? "UPPER(" + column + ")" : column} = $${params.length}`;
    };
    equal("a.action", req.query.action, true);
    equal("a.target_table", req.query.target_table, true);
    equal("COALESCE(u.name, 'System')", req.query.operator);
    equal("COALESCE(r.name, 'System')", req.query.role);
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      params.push("%" + req.query.search.trim() + "%");
      where += ` AND CONCAT_WS(' ', u.name, u.email, r.name, a.action, a.target_table, a.target_id, a.details) ILIKE $${params.length}`;
    }
    for (const [key, comparison] of [["from", ">="], ["to", "<="]]) {
      const value = req.query[key];
      if (value) {
        if (!isCalendarDate(value)) return res.status(400).json({ error: "Choose a valid date range." });
        params.push(value);
        where += key === "from" ? ` AND a.created_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Manila')` : ` AND a.created_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Manila')`;
      }
    }
    if (req.query.period === "TODAY") where += " AND a.created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date::timestamp AT TIME ZONE 'Asia/Manila') AND a.created_at < (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date + 1)::timestamp AT TIME ZONE 'Asia/Manila')";
    if (req.query.period === "7DAYS") where += " AND a.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'";
    if (req.query.period === "30DAYS") where += " AND a.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'";
    const source = " FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id LEFT JOIN roles r ON u.role_id = r.id";
    const direction = req.query.sort === "asc" ? "ASC" : "DESC";
    const query = `SELECT a.id, a.user_id, a.action, a.target_table, a.target_id, a.details, a.created_at, u.name AS user_name, u.email AS user_email, r.name AS role_name ${source} ${where} ORDER BY a.created_at ${direction}, a.id ${direction}`;
    if (req.query.export === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="DPC_Audit_Trail.csv"');
      res.write("ID,Timestamp,Operator Name,Operator Email,Role,Action,Target Entity,Target ID,Details\r\n");
      const csv = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
      for (let offset = 0; !res.destroyed; offset += 100) {
        const rows = await db.all<any>(`${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, 100, offset]);
        for (const row of rows) {
          if (res.destroyed) break;
          const line = [row.id, row.created_at, row.user_name || "System", row.user_email, row.role_name || "System", row.action, row.target_table, row.target_id, row.details].map(csv).join(",") + "\r\n";
          if (!res.write(line)) await new Promise<void>(resolve => { const done = () => { res.off("drain", done); res.off("close", done); resolve(); }; res.once("drain", done); res.once("close", done); });
        }
        if (rows.length < 100) break;
      }
      return res.end();
    }
    if (!parsePagination(req.query).enabled) return res.json(await db.all(query + " LIMIT 100", params));
    const result = await queryPage<any>(query, params, req.query);
    const metadata = await db.get<any>(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE a.action ILIKE '%CREATE%') AS creates, COUNT(*) FILTER (WHERE a.action ILIKE '%UPDATE%') AS updates, COUNT(*) FILTER (WHERE a.action ILIKE '%DELETE%') AS deletes, COUNT(DISTINCT COALESCE(u.name, 'System')) AS "uniqueOperators", array_agg(DISTINCT UPPER(a.action)) AS actions, array_agg(DISTINCT UPPER(a.target_table)) AS entities, array_agg(DISTINCT COALESCE(u.name, 'System')) AS operators, array_agg(DISTINCT COALESCE(r.name, 'System')) AS roles ${source}`);
    res.json({ ...result, summary: { total: Number(metadata?.total || 0), creates: Number(metadata?.creates || 0), updates: Number(metadata?.updates || 0), deletes: Number(metadata?.deletes || 0), uniqueOperators: Number(metadata?.uniqueOperators || 0) }, options: { actions: metadata?.actions || [], entities: metadata?.entities || [], operators: metadata?.operators || [], roles: metadata?.roles || [] } });
  } catch (err: any) {
    if (res.headersSent) return res.end();
    res.status(500).json({ error: err.message });
  }
});
export default router;
