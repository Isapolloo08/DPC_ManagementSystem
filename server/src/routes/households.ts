import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { calculateAge } from "./ministries";
import { emitRealtimeEvent } from "../socket";
import { linkHouseholdFamily, replaceHouseholdFamily, validateFamilyMembers } from "../utils/householdFamily";
import { lockFamily } from "../utils/familyTree";
import { syncRecordedHouseholdChildren } from "../utils/householdTree";
import { parsePagination, validatePagination } from "../utils/pagination";

const router = Router();

const parentFields = ["father_name", "mother_name", "guardian_name"] as const;
function validateParents(body: any, current: any = {}): string | null {
  const names: string[] = [];
  for (const field of parentFields) {
    const value = body[field] === undefined ? current[field] : body[field];
    if (value != null && (typeof value !== "string" || value.trim().length > 255)) {
      return "Parent/guardian names must be text with at most 255 characters";
    }
    if (value?.trim()) names.push(value.trim().replace(/\s+/g, " ").toLowerCase());
  }
  return new Set(names).size !== names.length ? "Please assign a different person to each parent/guardian role" : null;
}

// List households with member summaries (Optimized: 0 N+1 roundtrips)
router.get("/", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), validatePagination, async (req: Request, res: Response) => {
  try {
    const { page, limit, search } = req.query;

    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length} OR primary_contact_phone ILIKE $${params.length})`;
    }

    const pagination = parsePagination(req.query, 20);
    const isPaginated = pagination.enabled;
    let totalCount = 0;
    let curPage = pagination.page;
    const curLimit = pagination.limit;

    if (isPaginated) {
      const countRes = await db.get<{ total: string | number }>(`
        SELECT COUNT(*) as total FROM households ${whereClause}
      `, params);
      totalCount = parseInt(String(countRes?.total || 0), 10);
      curPage = Math.min(curPage, Math.max(1, Math.ceil(totalCount / curLimit)));
    }

    let query = `
      SELECT id, name, address, primary_contact_phone, father_name, mother_name, guardian_name, family_members, created_at
      FROM households
      ${whereClause}
      ORDER BY name ASC, id ASC
    `;

    let households: any[] = [];
    if (isPaginated) {
      const offset = (curPage - 1) * curLimit;
      const paginatedParams = [...params, curLimit, offset];
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      households = await db.all(query, paginatedParams);
    } else {
      households = await db.all(query, params);
    }

    const householdIds = households.map(h => h.id);
    let allMembers: any[] = [];
    if (householdIds.length > 0) {
      allMembers = await db.all(`
        SELECT m.id, m.household_id, m.first_name, m.last_name, m.birthdate, m.gender, m.contact_phone, m.spouse_id, m.spouse_name, m.civil_status, min.name as ministry_name, min.color as ministry_color
        FROM members m
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE m.household_id = ANY($1)
        ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
      `, [householdIds]);
    }

    // Group members by household_id in memory
    const membersByHousehold = new Map<number, any[]>();
    for (const m of allMembers) {
      const hId = m.household_id;
      if (!membersByHousehold.has(hId)) membersByHousehold.set(hId, []);
      const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
      membersByHousehold.get(hId)!.push({
        ...m,
        birthdate: bStr,
        age: calculateAge(bStr)
      });
    }

    const detailed = households.map((h) => {
      const members = membersByHousehold.get(h.id) || [];
      return {
        ...h,
        member_count: members.length,
        members
      };
    });

    if (isPaginated) {
      res.json({
        data: detailed,
        pagination: {
          total: totalCount,
          page: curPage,
          limit: curLimit,
          totalPages: Math.ceil(totalCount / curLimit) || 1
        }
      });
    } else {
      res.json(detailed);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific household
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const household = await db.get("SELECT * FROM households WHERE id = $1", [req.params.id]);
    if (!household) {
      return res.status(404).json({ error: "Household not found" });
    }

    const members = await db.all(`
      SELECT m.*, min.name as ministry_name, min.color as ministry_color
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      WHERE m.household_id = $1
      ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
    `, [household.id]);

    res.json({
      ...household,
      members: members.map(m => {
        const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
        return {
          ...m,
          birthdate: bStr,
          age: calculateAge(bStr)
        };
      })
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create household
router.post("/", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, primary_contact_phone, father_name, mother_name, guardian_name } = req.body;
    const parentError = validateParents(req.body);
    if (parentError) return res.status(400).json({ error: parentError });
    const family = validateFamilyMembers(req.body.family_members);
    if (!name?.trim()) {
      return res.status(400).json({ error: "Household name is required" });
    }

    const existing = await db.get("SELECT id FROM households WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: "A household with this name already exists" });
    }

    const newId = await db.transaction(async client => {
      await lockFamily(client);
      const result = await client.query(`
        INSERT INTO households (name, address, primary_contact_phone, father_name, mother_name, guardian_name)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [name.trim(), address || null, primary_contact_phone || null, father_name?.trim() || null, mother_name?.trim() || null, guardian_name?.trim() || null]);
      const id = result.rows[0].id;
      await linkHouseholdFamily(client, id, family);
      if (family) await client.query("UPDATE households SET family_members = $1::jsonb WHERE id = $2", [JSON.stringify(family), id]);
      await syncRecordedHouseholdChildren(client, id);
      return id;
    });
    await logAuditAction(req.user?.id || null, "CREATE", "households", newId, `Created household: ${name}`);
    emitRealtimeEvent("households:changed", { action: "create", id: newId });
    emitRealtimeEvent("members:changed");

    res.status(201).json({ id: newId, message: "Household created successfully" });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update household
router.put("/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, primary_contact_phone } = req.body;
    const id = req.params.id;
    const current = await db.get("SELECT * FROM households WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Household not found" });
    const parentError = validateParents(req.body, current);
    if (parentError) return res.status(400).json({ error: parentError });
    const parents = parentFields.map(field => req.body[field] === undefined ? current[field] : req.body[field]?.trim() || null);
    const family = validateFamilyMembers(req.body.family_members);

    if (name) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Household name cannot be empty" });
      }
      const existing = await db.get("SELECT id FROM households WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
      if (existing) {
        return res.status(400).json({ error: "A household with this name already exists" });
      }
    }

    await db.transaction(async client => {
      await lockFamily(client);
      await client.query("SELECT id FROM households WHERE id = $1 FOR UPDATE", [id]);
      await client.query(`
      UPDATE households
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          primary_contact_phone = COALESCE($3, primary_contact_phone),
          father_name = $4,
          mother_name = $5,
          guardian_name = $6,
          family_members = COALESCE($7::jsonb, family_members)
      WHERE id = $8
    `, [name?.trim() || null, address, primary_contact_phone, ...parents, family === undefined ? null : JSON.stringify(family), id]);
      await replaceHouseholdFamily(client, Number(id), family);
      // linkHouseholdFamily refreshes registered names; persist those corrections too.
      if (family !== undefined) await client.query("UPDATE households SET family_members=$1::jsonb WHERE id=$2", [JSON.stringify(family), id]);
      await syncRecordedHouseholdChildren(client, Number(id));
    });

    await logAuditAction(req.user?.id || null, "UPDATE", "households", Number(id), `Updated household #${id}`);
    emitRealtimeEvent("households:changed", { action: "update", id: Number(id) });
    emitRealtimeEvent("members:changed");
    res.json({ message: "Household updated successfully" });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
