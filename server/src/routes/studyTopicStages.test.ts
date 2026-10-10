import assert from 'node:assert/strict';
import { test } from 'node:test';
import router from './studyTopics';
import { db } from '../db/schema';

const route = (method: string) => (router as any).stack.find((entry: any) => entry.route?.path === (method === 'post' ? '/' : '/:id') && entry.route.methods[method]).route;

test('stage settings reject non-boolean values before database writes', () => {
  for (const method of ['post', 'put']) for (const field of ['has_discussion', 'has_review', 'has_exam']) {
    for (const value of ['false', 0, null, []]) {
      let status = 200, next = false;
      const res = { status: (code: number) => { status = code; return res; }, json: () => res };
      route(method).stack[1].handle({ body: { [field]: value } }, res, () => { next = true; });
      assert.equal(status, 400); assert.equal(next, false);
    }
  }
});

test('book creation stores disabled options and edits preserve omitted settings', async () => {
  const original = { get: db.get, run: db.run };
  const writes: { sql: string; params: any[] }[] = [];
  db.get = (async (sql: string) => sql.includes('WHERE id = $1') ? { id: 11 } : null) as any;
  db.run = (async (sql: string, params: any[]) => { writes.push({ sql, params }); return { lastInsertRowid: 11, changes: 1 }; }) as any;
  const res = { status: () => res, json: () => res };
  try {
    await route('post').stack.at(-1).handle({ body: { title: 'Discussion Study', total_chapters: 3, has_discussion: true, has_review: false, has_exam: false } }, res);
    assert.match(writes[0].sql, /has_discussion, has_review, has_exam/);
    assert.deepEqual(writes[0].params.slice(3), [true, false, false]);
    await route('put').stack.at(-1).handle({ params: { id: '11' }, body: { has_exam: true } }, res);
    assert.deepEqual(writes[1].params.slice(4), [null, null, true]);
    assert.match(writes[1].sql, /has_review = COALESCE\(\$6, has_review\)/);
    await route('put').stack.at(-1).handle({ params: { id: '11' }, body: { has_discussion: false, has_review: false, has_exam: false } }, res);
    assert.deepEqual(writes[2].params.slice(4), [false, false, false]);
    await route('post').stack.at(-1).handle({ body: { title: 'Legacy client' } }, res);
    assert.deepEqual(writes[3].params.slice(3), [true, true, true]);
  } finally { Object.assign(db, original); }
});
