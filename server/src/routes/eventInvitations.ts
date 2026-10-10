import { randomBytes, randomUUID } from "crypto";
import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";
import { eventMinistryIdsSql, memberFitsEvent } from '../utils/eventMinistries';

const router = Router();
const organizer = [authMiddleware, requireRoles("Admin", "Pastor", "Coordinator")];
const tokenPattern = /^[a-f0-9]{64}$/;
const receiptPattern = /^[a-f0-9-]{36}$/;
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "Please wait a minute before trying again." } });

export function canManageInvitation(user: AuthRequest["user"], event: { ministry_id: number | null; ministry_ids?: number[]; created_by: number | null }) {
  return Boolean(user && (["Admin", "IT Admin", "Pastor"].includes(user.role_name) ||
    (user.role_name === "Coordinator" && (event.created_by === user.id ||
      (event.ministry_ids?.length ? event.ministry_ids : event.ministry_id ? [event.ministry_id] : []).some(id => user.ministry_ids.includes(id))))));
}

async function managedEvent(req: AuthRequest, res: Response) {
  const id = Number(req.params.eventId);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Choose a valid event." }); return null; }
  const event = await db.get(`SELECT id, title, ministry_id, created_by, start_time, ${eventMinistryIdsSql()} AS ministry_ids FROM events e WHERE id = $1`, [id]);
  if (!event) { res.status(404).json({ error: "Event not found." }); return null; }
  if (!canManageInvitation(req.user, event)) { res.status(403).json({ error: "You cannot manage invitations for this event." }); return null; }
  return event;
}

router.get("/events/:eventId", ...organizer, async (req: AuthRequest, res) => {
  try {
    const event = await managedEvent(req, res); if (!event) return;
    const links = await db.all(`SELECT i.*, concat_ws(' ', m.first_name, m.last_name) AS member_name,
      (i.enabled AND i.deadline > CURRENT_TIMESTAMP AND e.start_time > CURRENT_TIMESTAMP) AS accepting
      FROM event_invitation_links i JOIN events e ON e.id = i.event_id LEFT JOIN members m ON m.id = i.member_id
      WHERE i.event_id = $1 ORDER BY i.created_at DESC, i.id DESC`, [event.id]);
    const responses = await db.all(`SELECT r.id, r.invitation_id, r.member_id, r.name, r.contact, r.answer, r.reason, r.updated_at
      FROM event_invitation_responses r JOIN event_invitation_links i ON i.id = r.invitation_id
      WHERE i.event_id = $1 ORDER BY r.updated_at DESC, r.id DESC LIMIT 1000`, [event.id]);
    const counts = await db.get(`SELECT COUNT(*) FILTER (WHERE r.answer = 'yes')::int AS yes,
      COUNT(*) FILTER (WHERE r.answer = 'no')::int AS no, COUNT(*) FILTER (WHERE r.answer = 'maybe')::int AS maybe,
      COUNT(*) FILTER (WHERE i.member_id IS NOT NULL AND r.id IS NULL AND NOT EXISTS
        (SELECT 1 FROM event_invitation_responses other WHERE other.event_id = i.event_id AND other.member_id = i.member_id))::int AS pending
      FROM event_invitation_links i LEFT JOIN event_invitation_responses r ON r.invitation_id = i.id WHERE i.event_id = $1`, [event.id]);
    res.json({ links, responses, counts, limit: 1000 });
  } catch { res.status(500).json({ error: "Unable to load invitations. Please try again." }); }
});

router.get('/events/:eventId/members', ...organizer, async (req: AuthRequest, res) => {
  try {
    const event = await managedEvent(req, res); if (!event) return;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (!search || search.length > 120) return res.json([]);
    const ids = event.ministry_ids?.length ? event.ministry_ids : event.ministry_id ? [event.ministry_id] : [];
    res.json(await db.all(`SELECT id, first_name, last_name FROM members WHERE status='active'
      AND (cardinality($1::integer[])=0 OR ministry_id=ANY($1))
      AND strpos(lower(concat_ws(' ',first_name,last_name)),lower($2))>0 ORDER BY last_name, first_name, id LIMIT 20`, [ids, search]));
  } catch { res.status(500).json({ error: 'Unable to search event members.' }); }
});

