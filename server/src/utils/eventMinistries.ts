import type { PoolClient } from 'pg';
import { db } from '../db/schema';

export function parseEventMinistries(body: any, recurring = false): number[] | undefined {
  const legacy = recurring ? 'target_ministry_id' : 'ministry_id';
  if (body.ministry_ids === undefined && body[legacy] === undefined) return undefined;
  const raw = body.ministry_ids ?? (body[legacy] == null || body[legacy] === '' ? [] : [Number(body[legacy])]);
  if (!Array.isArray(raw) || raw.length > 100 || raw.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('Choose valid target ministries.');
  return [...new Set<number>(raw)];
}
export async function validateEventMinistries(ids: number[] | undefined) {
  if (!ids?.length) return;
  const rows = await db.all('SELECT id FROM ministries WHERE id = ANY($1::integer[])', [ids]);
  if (rows.length !== ids.length) throw new Error('One or more selected ministries no longer exist.');
}
export async function saveEventMinistries(client: PoolClient, id: number, ids: number[], recurring = false) {
  const table = recurring ? 'recurring_event_ministries' : 'event_ministries';
  const column = recurring ? 'recurring_event_id' : 'event_id';
  // Retain removed associations so a cloud sync cannot resurrect them.
  await client.query(`UPDATE ${table} SET enabled = FALSE WHERE ${column} = $1`, [id]);
  await client.query(`INSERT INTO ${table} (${column}, ministry_id, enabled)
    SELECT $1, unnest($2::integer[]), TRUE ON CONFLICT (${column}, ministry_id) DO UPDATE SET enabled = TRUE`, [id, ids]);
}
export const eventMinistryIdsSql = (alias = 'e') => `COALESCE(NULLIF(ARRAY(SELECT em.ministry_id FROM event_ministries em WHERE em.event_id = ${alias}.id AND em.enabled ORDER BY em.ministry_id), '{}'::integer[]), array_remove(ARRAY[${alias}.ministry_id], NULL))`;
export const recurringMinistryIdsSql = (alias = 'r') => `COALESCE(NULLIF(ARRAY(SELECT em.ministry_id FROM recurring_event_ministries em WHERE em.recurring_event_id = ${alias}.id AND em.enabled ORDER BY em.ministry_id), '{}'::integer[]), array_remove(ARRAY[${alias}.target_ministry_id], NULL))`;
export function memberFitsEvent(memberMinistry: number | null, event: { ministry_id: number | null; ministry_ids?: number[] }) {
  const ids = event.ministry_ids?.length ? event.ministry_ids : event.ministry_id ? [event.ministry_id] : [];
  return !ids.length || (memberMinistry != null && ids.includes(memberMinistry));
}
