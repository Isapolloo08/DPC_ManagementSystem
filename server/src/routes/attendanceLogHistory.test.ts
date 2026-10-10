import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAttendanceLogQuery } from './attendanceLog';
import { db } from '../db/schema';

const admin = { id: 1, name: 'Admin', role_name: 'Admin', ministry_ids: [] };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

test('default history has no start cutoff and excludes future dates and events', async () => {
  const result = await buildAttendanceLogQuery(admin, {});
  assert.equal(result.emptyResult, false);
  assert.doesNotMatch(result.whereSql, /v.log_date >=/);
  assert.match(result.whereSql, /v.log_date <= \(CURRENT_TIMESTAMP AT TIME ZONE 'Asia\/Manila'\)::DATE/);
  assert.match(result.whereSql, /NOT EXISTS.*future_event.start_time.*Asia\/Manila/);
  assert.deepEqual(result.params, [today()]);
});

test('future upper bounds clamp to Manila today and explicit historical ranges remain available', async () => {
  const future = await buildAttendanceLogQuery(admin, { from: '2000-01-01', to: '2099-12-31', type: 'event' });
  assert.deepEqual(future.params, ['2000-01-01', today(), 'event']);
  const past = await buildAttendanceLogQuery(admin, { to: '2001-02-03', type: 'sunday_service' });
  assert.deepEqual(past.params, ['2001-02-03', 'sunday_service']);
  assert.match(future.whereSql, /v.log_type = \$3/);
});

test('history changes preserve coordinator and leader access boundaries', async () => {
  const coordinator = await buildAttendanceLogQuery({ ...admin, role_name: 'Coordinator', ministry_ids: [7] }, {});
  assert.match(coordinator.whereSql, /m.ministry_id = ANY/);
  assert.deepEqual(coordinator.params, [today(), [7]]);
  assert.equal((await buildAttendanceLogQuery({ ...admin, role_name: 'Coordinator' }, {})).emptyResult, true);
  const original = db.all;
  db.all = (async () => [{ id: 11 }]) as any;
  try {
    const leader = await buildAttendanceLogQuery({ ...admin, role_name: 'Leader' }, {});
    assert.match(leader.whereSql, /v.log_type = 'bible_study'/);
    assert.match(leader.whereSql, /v.group_id = ANY/);
    assert.deepEqual(leader.params, [today(), [11]]);
  } finally { db.all = original; }
});
