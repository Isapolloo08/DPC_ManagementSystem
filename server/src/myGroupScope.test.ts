import assert from 'node:assert/strict';
import { db } from './db/schema';
import { MY_GROUP_SCOPE } from './utils/myGroupScope';

async function run() {
  // Temporary tables shadow production names on this connection only. No live
  // accounts/groups are changed and every fixture disappears at commit/rollback.
  await db.transaction(async (client) => {
    await client.query(`
      CREATE TEMP TABLE users (id int, name text, email text, username text) ON COMMIT DROP;
      CREATE TEMP TABLE members (id int, user_id int, first_name text, last_name text, contact_email text, contact_phone text) ON COMMIT DROP;
      CREATE TEMP TABLE bible_study_groups (id int, leader_name text, leader_contact text, assistant_leader_id int, assistant_leader_name text, assistant_leader_contact text, status text DEFAULT 'active') ON COMMIT DROP;
      CREATE TEMP TABLE bible_study_members (group_id int, member_id int, status text) ON COMMIT DROP;
      INSERT INTO users VALUES (1, 'Ann', NULL, 'ann-login'), (2, 'Joann', 'joann@example.test', 'joann'), (3, 'Other Leader', NULL, 'other'), (4, 'Unassigned Admin', NULL, 'admin');
      INSERT INTO members VALUES (100, 1, 'Ann', 'Santos', NULL, '09123456789'), (1, 3, 'Other', 'Leader', NULL, NULL);
      INSERT INTO bible_study_groups (id, leader_name, leader_contact, assistant_leader_id, assistant_leader_name) VALUES
        (1, 'Display label', ' ANN-LOGIN ', NULL, NULL),
        (2, ' ann ', NULL, NULL, NULL),
        (3, 'Joann', NULL, NULL, NULL),
        (4, 'Someone else', NULL, 100, NULL),
        (5, 'Someone else', NULL, 1, NULL),
        (6, 'Someone else', NULL, NULL, NULL),
        (7, 'Someone else', NULL, NULL, NULL),
        (8, 'Ann', 'different@example.test', NULL, NULL),
        (9, 'Ann Santos', NULL, NULL, NULL),
        (10, 'Someone else', NULL, NULL, 'Ann'),
        (11, 'Someone else', NULL, 1, 'Ann'),
        (12, '', '', NULL, ''),
        (13, 'Ann', NULL, NULL, NULL),
        (14, 'Someone else', '09123456789', NULL, NULL);
      UPDATE bible_study_groups SET status = 'archived' WHERE id = 13;
      INSERT INTO bible_study_members VALUES (6, 100, 'active'), (7, 100, 'transferred');
    `);
    const groupsFor = async (id: number) => (await client.query(
      `SELECT g.id FROM bible_study_groups g WHERE COALESCE(g.status, 'active') = 'active' AND ${MY_GROUP_SCOPE} ORDER BY g.id`, [id]
    )).rows.map(row => row.id);
    assert.deepEqual(await groupsFor(1), [1, 2, 4, 6, 9, 10, 14], 'Only exact leader assignments, linked assistant IDs, and active enrollments qualify');
    assert.deepEqual(await groupsFor(2), [3], 'Partial names cannot see someone else’s group');
    assert.deepEqual(await groupsFor(4), [], 'Unassigned accounts have no groups');
    assert.deepEqual(await groupsFor(999), [], 'Unknown accounts have no groups');
    await client.query("INSERT INTO users VALUES (5, 'Ann', NULL, 'another-ann')");
    assert.deepEqual(await groupsFor(1), [1, 4, 6, 9, 14], 'Ambiguous names require an explicit contact or member assignment');
    await client.query("UPDATE bible_study_members SET status = 'transferred' WHERE group_id = 6");
    assert.deepEqual(await groupsFor(1), [1, 4, 9, 14], 'Removed enrollments stop granting access');
  });
  console.log('My-group scope checks passed (temporary PostgreSQL fixtures).');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.pool.end());
