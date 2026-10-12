import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initSchema, pool, sql } from './schema';

test('schema initialization rejects unreachable database instead of reporting success', async t => {
  const failure = Object.assign(new Error('connect ENETUNREACH'), { code: 'ENETUNREACH' });
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(sql, 'unsafe', async () => { throw failure; });
  await assert.rejects(initSchema(), error => error === failure);
});

after(async () => { await pool.end(); });
