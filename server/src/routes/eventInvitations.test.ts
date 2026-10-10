import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import router, { canManageInvitation, validateInvitationResponse } from './eventInvitations';
import { db } from '../db/schema';
import { JWT_SECRET } from '../middleware/auth';

const token = 'a'.repeat(64), receipt = '11111111-1111-4111-8111-111111111111';
const user = { id: 1, name: 'Organizer', email: 'staff@example.test', role_id: 1, role_name: 'Coordinator', ministry_ids: [2] };
test('declines require a reason and organizer scope is enforced', () => {
  assert.ok(validateInvitationResponse({ answer: 'no', reason: '  ' }));
  assert.ok(validateInvitationResponse({ answer: 'wrong', reason: '' }));
  assert.ok(validateInvitationResponse({ answer: 'yes', reason: '', responseKey: 'wrong' }));
  assert.equal(validateInvitationResponse({ answer: 'no', reason: 'Working', responseKey: receipt }), null);
  assert.equal(validateInvitationResponse({ answer: 'yes' }), null);
  assert.ok(validateInvitationResponse({ answer: 'yes', attendeeType: 'member', member_id: '9' }));
  assert.ok(validateInvitationResponse({ answer: 'yes', attendeeType: 'unknown' }));
  assert.equal(canManageInvitation(user, { ministry_id: 2, created_by: 3 }), true);
  assert.equal(canManageInvitation(user, { ministry_id: 3, created_by: 3 }), false);
  assert.equal(canManageInvitation({ ...user, role_name: 'Member' }, { ministry_id: 2, created_by: 1 }), false);
});

test('public response is private, idempotent, deadline-bound and independent from check-in', async () => {
  const app = express(); app.use(express.json()); app.use('/api/event-invitations', router);
  const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/event-invitations`;
  const original = { get: db.get, all: db.all, run: db.run, transaction: db.transaction };
  let personal = false, enabled = true, deadline = '2099-01-01', role = 'Coordinator', eligible = true;
  const searches: any[] = [];
  const writes: { query: string; params: any[] }[] = [];
  try {
    db.get = (async (query: string) => {
      if (query.includes('JOIN roles')) return { ...user, role_name: role };
      if (query.includes('SELECT id, title')) return { id: 1, title: 'Gathering', ministry_id: 3, created_by: 3, start_time: '2099-01-01' };
      if (query.includes('i.deadline, i.member_id')) return { title: 'Gathering', description: 'Welcome', accepting: true, personal: false, member_name: '' };
      if (query.includes('SELECT i.member_id, e.ministry_id')) return { member_id: personal ? 9 : null, ministry_id: 2, accepting: enabled };
      return null;
    }) as any;
    db.all = (async (query: string, params: any[]) => {
      if (query.includes('strpos')) { searches.push({ query, params }); return [{ id: 9, name: 'Juan Santos' }]; }
      return [{ ministry_id: 2 }];
    }) as any;
    db.run = (async () => ({ changes: 1, lastInsertRowid: 1 })) as any;
    db.transaction = (async (callback: any) => callback({ query: async (query: string, params: any[]) => {
      if (query.includes('FOR UPDATE')) return { rows: [{ id: 7, event_id: 1, ministry_id: 2, member_id: personal ? 9 : null, member_name: 'Juan Santos', enabled, deadline, start_time: '2099-02-01' }] };
      if (query.includes('FOR SHARE')) {
        assert.deepEqual(params, [9, [2]]); assert.match(query, /status = 'active'/);
        return { rows: eligible ? [{ name: 'Juan Santos' }] : [] };
      }
      writes.push({ query, params }); return { rows: [] };
    }})) as any;
    let response = await fetch(base + '/public/' + token);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const publicData = await response.json() as any;
    assert.equal(publicData.responses, undefined); assert.equal(publicData.token, undefined);
    assert.deepEqual(await (await fetch(base + '/public/' + token + '/members?search=')).json(), { members: [] });
    assert.deepEqual(await (await fetch(base + '/public/' + token + '/members?search=J')).json(), { members: [{ id: 9, name: 'Juan Santos' }] });
    assert.deepEqual(await (await fetch(base + '/public/' + token + '/members?search=Juan')).json(), { members: [{ id: 9, name: 'Juan Santos' }] });
    assert.deepEqual(searches[0].params, [[2], 'J']); assert.match(searches[0].query, /LIMIT 10/);
    assert.doesNotMatch(searches[0].query, /contact_phone|contact_email/);
    const post = (body: any) => fetch(base + '/public/' + token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ name: 'Guest', contact: 'guest@example.test', answer: 'no', reason: '' })).status, 400);
    assert.equal(writes.length, 0);
    const payload = { name: 'Guest', contact: 'guest@example.test', answer: 'no', reason: 'Working', responseKey: receipt };
    assert.equal((await post(payload)).status, 200);
    assert.equal((await post({ ...payload, answer: 'yes' })).status, 200);
    assert.ok(writes.every(write => write.query.includes('ON CONFLICT (invitation_id, response_key)')));
    assert.equal(writes[0].params[1], writes[1].params[1]); assert.equal(writes[1].params[5], '');
    assert.ok(writes.every(write => !/INSERT INTO attendance/.test(write.query)));
    enabled = false; assert.equal((await post(payload)).status, 410); assert.equal(writes.length, 2);
    enabled = true; deadline = '2020-01-01'; assert.equal((await post(payload)).status, 410);
    deadline = '2099-01-01'; personal = true;
    assert.equal((await post({ ...payload, name: 'Spoofed' })).status, 200);
    assert.equal(writes[2].params[2], 'Juan Santos'); assert.equal(writes[2].params[1], 'member');
    assert.match(writes[3].query, /INSERT INTO event_registrations/);
    personal = false;
    const memberPayload = { ...payload, name: 'Spoofed', contact: '', answer: 'yes', attendeeType: 'member', member_id: 9 };
    assert.equal((await post(memberPayload)).status, 200);
    assert.equal(writes[4].params[2], 'Juan Santos'); assert.equal(writes[4].params[7], 9);
    assert.match(writes[4].query, /ON CONFLICT \(event_id, member_id\) WHERE member_id IS NOT NULL/);
    assert.deepEqual(writes[5].params, [1, 9, 'registered']);
    eligible = false; assert.equal((await post(memberPayload)).status, 400); assert.equal(writes.length, 6);
    enabled = false; assert.equal((await fetch(base + '/public/' + token + '/members?search=Juan')).status, 410);
    const auth = { Authorization: 'Bearer ' + jwt.sign({ id: 1 }, JWT_SECRET) };
    assert.equal((await fetch(base + '/events/1')).status, 401);
    assert.equal((await fetch(base + '/events/1', { headers: auth })).status, 403);
    role = 'Member'; assert.equal((await fetch(base + '/events/1', { headers: auth })).status, 403);
  } finally { Object.assign(db, original); await new Promise<void>(resolve => server.close(() => resolve())); }
});
