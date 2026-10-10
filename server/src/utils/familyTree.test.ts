import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool, PoolClient } from "pg";
import express from "express";
import jwt from "jsonwebtoken";
import { db, pool, sql } from "../db/schema";
import bcrypt from "bcryptjs";
import backupRouter from "../routes/backup";
import { JWT_SECRET } from "../middleware/auth";
import router from "../routes/familyTree";
import {
  addRelationship,
  linkFamilyPerson,
  lockFamily,
  removeRelationship,
  resolvePerson,
  saveFamilyLinks,
  syncMemberSpouse,
} from "./familyTree";
import { restoreFamilyGraph } from "./familyBackup";
import { syncRecordedHouseholdChildren } from "./householdTree";
import {
  replaceHouseholdFamily,
  syncHouseholdSpouseRole,
  validateFamilyMembers,
} from "./householdFamily";

const config = {
  host: "127.0.0.1",
  port: 5432,
  user: "postgres",
  password: "admin123",
  database: "chms_db",
  connectionTimeoutMillis: 2000,
};
test("family origins, graph integrity, migrations, API permissions and backup round trip", async (t) => {
  const admin = new Pool(config);
  try {
    await admin.query("SELECT 1");
  } catch {
    await admin.end();
    t.skip("Local PostgreSQL unavailable");
    return;
  }
  const schema = "family_test_" + randomUUID().replace(/-/g, "");
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated = new Pool({ ...config, options: `-c search_path=${schema}` });
  const original = {
    get: db.get,
    all: db.all,
    transaction: db.transaction,
    begin: sql.begin,
  };
  const tx = async <T>(work: (client: PoolClient) => Promise<T>) => {
    const client = await isolated.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  };
  let server: ReturnType<express.Express["listen"]> | undefined;
  try {
    const migration = (name: string) =>
      fs.readFileSync(path.join(__dirname, "../db/migrations", name), "utf8");
    await isolated.query(migration("001_init_postgres.sql"));
    await isolated.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT",
    );
    await isolated.query(`ALTER TABLE households ADD COLUMN father_name TEXT, ADD COLUMN mother_name TEXT, ADD COLUMN guardian_name TEXT, ADD COLUMN family_members JSONB DEFAULT '[]';
      INSERT INTO households(id,name,father_name,mother_name) VALUES(1,'Parents household','Same Name','Mama'),(2,'Adult household',NULL,NULL);
      INSERT INTO members(id,first_name,last_name,birthdate,household_id) VALUES(1,'Papa','Santos','1950-01-01',1),(2,'Mama','Santos','1952-01-01',1),(3,'Adult','Santos','1985-01-01',2),(4,'Partner','Santos','1987-01-01',2),(5,'Child','Santos','2010-01-01',2),(6,'Same','Name','1960-01-01',1),(7,'Same','Name','1961-01-01',1);
      INSERT INTO roles(id,name) VALUES(1,'Admin'); INSERT INTO users(id,name,email,password_hash,role_id) VALUES(1,'Test','family@example.test','test',1);
      SELECT setval(pg_get_serial_sequence('members','id'),7); SELECT setval(pg_get_serial_sequence('households','id'),2);`);
    await isolated.query(migration("017_family_tree.sql"));
    await isolated.query(migration("017_family_tree.sql"));
    assert.equal(
      (await isolated.query("SELECT * FROM family_people")).rowCount,
      7,
    );
    assert.equal(
      (await isolated.query("SELECT * FROM family_relationships")).rowCount,
      0,
      "household names must not infer parents",
    );
    const ids = (await isolated.query("SELECT member_id,id FROM family_people"))
      .rows;
    const person = (id: number) => ids.find((p) => p.member_id === id).id;
    await t.test(
      "household roster removal persists, preserves profiles and ancestry, and rolls back on failure",
      async () => {
        const client = await isolated.connect();
        const before = (
          await isolated.query("SELECT * FROM members WHERE id=5")
        ).rows[0];
        try {
          await client.query("BEGIN");
          await addRelationship(
            client,
            person(1),
            person(5),
            "parent",
            "father",
          );
          await replaceHouseholdFamily(client, 2, undefined);
          assert.equal(
            (await client.query("SELECT household_id FROM members WHERE id=5"))
              .rows[0].household_id,
            2,
            "omitted roster leaves assignments alone",
          );
          await replaceHouseholdFamily(
            client,
            2,
            validateFamilyMembers([
              { member_id: 3, name: "Adult Santos" },
              { member_id: 4, name: "Partner Santos" },
            ]),
          );
          const after = (await client.query("SELECT * FROM members WHERE id=5"))
            .rows[0];
          assert.deepEqual(
            after,
            { ...before, household_id: null },
            "only the household assignment changes",
          );
          assert.equal(
            (
              await client.query(
                "SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL",
              )
            ).rowCount,
            1,
            "parent connection is retained across households",
          );
          await replaceHouseholdFamily(client, 2, []);
          assert.equal(
            (await client.query("SELECT * FROM members WHERE household_id=2"))
              .rowCount,
            0,
            "explicit empty roster clears the household",
          );
          await assert.rejects(
            replaceHouseholdFamily(
              client,
              2,
              validateFamilyMembers([
                { member_id: 99999, name: "Missing person" },
              ]),
            ),
            /no longer exists/,
          );
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
        assert.deepEqual(
          (await isolated.query("SELECT * FROM members WHERE id=5")).rows[0],
          before,
          "failed transaction restores assignments",
        );
      },
    );
    await t.test(
      "recorded sons and daughters connect to both parents without moving households or restoring removed links",
      async () => {
        const client = await isolated.connect();
        try {
          await client.query("BEGIN");
          await client.query(`INSERT INTO households(id,name,father_name,mother_name,family_members) VALUES(10,'Remot','Antonio Remot','Marites Remot',
          '[{"member_id":12,"name":"First Remot","relationship":"Son"},{"member_id":13,"name":"Second Remot","relationship":"Daughter"},{"member_id":14,"name":"Adult Remot","relationship":"Child"},{"member_id":5,"name":"Child Santos","relationship":"Relative"}]');
          INSERT INTO members(id,first_name,last_name,birthdate,household_id) VALUES(10,'Antonio','Remot','1950-01-01',10),(11,'Marites','Remot','1952-01-01',10),(12,'First','Remot','2000-01-01',10),(13,'Second','Remot','2002-01-01',10),(14,'Adult','Remot','1980-01-01',2);`);
          await syncRecordedHouseholdChildren(client, 10);
          const edges = (
            await client.query(
              "SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL",
            )
          ).rows;
          assert.equal(
            edges.length,
            6,
            "two parents and three explicitly recorded children",
          );
          assert.equal(
            (await client.query("SELECT household_id FROM members WHERE id=14"))
              .rows[0].household_id,
            2,
          );
          await syncRecordedHouseholdChildren(client, 10);
          assert.equal(
            (
              await client.query(
                "SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL",
              )
            ).rowCount,
            6,
            "repeat reads do not duplicate connections",
          );
          await removeRelationship(client, edges[0].id);
          await syncRecordedHouseholdChildren(client, 10);
          assert.equal(
            (
              await client.query(
                "SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL",
              )
            ).rowCount,
            5,
            "manual removals remain removed",
          );
          await client.query(
            `UPDATE households SET family_members='[{"member_id":5,"name":"Child Santos","relationship":"Son"}]' WHERE id=1`,
          );
          await syncRecordedHouseholdChildren(client, 1);
          assert.equal(
            (
              await client.query(
                "SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL",
              )
            ).rowCount,
            6,
            "named mother is supported while ambiguous father requires selection",
          );
          assert.equal(
            (
              await client.query(
                "SELECT * FROM family_relationships WHERE to_person_id=$1 AND parent_role='father' AND deleted_at IS NULL",
                [person(5)],
              )
            ).rowCount,
            0,
          );
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
      },
    );
    await t.test(
      "named relatives and household role corrections define connections without church registrations",
      async () => {
        const client = await isolated.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `INSERT INTO households(id,name,father_name,mother_name,guardian_name,family_members) VALUES(20,'Named family','Named Father','Named Mother','Named Guardian','[{"name":"Named Son","relationship":"Son"},{"name":"Named Daughter","relationship":"Daughter"},{"name":"Named Relative","relationship":"Relative"}]')`,
          );
          await syncRecordedHouseholdChildren(client, 20);
          const read = async () =>
            (
              await client.query(
                "SELECT r.*,a.name AS parent_name,b.name AS child_name FROM family_relationships r JOIN family_people a ON a.id=r.from_person_id JOIN family_people b ON b.id=r.to_person_id WHERE source_household_id=20 AND r.deleted_at IS NULL",
              )
            ).rows;
          assert.equal((await read()).length, 6);
          assert.equal(
            (await client.query("SELECT count(*) FROM members")).rows[0].count,
            "7",
            "relatives do not become church members",
          );
          const peopleCount = (
            await client.query(
              "SELECT count(*) FROM family_people WHERE household_id=20",
            )
          ).rows[0].count;
          await syncRecordedHouseholdChildren(client, 20);
          assert.equal(
            (
              await client.query(
                "SELECT count(*) FROM family_people WHERE household_id=20",
              )
            ).rows[0].count,
            peopleCount,
          );
          await client.query(
            `UPDATE households SET family_members='[{"name":"Named Son","relationship":"Son"},{"name":"Named Daughter","relationship":"Sibling"}]' WHERE id=20`,
          );
          await syncRecordedHouseholdChildren(client, 20);
          assert.equal(
            (await read()).length,
            3,
            "Sibling is not a child of household heads",
          );
          await client.query(
            `UPDATE households SET father_name='Corrected Father',family_members='[{"name":"Named Son","relationship":"Son"},{"name":"Named Daughter","relationship":"Daughter"}]' WHERE id=20`,
          );
          await syncRecordedHouseholdChildren(client, 20);
          const corrected = await read();
          assert.equal(corrected.length, 6);
          assert.equal(
            corrected.filter((e) => e.parent_name === "Corrected Father")
              .length,
            2,
          );
          assert.ok(corrected.every((e) => e.parent_name !== "Named Father"));
          // Explicit registration retains person links and household provenance.
          await client.query(
            `UPDATE households SET family_members='[{"name":"Named Son","relationship":"Son","member_id":5},{"name":"Named Daughter","relationship":"Daughter"}]' WHERE id=20`,
          );
          await syncRecordedHouseholdChildren(client, 20);
          assert.equal((await read()).length, 6);
          assert.equal(
            (await client.query("SELECT household_id FROM members WHERE id=5"))
              .rows[0].household_id,
            2,
          );
          await client.query("UPDATE households SET family_members='[]' WHERE id=20");
          await syncRecordedHouseholdChildren(client,20);
          assert.equal((await read()).length,0,"removed household rows retire their generated connections");
          await addRelationship(client,person(1),person(5),'parent','father');
          await syncRecordedHouseholdChildren(client,20);
          assert.equal((await client.query("SELECT * FROM family_relationships WHERE from_person_id=$1 AND to_person_id=$2 AND deleted_at IS NULL",[person(1),person(5)])).rowCount,1,"manually recorded connections stay intact");
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
      },
    );
    await t.test("explicit spouse and new child roles reflect immediately and preserve household assignments", async()=>{
      const client=await isolated.connect();
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO households(id,name,father_name,family_members) VALUES(30,'New household','Papa Santos','[{"name":"Papa Santos","member_id":1,"relationship":"Father"},{"name":"Partner Santos","member_id":4,"relationship":"Spouse"},{"name":"Child Santos","member_id":5,"relationship":"Son"}]')`);
        await syncRecordedHouseholdChildren(client,30);
        const links=(await client.query('SELECT * FROM family_relationships WHERE source_household_id=30 AND deleted_at IS NULL')).rows;
        assert.equal(links.filter(e=>e.kind==='spouse').length,1);
        assert.equal(links.filter(e=>e.kind==='parent').length,1);
        assert.equal((await client.query('SELECT spouse_id FROM members WHERE id=1')).rows[0].spouse_id,4);
        assert.equal((await client.query('SELECT household_id FROM members WHERE id=4')).rows[0].household_id,2);
        await client.query(`UPDATE households SET family_members='[{"name":"Papa Santos","member_id":1,"relationship":"Father"}]' WHERE id=30`);
        await syncRecordedHouseholdChildren(client,30);
        assert.equal((await client.query('SELECT * FROM family_relationships WHERE source_household_id=30 AND deleted_at IS NULL')).rowCount,0);
        assert.equal((await client.query('SELECT spouse_id FROM members WHERE id=1')).rows[0].spouse_id,null);
      }finally{await client.query('ROLLBACK');client.release();}
    });
    await t.test('member edits keep a childless couple as husband and wife, then derive parents only for recorded children', async () => {
      const client = await isolated.connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE members SET spouse_id=CASE id WHEN 3 THEN 4 ELSE 3 END WHERE id IN(3,4)`);
        await client.query(`UPDATE households SET father_name='Adult Santos',mother_name=NULL,family_members='[{"member_id":4,"name":"Partner Santos","relationship":"Family Member"}]' WHERE id=2`);
        await syncHouseholdSpouseRole(client,3);
        await syncRecordedHouseholdChildren(client,2);
        let household=(await client.query('SELECT * FROM households WHERE id=2')).rows[0];
        assert.equal(household.mother_name,'Partner Santos');
        assert.equal(household.family_members.find((p:any)=>p.member_id===3).relationship,'Husband');
        assert.equal(household.family_members.find((p:any)=>p.member_id===4).relationship,'Wife');
        assert.equal((await client.query("SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL AND source_household_id=2")).rowCount,0);
        await syncHouseholdSpouseRole(client,4);
        household=(await client.query('SELECT * FROM households WHERE id=2')).rows[0];
        assert.equal(household.family_members.length,2);
        household.family_members.push({member_id:5,name:'Child Santos',relationship:'Child'});
        await client.query('UPDATE households SET family_members=$1::jsonb WHERE id=2',[JSON.stringify(household.family_members)]);
        await syncRecordedHouseholdChildren(client,2);
        assert.equal((await client.query("SELECT * FROM family_relationships WHERE kind='parent' AND deleted_at IS NULL AND source_household_id=2")).rowCount,2);
        assert.equal((await client.query('SELECT household_id FROM members WHERE id=4')).rows[0].household_id,2);
      } finally { await client.query('ROLLBACK');client.release(); }
    });
    await t.test(
      "own household and both parents remain separate, including existing edits",
      async () => {
        await tx((client) =>
          saveFamilyLinks(client, 3, {
            parents_household_id: 1,
            parents: [
              { member_id: 1, role: "father" },
              { member_id: 2, role: "mother" },
            ],
          }),
        );
        const members = (
          await isolated.query(
            "SELECT id,household_id,parents_household_id FROM members ORDER BY id",
          )
        ).rows;
        assert.equal(members[0].household_id, 1);
        assert.equal(members[1].household_id, 1);
        assert.equal(members[2].household_id, 2);
        assert.equal(members[2].parents_household_id, 1);
        await tx((client) =>
          saveFamilyLinks(client, 3, {
            parents_household_id: 1,
            parents: [
              { person_id: person(1), role: "father" },
              { person_id: person(2), role: "mother" },
            ],
          }),
        );
        assert.equal(
          (await isolated.query("SELECT * FROM family_relationships")).rowCount,
          2,
        );
      },
    );
    await t.test(
      "self links, duplicate roles, missing members and cycles roll back",
      async () => {
        await assert.rejects(
          tx((c) =>
            saveFamilyLinks(c, 3, {
              parents_household_id: 1,
              parents: [{ member_id: 3, role: "father" }],
            }),
          ),
          /themselves/,
        );
        await assert.rejects(
          tx((c) =>
            saveFamilyLinks(c, 3, { parents_household_id: 999, parents: [] }),
          ),
          /no longer exists/,
        );
        await assert.rejects(
          tx((c) =>
            saveFamilyLinks(c, 3, {
              parents_household_id: 1,
              parents: [{ member_id: 999, role: "father" }],
            }),
          ),
          /no longer exists/,
        );
        await assert.rejects(
          tx((c) =>
            saveFamilyLinks(c, 1, {
              parents_household_id: 2,
              parents: [{ member_id: 3, role: "father" }],
            }),
          ),
          /ancestry cycle/,
        );
        await assert.rejects(
          tx((c) =>
            saveFamilyLinks(c, 3, {
              parents_household_id: 1,
              parents: [
                { member_id: 1, role: "father" },
                { member_id: 2, role: "father" },
              ],
            }),
          ),
          /already recorded/,
        );
        assert.equal(
          (await isolated.query("SELECT * FROM family_relationships")).rowCount,
          2,
        );
      },
    );
    await t.test(
      "registered spouses are reciprocal without moving households; parent spouses fail",
      async () => {
        await tx(async (c) => {
          await lockFamily(c);
          await addRelationship(c, person(3), person(4), "spouse");
        });
        assert.equal(
          (await isolated.query("SELECT spouse_id FROM members WHERE id=3"))
            .rows[0].spouse_id,
          4,
        );
        assert.equal(
          (await isolated.query("SELECT spouse_id FROM members WHERE id=4"))
            .rows[0].spouse_id,
          3,
        );
        await assert.rejects(
          tx((c) => addRelationship(c, person(1), person(3), "spouse")),
          /ancestor|already recorded/,
        );
        await tx((c) => syncMemberSpouse(c, 3));
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM family_relationships WHERE kind='spouse'",
            )
          ).rowCount,
          1,
        );
        await tx((c) =>
          addRelationship(c, person(3), person(5), "parent", "parent"),
        );
      },
    );
    await t.test(
      "unregistered grandparent links explicitly to a same-name member and retains edges",
      async () => {
        const placeholder = await tx(async (c) => {
          const id = await resolvePerson(c, {
            name: "Same Name",
            household_id: 1,
          });
          await addRelationship(c, id, person(1), "parent", "mother");
          return id;
        });
        await tx((c) => linkFamilyPerson(c, placeholder, 6));
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM family_relationships WHERE from_person_id=$1 AND to_person_id=$2",
              [person(6), person(1)],
            )
          ).rowCount,
          1,
        );
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM family_relationships WHERE from_person_id=$1",
              [person(7)],
            )
          ).rowCount,
          0,
        );
        assert.equal(
          (
            await isolated.query(
              "SELECT merged_into_id FROM family_people WHERE id=$1",
              [placeholder],
            )
          ).rows[0].merged_into_id,
          person(6),
        );
      },
    );
    await t.test(
      "a failed member transaction does not leave a household, relatives or ancestry behind",
      async () => {
        const before = (
          await isolated.query("SELECT COUNT(*) FROM family_people")
        ).rows[0].count;
        await assert.rejects(
          tx(async (c) => {
            const household = (
              await c.query(
                "INSERT INTO households(name) VALUES('Rollback') RETURNING id",
              )
            ).rows[0].id;
            const member = (
              await c.query(
                "INSERT INTO members(first_name,last_name,birthdate,household_id) VALUES('New','Adult','1990-01-01',$1) RETURNING id",
                [household],
              )
            ).rows[0].id;
            await saveFamilyLinks(c, member, {
              parents_household_id: 1,
              parents: [{ name: "Named parent", role: "father" }],
            });
            throw new Error("Simulated failure");
          }),
          /Simulated failure/,
        );
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM households WHERE name='Rollback'",
            )
          ).rowCount,
          0,
        );
        assert.equal(
          (await isolated.query("SELECT COUNT(*) FROM family_people")).rows[0]
            .count,
          before,
        );
      },
    );
    // Actual HTTP handlers and auth middleware; all database access is redirected to this isolated schema.
    db.get = (async (q: string, p: any[] = []) =>
      q.includes("FROM users u")
        ? {
            id: 1,
            name: "Test",
            role_name: p[0] === 2 ? "Member" : "Admin",
            role_id: 1,
          }
        : (await isolated.query(q, p)).rows[0]) as any;
    db.all = (async (q: string, p: any[] = []) =>
      q.includes("FROM user_ministries")
        ? []
        : (await isolated.query(q, p)).rows) as any;
    db.transaction = tx;
    (sql as any).begin = (work: any) =>
      tx((client) =>
        work({
          unsafe: async (q: string, p: any[] = []) =>
            (await client.query(q, p)).rows,
        }),
      );
    const app = express();
    app.use(express.json());
    app.use("/family", router);
    app.use("/backup", backupRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server!.once("listening", r));
    const base = `http://127.0.0.1:${(server.address() as any).port}/family`,
      headers = (id = 1) => ({
        Authorization: `Bearer ${jwt.sign({ id }, JWT_SECRET)}`,
        "Content-Type": "application/json",
      });
    await t.test(
      "API requires auth/role, reads across households and audits relationship writes",
      async () => {
        assert.equal((await fetch(base + "/households/2/tree")).status, 401);
        assert.equal(
          (await fetch(base + "/households/2/tree", { headers: headers(2) }))
            .status,
          403,
        );
        const orphans=(await isolated.query("INSERT INTO family_people(name,household_id) VALUES('Adult Santos',2),('Removed placeholder',2) RETURNING id")).rows.map(p=>p.id);
        const localTree:any = await (await fetch(base + "/households/2/tree", {headers:headers()})).json();
        assert.ok(localTree.people.some((p:any)=>p.member_id===3));
        assert.ok(localTree.people.every((p:any)=>p.household_id===2),"default read stays within the selected household");
        const result = await fetch(base + "/households/2/tree?scope=extended", {
          headers: headers(),
        });
        assert.equal(result.status, 200);
        const tree: any = await result.json();
        assert.ok(tree.people.every((p: any)=>!orphans.includes(p.id)),"unused named placeholders and duplicate names are not household tree roots");
        await isolated.query("DELETE FROM family_people WHERE id=ANY($1)",[orphans]);
        assert.ok(tree.people.some((p: any) => p.member_id === 1));
        assert.ok(tree.people.some((p: any) => p.member_id === 6));
        const parents: any = await (
          await fetch(base + "/members/3/parents", { headers: headers() })
        ).json();
        assert.equal(parents.parents.length, 2);
        const added = await fetch(base + "/relationships", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            from: { person_id: person(7) },
            to: { person_id: person(5) },
            kind: "guardian",
          }),
        });
        assert.equal(added.status, 200);
        let { id } = (await added.json()) as any;
        const edited = await fetch(base + `/relationships/${id}`, {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify({
            from: { person_id: person(7) },
            to: { person_id: person(5) },
            kind: "parent",
            parent_role: "parent",
          }),
        });
        assert.equal(edited.status, 200);
        id = ((await edited.json()) as any).id;
        assert.equal(
          (
            await fetch(base + `/relationships/${id}`, {
              method: "DELETE",
              headers: headers(),
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM audit_logs WHERE target_table='family_relationships'",
            )
          ).rowCount,
          3,
        );
        assert.equal(
          (await isolated.query("SELECT * FROM members WHERE id=5")).rowCount,
          1,
        );
      },
    );
    await t.test(
      "backup merge remaps serial identities, repeats safely and rejects missing edges atomically",
      async () => {
        const people = (await isolated.query("SELECT * FROM family_people"))
            .rows,
          edges = (await isolated.query("SELECT * FROM family_relationships"))
            .rows;
        const shifted = people.map((p) => ({
            ...p,
            id: p.id + 500,
            merged_into_id: p.merged_into_id ? p.merged_into_id + 500 : null,
          })),
          shiftedEdges = edges.map((e) => ({
            ...e,
            from_person_id: e.from_person_id + 500,
            to_person_id: e.to_person_id + 500,
          }));
        await tx((c) => restoreFamilyGraph(c, shifted, shiftedEdges));
        await tx((c) => restoreFamilyGraph(c, shifted, shiftedEdges));
        assert.equal(
          (await isolated.query("SELECT * FROM family_relationships")).rowCount,
          edges.length,
        );
        await assert.rejects(
          tx((c) =>
            restoreFamilyGraph(c, shifted, [
              { ...shiftedEdges[0], to_person_id: 99999 },
            ]),
          ),
          /missing backup person/,
        );
        await tx((c) => restoreFamilyGraph(c, undefined, undefined));
        const spouse = edges.find((e) => e.kind === "spouse");
        await tx((c) => removeRelationship(c, spouse.id));
        assert.equal(
          (await isolated.query("SELECT spouse_id FROM members WHERE id=3"))
            .rows[0].spouse_id,
          null,
        );
      },
    );
    await t.test(
      "full export/replace restore preserves graph, circular spouses and accepts older backups",
      async () => {
        await isolated.query("UPDATE users SET password_hash=$1 WHERE id=1", [
          await bcrypt.hash("test-password", 4),
        ]);
        await tx((c) => addRelationship(c, person(3), person(4), "spouse"));
        const backupBase = base.replace("/family", "/backup");
        const exported = await fetch(backupBase + "/export", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ year: "all", password: "test-password" }),
        });
        assert.equal(exported.status, 200, await exported.clone().text());
        const snapshot: any = await exported.json();
        assert.ok(snapshot.data.family_people.length);
        assert.ok(snapshot.data.family_relationships.length);
        const restored = await fetch(backupBase + "/restore", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            data: snapshot,
            mode: "replace",
            password: "test-password",
          }),
        });
        assert.equal(restored.status, 200, await restored.clone().text());
        assert.equal(
          (await isolated.query("SELECT spouse_id FROM members WHERE id=3"))
            .rows[0].spouse_id,
          4,
        );
        assert.equal(
          (await isolated.query("SELECT spouse_id FROM members WHERE id=4"))
            .rows[0].spouse_id,
          3,
        );
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM family_relationships WHERE deleted_at IS NULL AND kind='parent'",
            )
          ).rowCount,
          4,
        );
        delete snapshot.data.family_people;
        delete snapshot.data.family_relationships;
        const legacy = await fetch(backupBase + "/restore", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            data: snapshot,
            mode: "replace",
            password: "test-password",
          }),
        });
        assert.equal(legacy.status, 200, await legacy.clone().text());
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM family_relationships WHERE kind='parent'",
            )
          ).rowCount,
          0,
        );
        assert.equal(
          (
            await isolated.query(
              "SELECT * FROM family_relationships WHERE kind='spouse'",
            )
          ).rowCount,
          1,
        );
      },
    );
  } finally {
    db.get = original.get;
    db.all = original.all;
    db.transaction = original.transaction;
    (sql as any).begin = original.begin;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((r) => server!.close(() => r()));
    }
    await isolated.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
after(async () => {
  await pool.end();
});