router.post("/events/:eventId", ...organizer, async (req: AuthRequest, res) => {
  try {
    const event = await managedEvent(req, res); if (!event) return;
    const deadline = req.body.deadline == null ? new Date(event.start_time) : new Date(req.body.deadline);
    if ((req.body.deadline != null && typeof req.body.deadline !== 'string') || !Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now() || deadline.getTime() > new Date(event.start_time).getTime())
      return res.status(400).json({ error: "Set a future response deadline on or before the event starts." });
    const memberId = req.body.member_id == null ? null : Number(req.body.member_id);
    if (memberId != null) {
      if (!Number.isSafeInteger(memberId) || memberId < 1) return res.status(400).json({ error: "Choose a valid member." });
      const member = await db.get("SELECT id, ministry_id FROM members WHERE id = $1", [memberId]);
      if (!member) return res.status(404).json({ error: "Member not found." });
      if (!memberFitsEvent(member.ministry_id, event)) return res.status(400).json({ error: "Choose a member from the event's ministries." });
    }
    const link = await db.get(`INSERT INTO event_invitation_links (event_id, member_id, token, deadline, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (event_id, member_id) WHERE member_id IS NOT NULL DO UPDATE SET enabled = TRUE, deadline = EXCLUDED.deadline
      RETURNING *`, [event.id, memberId, randomBytes(32).toString("hex"), deadline.toISOString(), req.user!.id]);
    await logAuditAction(req.user!.id, "CREATE", "events", event.id, "Generated an event invitation link");
    res.status(201).json(link);
  } catch { res.status(500).json({ error: "Unable to generate the invitation link." }); }
});

router.patch("/events/:eventId/links/:linkId", ...organizer, async (req: AuthRequest, res) => {
  try {
    const event = await managedEvent(req, res); if (!event) return;
    const id = Number(req.params.linkId);
    if (!Number.isSafeInteger(id) || id < 1 || typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: "Choose a valid link status." });
    const result = await db.run("UPDATE event_invitation_links SET enabled = $1 WHERE id = $2 AND event_id = $3", [req.body.enabled, id, event.id]);
    if (!result.changes) return res.status(404).json({ error: "Invitation link not found." });
    await logAuditAction(req.user!.id, "UPDATE", "events", event.id, req.body.enabled ? "Activated an invitation link" : "Deactivated an invitation link");
    res.json({ enabled: req.body.enabled });
  } catch { res.status(500).json({ error: "Unable to change the invitation link." }); }
});

router.use("/public", publicLimiter, (_req, res, next) => { res.set("Cache-Control", "no-store"); res.set("Referrer-Policy", "no-referrer"); next(); });
router.get("/public/:token", async (req, res) => {
  try {
    if (!tokenPattern.test(req.params.token)) return res.status(404).json({ error: "Invitation not found." });
    const invitation = await db.get(`SELECT e.title, e.description, e.start_time, e.end_time, e.location,
      COALESCE((SELECT string_agg(mn.name, ' + ' ORDER BY mn.id) FROM event_ministries em JOIN ministries mn ON mn.id=em.ministry_id WHERE em.event_id=e.id AND em.enabled), min.name, 'All-Church') AS ministry_name,
      i.deadline, i.member_id IS NOT NULL AS personal, concat_ws(' ', m.first_name, m.last_name) AS member_name,
      (i.enabled AND i.deadline > CURRENT_TIMESTAMP AND e.start_time > CURRENT_TIMESTAMP) AS accepting
      FROM event_invitation_links i JOIN events e ON e.id = i.event_id LEFT JOIN members m ON m.id = i.member_id
      LEFT JOIN ministries min ON min.id = e.ministry_id WHERE i.token = $1`, [req.params.token]);
    if (!invitation) return res.status(404).json({ error: "Invitation not found." });
    res.json(invitation);
  } catch { res.status(500).json({ error: "Unable to open this invitation. Please try again." }); }
});

// A valid open invitation exposes only matching names, never the full directory or contact details.
router.get("/public/:token/members", async (req, res) => {
  try {
    if (!tokenPattern.test(req.params.token)) return res.status(404).json({ error: "Invitation not found." });
    const invitation = await db.get(`SELECT i.member_id, e.ministry_id, ${eventMinistryIdsSql()} AS ministry_ids,
      (i.enabled AND i.deadline > CURRENT_TIMESTAMP AND e.start_time > CURRENT_TIMESTAMP) AS accepting
      FROM event_invitation_links i JOIN events e ON e.id = i.event_id WHERE i.token = $1`, [req.params.token]);
    if (!invitation) return res.status(404).json({ error: "Invitation not found." });
    if (!invitation.accepting) return res.status(410).json({ error: "Responses are closed for this invitation." });
    if (invitation.member_id) return res.json({ members: [] });
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (!search.length || search.length > 120) return res.json({ members: [] });
    const members = await db.all(`SELECT id, concat_ws(' ', first_name, last_name) AS name FROM members
      WHERE status = 'active' AND (cardinality($1::integer[])=0 OR ministry_id = ANY($1))
      AND strpos(lower(concat_ws(' ', first_name, last_name)), lower($2)) > 0
      ORDER BY lower(last_name), lower(first_name), id LIMIT 10`, [invitation.ministry_ids?.length ? invitation.ministry_ids : invitation.ministry_id ? [invitation.ministry_id] : [], search]);
    res.json({ members });
  } catch { res.status(500).json({ error: "Unable to search members. Please try again." }); }
});

