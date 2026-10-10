import { Router } from "express";
import { db } from "../db/schema";
import { authMiddleware, requireRoles, AuthRequest } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";
import { syncRecordedHouseholdChildren } from "../utils/householdTree";
import {
  addRelationship,
  invalidFamily,
  linkFamilyPerson,
  lockFamily,
  peopleProjection,
  removeRelationship,
  resolvePerson,
} from "../utils/familyTree";

const router = Router();
router.use(authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"));
const idOf = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) invalidFamily("Invalid record");
  return id;
};
router.get("/households/:id/tree", async (req, res) => {
  try {
    const id = idOf(req.params.id);
    const extended = req.query.scope === "extended";
    if (req.query.scope !== undefined && !["household","extended"].includes(String(req.query.scope))) invalidFamily("Choose household or extended tree view");
    const household = await db.get(
      "SELECT id,name FROM households WHERE id=$1",
      [id],
    );
    if (!household)
      return res.status(404).json({ error: "Household not found" });
    // Idempotent upgrade also covers legacy backups and households received by sync.
    await db.transaction(client => syncRecordedHouseholdChildren(client));
    const legacy = await db.get("SELECT father_name,mother_name,guardian_name,family_members FROM households WHERE id=$1", [id]);
    const normalize = (name: unknown) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const entries = legacy?.family_members || [];
    const memberIds = entries.filter((entry: any) => entry.member_id).map((entry: any) => entry.member_id);
    const currentMembers = await db.all("SELECT first_name,last_name FROM members WHERE household_id=$1", [id]);
    const registeredNames = new Set(currentMembers.map(member => normalize(`${member.first_name} ${member.last_name}`)));
    const namedSeeds = [...entries.filter((entry: any) => !entry.member_id).map((entry: any) => entry.name),
      ...[legacy?.father_name,legacy?.mother_name,legacy?.guardian_name].filter(name => name && !registeredNames.has(normalize(name)) && !entries.some((entry: any) => entry.member_id && normalize(entry.name) === normalize(name)))].map(normalize);
    const people = await db.all(
      `WITH RECURSIVE connected(id) AS (
      SELECT p.id FROM family_people p LEFT JOIN members m ON m.id=p.member_id WHERE p.merged_into_id IS NULL AND
        (p.member_id=ANY($3::integer[]) OR (COALESCE(m.household_id,p.household_id)=$1 AND
        (p.member_id IS NOT NULL OR lower(regexp_replace(trim(p.name),'\\s+',' ','g'))=ANY($2::text[]))))
      UNION SELECT CASE WHEN r.from_person_id=c.id THEN r.to_person_id ELSE r.from_person_id END
      FROM connected c JOIN family_relationships r ON r.deleted_at IS NULL AND (r.from_person_id=c.id OR r.to_person_id=c.id) WHERE $4::boolean
    ) ${peopleProjection} WHERE p.id IN (SELECT id FROM connected) ORDER BY p.id`,
      [id,namedSeeds,memberIds,extended],
    );
    const relationships = people.length
      ? await db.all(
          "SELECT * FROM family_relationships WHERE deleted_at IS NULL AND from_person_id=ANY($1) AND to_person_id=ANY($1) ORDER BY id",
          [people.map((p) => p.id)],
        )
      : [];
    res.json({ household, people, relationships, legacy_suggestions: legacy });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
router.get("/members/:id/parents", async (req, res) => {
  try {
    const id = idOf(req.params.id);
    const member = await db.get(
      "SELECT id,parents_household_id FROM members WHERE id=$1",
      [id],
    );
    if (!member) return res.status(404).json({ error: "Member not found" });
    await db.transaction(client => syncRecordedHouseholdChildren(client));
    const parents = await db.all(
      `${peopleProjection} JOIN family_relationships r ON r.from_person_id=p.id
      JOIN family_people child ON child.id=r.to_person_id WHERE child.member_id=$1 AND r.kind='parent' AND r.deleted_at IS NULL`,
      [id],
    );
    const roles = await db.all(
      `SELECT r.from_person_id,r.parent_role FROM family_relationships r
      JOIN family_people child ON child.id=r.to_person_id WHERE child.member_id=$1 AND r.kind='parent' AND r.deleted_at IS NULL`,
      [id],
    );
    res.json({
      parents_household_id: member.parents_household_id,
      parents: parents.map((p) => ({
        person_id: p.id,
        name: p.name,
        role: roles.find((r) => r.from_person_id === p.id)?.parent_role,
      })),
    });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
async function mutate(
  req: AuthRequest,
  res: any,
  work: (client: any) => Promise<any>,
) {
  try {
    const result = await db.transaction(async (client) => {
      await lockFamily(client);
      const result = await work(client);
      await client.query(
        "INSERT INTO audit_logs(user_id,action,target_table,details) VALUES($1,'UPDATE','family_relationships',$2)",
        [
          req.user?.id || null,
          `Family relationship change: ${req.method} ${req.path}`,
        ],
      );
      return result;
    });
    emitRealtimeEvent("households:changed", { action: "family-update" });
    emitRealtimeEvent("members:changed", { action: "family-update" });
    res.json(result);
  } catch (error: any) {
    res
      .status(error.status || 500)
      .json({
        error:
          error.code === "23505"
            ? "This relationship or registered person is already linked"
            : error.message,
      });
  }
}
router.post("/relationships", (req: AuthRequest, res) =>
  mutate(req, res, async (client) => {
    const from = await resolvePerson(client, req.body.from),
      to = await resolvePerson(client, req.body.to);
    return {
      id: await addRelationship(
        client,
        from,
        to,
        req.body.kind,
        req.body.parent_role,
      ),
    };
  }),
);
router.put("/relationships/:id", (req: AuthRequest, res) =>
  mutate(req, res, async (client) => {
    await removeRelationship(client, idOf(req.params.id));
    const from = await resolvePerson(client, req.body.from),
      to = await resolvePerson(client, req.body.to);
    return {
      id: await addRelationship(
        client,
        from,
        to,
        req.body.kind,
        req.body.parent_role,
      ),
    };
  }),
);
router.delete("/relationships/:id", (req: AuthRequest, res) =>
  mutate(req, res, async (client) => {
    await removeRelationship(client, idOf(req.params.id));
    return { message: "Relationship removed" };
  }),
);
router.put("/people/:id/member", (req: AuthRequest, res) =>
  mutate(req, res, async (client) => ({
    id: await linkFamilyPerson(
      client,
      idOf(req.params.id),
      idOf(req.body.member_id),
    ),
  })),
);
export default router;
