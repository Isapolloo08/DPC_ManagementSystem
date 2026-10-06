import assert from 'node:assert/strict';
import router from './routes/groups';
import { db } from './db/schema';

// Exercise the route with isolated persistence; no live records are changed.
const layer = (router as any).stack.find((entry: any) => entry.route?.path === '/:id/attendance' && entry.route.methods.post);
const handler = layer.route.stack.at(-1).handle;
let currentBook = 'Romans';
let currentChapter = 'Chapter 2';
let newerSession = false;
let failAttendance = false;
let assigned = true;
let status = 'active';
let transactions = 0;
(db as any).get = async (sql: string) => sql.startsWith('SELECT * FROM bible_study_groups') ? { id: 11, name: 'Group', curriculum: currentBook, current_chapter: currentChapter, meeting_day: 'Wednesday' } : sql.includes('SELECT g.id') ? (assigned ? { id: 11 } : null) : null;
(db as any).run = async () => ({});
(db as any).transaction = async (callback: any) => {
  transactions++;
  let book = currentBook, chapter = currentChapter;
  const result = await callback({ query: async (sql: string, values: any[]) => {
    if (sql.startsWith('SELECT status')) return { rows: [{ status }] };
    if (sql.startsWith('SELECT 1 FROM bible_study_sessions')) return { rows: newerSession ? [{}] : [] };
    if (sql.startsWith('UPDATE bible_study_groups')) { book = values[0]; chapter = values[1]; }
    if (sql.includes('INSERT INTO bible_study_attendance') && failAttendance) throw new Error('Simulated attendance failure');
    if (sql.includes('SELECT member_id')) return { rows: [{ member_id: 2 }] };
    return { rows: [] };
  } });
  currentBook = book; currentChapter = chapter;
  return result;
};

async function save(overrides = {}, role = 'Pastor') {
  let statusCode = 200;
  let body: any;
  await handler({ params: { id: '11' }, user: { id: 1, role_name: role }, body: {
    session_date: '2026-09-30', topic_title: 'Gospel of John', chapter: 'Chapter 3', update_group_progress: true, present_member_ids: [2], ...overrides,
  } }, { status(code: number) { statusCode = code; return this; }, json(value: any) { body = value; } });
  return { statusCode, body };
}

async function run() {
  assert.equal((await save()).statusCode, 200);
  assert.equal(currentBook, 'Gospel of John');
  assert.equal(currentChapter, 'Chapter 3');
  failAttendance = true;
  assert.equal((await save({ chapter: 'Chapter 4' })).statusCode, 500);
  assert.equal(currentChapter, 'Chapter 3', 'Attendance failure rolls back progress');
  failAttendance = false;
  newerSession = true;
  assert.equal((await save({ chapter: 'Chapter 1' })).statusCode, 409);
  assert.equal((await save({ chapter: 'Chapter 1', update_group_progress: false })).statusCode, 200);
  assert.equal(currentChapter, 'Chapter 3', 'Historical lessons do not rewind current progress');
  newerSession = false;
  status = 'completed';
  assert.equal((await save()).statusCode, 409);
  status = 'active';
  const before = transactions;
  assert.equal((await save({ chapter: '' })).statusCode, 400);
  assert.equal((await save({ update_group_progress: 'true' })).statusCode, 400);
  assert.equal((await save({}, 'Member')).statusCode, 403);
  assigned = false;
  assert.equal((await save({}, 'Leader')).statusCode, 403);
  assert.equal(transactions, before, 'Rejected inputs never start persistence');
  console.log('Roll-call progress route checks passed (isolated persistence).');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.pool.end());