export function validateInvitationResponse(body: any): string | null {
  if (!body || !['yes', 'no', 'maybe'].includes(body.answer)) return "Choose whether you can attend.";
  if ((body.reason != null && (typeof body.reason !== 'string' || body.reason.length > 1000)) ||
    (body.answer === 'no' && (typeof body.reason !== 'string' || !body.reason.trim()))) return "Please provide a reason if you cannot attend (up to 1,000 characters).";
  if (body.responseKey != null && (typeof body.responseKey !== 'string' || !receiptPattern.test(body.responseKey))) return "Your response reference is invalid. Reopen the invitation.";
  if (body.attendeeType != null && !['member', 'guest'].includes(body.attendeeType)) return "Choose Regular Member or Guest.";
  if (body.attendeeType === 'member' && (!Number.isSafeInteger(body.member_id) || body.member_id < 1)) return "Select your member name.";
  return null;
}

router.post("/public/:token", async (req, res) => {
  try {
    if (!tokenPattern.test(req.params.token)) return res.status(404).json({ error: "Invitation not found." });
    const error = validateInvitationResponse(req.body); if (error) return res.status(400).json({ error });
    const result = await db.transaction(async client => {
      // Lock the link so deactivation and submissions cannot race.
      const { rows } = await client.query(`SELECT i.*, e.start_time, e.ministry_id, ${eventMinistryIdsSql()} AS ministry_ids, concat_ws(' ', m.first_name, m.last_name) AS member_name
        FROM event_invitation_links i JOIN events e ON e.id = i.event_id LEFT JOIN members m ON m.id = i.member_id
        WHERE i.token = $1 FOR UPDATE OF i`, [req.params.token]);
      const invitation = rows[0];
      if (!invitation) return { status: 404, error: "Invitation not found." };
      if (!invitation.enabled || new Date(invitation.deadline).getTime() <= Date.now() || new Date(invitation.start_time).getTime() <= Date.now()) return { status: 410, error: "Responses are closed for this invitation." };
      const memberId = invitation.member_id || (req.body.attendeeType === 'member' ? req.body.member_id : null);
      let name = invitation.member_id ? invitation.member_name : req.body.name;
      if (memberId && !invitation.member_id) {
        const member = await client.query(`SELECT concat_ws(' ', first_name, last_name) AS name FROM members
          WHERE id = $1 AND status = 'active' AND (cardinality($2::integer[])=0 OR ministry_id = ANY($2)) FOR SHARE`, [memberId, invitation.ministry_ids?.length ? invitation.ministry_ids : invitation.ministry_id ? [invitation.ministry_id] : []]);
        if (!member.rows[0]) return { status: 400, error: "Choose an active member from the event's ministry." };
        name = member.rows[0].name;
      }
      const contact = memberId ? '' : req.body.contact;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || typeof contact !== 'string' || contact.length > 160 || (!memberId && !contact.trim())) return { status: 400, error: "Enter your name and email or mobile number." };
      const key = memberId ? (invitation.member_id ? 'member' : `member:${memberId}`) : req.body.responseKey || randomUUID();
      const conflict = memberId ? '(event_id, member_id) WHERE member_id IS NOT NULL' : '(invitation_id, response_key)';
      await client.query(`INSERT INTO event_invitation_responses (invitation_id, response_key, name, contact, answer, reason, event_id, member_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT ${conflict}
        DO UPDATE SET name = EXCLUDED.name, contact = EXCLUDED.contact, answer = EXCLUDED.answer, reason = EXCLUDED.reason, updated_at = CURRENT_TIMESTAMP`,
        [invitation.id, key, name.trim(), contact.trim(), req.body.answer, req.body.answer === 'no' ? req.body.reason.trim() : '', invitation.event_id, memberId]);
      if (memberId) await client.query(`INSERT INTO event_registrations (event_id, member_id, status)
        VALUES ($1, $2, $3) ON CONFLICT (event_id, member_id) DO UPDATE SET status = EXCLUDED.status
        WHERE event_registrations.status NOT IN ('attended', 'checked_in')`,
        [invitation.event_id, memberId, req.body.answer === 'yes' ? 'registered' : req.body.answer === 'no' ? 'cancelled' : 'pending']);
      return { status: 200, eventId: invitation.event_id, responseKey: memberId ? undefined : key };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    emitRealtimeEvent("events:changed", { action: "invitation_response", id: result.eventId });
    res.json({ message: "Your response has been saved.", responseKey: result.responseKey });
  } catch { res.status(500).json({ error: "Unable to save your response. Please try again." }); }
});

export default router;
