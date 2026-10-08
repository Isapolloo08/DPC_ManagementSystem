import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '../db/schema';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import { validDate, validateVisit, visitStatuses, manilaToday } from '../services/plannedVisits';
import { logger } from '../utils/logger';

const router = Router();
export const visitSubmissionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many visit requests. Please try again in 15 minutes.' } });
router.post('/', visitSubmissionLimiter, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Invalid visit request.' });
  if (body.website !== undefined && (typeof body.website !== 'string' || body.website.trim())) return res.status(400).json({ error: 'Unable to accept this request.' });
  // Validate the date shape first; a saved Sunday's receipt remains retrievable on retry after Sunday.
  const { errors, data } = validateVisit(body, '0000-00-00');
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the form.', fields: errors });
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  try {
    const existing = await db.get<{ receipt_id: string; payload_hash: string }>('SELECT receipt_id, payload_hash FROM planned_visits WHERE submission_token = $1', [body.submission_token]);
    if (existing) {
      if (existing.payload_hash !== hash) return res.status(409).json({ error: 'This submission token was already used for different details. Please submit again.' });
      return res.status(201).json({ receipt_id: existing.receipt_id, message: 'We’ve received your visit plan. We look forward to welcoming you.' });
    }
    if (data.visit_date < manilaToday()) return res.status(400).json({ error: 'Please check the form.', fields: { visit_date: 'Choose today or an upcoming Sunday.' } });
    const result = await db.get<{ receipt_id: string; payload_hash: string }>(`
      INSERT INTO planned_visits (receipt_id, submission_token, payload_hash, visit_date, party, bringing_children, child_age_groups, full_name, email, phone, questions)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (submission_token) DO UPDATE SET submission_token = EXCLUDED.submission_token
      RETURNING receipt_id, payload_hash
    `, [randomUUID(), body.submission_token, hash, data.visit_date, data.party, data.bringing_children, data.child_age_groups, data.full_name, data.email, data.phone, data.questions]);
    if (result.payload_hash !== hash) return res.status(409).json({ error: 'This submission token was already used for different details. Please submit again.' });
    return res.status(201).json({ receipt_id: result.receipt_id, message: 'We’ve received your visit plan. We look forward to welcoming you.' });
  } catch {
    logger.error('Failed to save planned visit');
    return res.status(503).json({ error: 'We couldn’t save your visit plan. Please try again. Your guide is still available.' });
  }
});

router.use(authMiddleware, requireRoles('Admin', 'Pastor'));
router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'Invalid pagination.' });
  const conditions: string[] = [], params: unknown[] = [];
  if (req.query.status) {
    if (!visitStatuses.includes(req.query.status as any)) return res.status(400).json({ error: 'Invalid status.' });
    params.push(req.query.status); conditions.push(`status = $${params.length}`);
  }
  if (req.query.visit_date) {
    if (!validDate(req.query.visit_date)) return res.status(400).json({ error: 'Invalid visit date.' });
    params.push(req.query.visit_date); conditions.push(`visit_date = $${params.length}`);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  try {
    const count = await db.get<{ total: string }>('SELECT COUNT(*) AS total FROM planned_visits' + where, params);
    const items = await db.all(`SELECT id, full_name, to_char(visit_date, 'YYYY-MM-DD') AS visit_date, party, status, created_at FROM planned_visits${where} ORDER BY visit_date DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
    res.json({ items, total: Number(count.total), page, totalPages: Math.max(1, Math.ceil(Number(count.total) / limit)) });
  } catch { res.status(500).json({ error: 'Unable to load planned visits.' }); }
});
router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) return res.status(400).json({ error: 'Invalid visit ID.' });
  try {
    const item = await db.get(`SELECT id, receipt_id, to_char(visit_date, 'YYYY-MM-DD') AS visit_date, party, bringing_children, child_age_groups, full_name, email, phone, questions, consent_at, status, staff_notes, created_at, updated_at FROM planned_visits WHERE id = $1`, [Number(req.params.id)]);
    if (!item) return res.status(404).json({ error: 'Visit not found.' });
    res.json(item);
  } catch { res.status(500).json({ error: 'Unable to load this visit.' }); }
});
router.patch('/:id', async (req: AuthRequest, res) => {
  const { status, staff_notes } = req.body || {};
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)) || !visitStatuses.includes(status) || typeof staff_notes !== 'string' || staff_notes.length > 4000) return res.status(400).json({ error: 'Choose a valid status and notes of at most 4000 characters.' });
  try {
    const changed = await db.transaction(async client => {
      const result = await client.query('UPDATE planned_visits SET status = $1, staff_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id', [status, staff_notes.trim(), Number(req.params.id)]);
      if (!result.rowCount) return false;
      await client.query('INSERT INTO audit_logs (user_id, action, target_table, target_id, details) VALUES ($1,$2,$3,$4,$5)', [req.user.id, 'UPDATE_PLANNED_VISIT', 'planned_visits', Number(req.params.id), `Updated visit status to ${status} and staff notes`]);
      return true;
    });
    if (!changed) return res.status(404).json({ error: 'Visit not found.' });
    res.json({ message: 'Visit updated.' });
  } catch { res.status(500).json({ error: 'Unable to update this visit.' }); }
});
export default router;
