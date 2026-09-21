import { Pool, PoolClient, QueryResult } from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "server", ".env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../server/.env")
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export function cleanDbConnectionString(raw?: string): string {
  let url = (raw || "").trim();
  if (url.startsWith("DATABASE_URL=")) {
    url = url.substring("DATABASE_URL=".length).trim();
  }
  url = url.replace(/^["']+|["']+$/g, "");
  return url || "postgres://postgres:admin123@localhost:5432/chms_db";
}

const connectionString = cleanDbConnectionString(process.env.DATABASE_URL);
const isSupabaseOrRemote = connectionString.includes("supabase") || connectionString.includes("render") || connectionString.includes("sslmode=require") || process.env.NODE_ENV === "production";

/**
 * Shared PostgreSQL connection pool (Single instance across all requests)
 * Configured with max 15, idleTimeoutMillis 30000, connectionTimeoutMillis 5000
 */
export const pool = new Pool({
  connectionString,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isSupabaseOrRemote ? { rejectUnauthorized: false } : undefined
});

// Handle unexpected idle client errors
pool.on("error", (err: Error) => {
  console.error("⚠️ [pg.Pool] Unexpected error on idle PostgreSQL client:", err);
});

import { logSlowQuery } from "../utils/logger";

/**
 * Clean helper wrapper for executing PostgreSQL queries & transactions
 */
export const db = {
  pool,

  /**
   * Execute raw SQL string (e.g. DDL / multi-statement script)
   */
  async exec(queryStr: string) {
    const start = Date.now();
    try {
      return await pool.query(queryStr);
    } finally {
      logSlowQuery(queryStr, Date.now() - start);
    }
  },

  /**
   * Execute parameterized query
   */
  async query<T = any>(queryStr: string, params: any[] = []): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      return await pool.query<T>(queryStr, params);
    } finally {
      logSlowQuery(queryStr, Date.now() - start, params);
    }
  },

  /**
   * Query all rows
   */
  async all<T = any>(queryStr: string, params: any[] = []): Promise<T[]> {
    const start = Date.now();
    try {
      const res = await pool.query<T>(queryStr, params);
      return res.rows;
    } finally {
      logSlowQuery(queryStr, Date.now() - start, params);
    }
  },

  /**
   * Query single row
   */
  async get<T = any>(queryStr: string, params: any[] = []): Promise<T | null> {
    const start = Date.now();
    try {
      const res = await pool.query<T>(queryStr, params);
      return res.rows[0] || null;
    } finally {
      logSlowQuery(queryStr, Date.now() - start, params);
    }
  },

  /**
   * Execute INSERT/UPDATE/DELETE and return metadata
   */
  async run(queryStr: string, params: any[] = []) {
    const start = Date.now();
    try {
      const res = await pool.query(queryStr, params);
      return {
        lastInsertRowid: (res.rows[0] as any)?.id || null,
        changes: res.rowCount || 0
      };
    } finally {
      logSlowQuery(queryStr, Date.now() - start, params);
    }
  },

  /**
   * Execute operations inside a database transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const start = Date.now();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
      logSlowQuery("TRANSACTION BLOCK", Date.now() - start);
    }
  }
};

/**
 * Tagged template helper for raw / parameterized SQL compatibility
 */
export const sql: any = async (strings: TemplateStringsArray, ...values: any[]) => {
  let text = "";
  const params: any[] = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }
  const result = await pool.query(text, params);
  return result.rows;
};

sql.unsafe = async (queryStr: string, params: any[] = []) => {
  const result = await pool.query(queryStr, params);
  return result.rows;
};

sql.begin = async (callback: (tx: any) => Promise<any>) => {
  return db.transaction(async (client) => {
    const txSql: any = async (strings: TemplateStringsArray, ...values: any[]) => {
      let text = "";
      const params: any[] = [];
      for (let i = 0; i < strings.length; i++) {
        text += strings[i];
        if (i < values.length) {
          params.push(values[i]);
          text += `$${params.length}`;
        }
      }
      const res = await client.query(text, params);
      return res.rows;
    };
    txSql.unsafe = async (q: string, p: any[] = []) => {
      const res = await client.query(q, p);
      return res.rows;
    };
    return await callback(txSql);
  });
};

/**
 * Robust helper to locate migration SQL files across development (src/) and production (dist/) paths
 */
export function getMigrationFilePath(filename: string): string | null {
  const candidates = [
    path.resolve(__dirname, "migrations", filename),
    path.resolve(__dirname, "../../src/db/migrations", filename),
    path.resolve(__dirname, "../src/db/migrations", filename),
    path.resolve(process.cwd(), "src/db/migrations", filename),
    path.resolve(process.cwd(), "server/src/db/migrations", filename),
    path.resolve(__dirname, "../../server/src/db/migrations", filename)
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

/**
 * Initialize PostgreSQL Schema & Base Seed data
 */
export async function initSchema() {
  try {
    const initSqlPath = getMigrationFilePath("001_init_postgres.sql");
    const seedSqlPath = getMigrationFilePath("002_seed_postgres.sql");

    // 1. Ensure all 19 system tables exist
    if (initSqlPath) {
      console.log(`📄 Initializing schema from: ${initSqlPath}`);
      const initSql = fs.readFileSync(initSqlPath, "utf-8");
      await sql.unsafe(initSql);
      console.log("✅ PostgreSQL schema verified & all tables ensured.");
    } else {
      console.warn("⚠️ 001_init_postgres.sql path not resolved, creating core tables inline...");
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS ministries (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, min_age INT, max_age INT, description TEXT, color VARCHAR(20) DEFAULT '#2C3968');
        CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, username VARCHAR(100) UNIQUE, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS user_ministries (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, ministry_id INT NOT NULL REFERENCES ministries(id) ON DELETE CASCADE, UNIQUE(user_id, ministry_id));
        CREATE TABLE IF NOT EXISTS households (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, address TEXT, primary_contact_phone VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS members (id SERIAL PRIMARY KEY, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, birthdate DATE NOT NULL, gender VARCHAR(20), contact_email VARCHAR(255), contact_phone VARCHAR(50), household_id INT REFERENCES households(id) ON DELETE SET NULL, ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, user_id INT REFERENCES users(id) ON DELETE SET NULL, status VARCHAR(50) NOT NULL DEFAULT 'active', photo_url VARCHAR(500), medical_notes TEXT, grade_level VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, start_time TIMESTAMP WITH TIME ZONE NOT NULL, end_time TIMESTAMP WITH TIME ZONE NOT NULL, location VARCHAR(255), ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, created_by INT REFERENCES users(id) ON DELETE SET NULL, rsvp_enabled INT DEFAULT 1, max_capacity INT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS event_rsvps (id SERIAL PRIMARY KEY, event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE, member_id INT REFERENCES members(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, guests_count INT DEFAULT 0, status VARCHAR(20) DEFAULT 'attending', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id, member_id));
        CREATE TABLE IF NOT EXISTS attendance (id SERIAL PRIMARY KEY, member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE, ministry_id INT NOT NULL REFERENCES ministries(id) ON DELETE CASCADE, event_id INT REFERENCES events(id) ON DELETE SET NULL, checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, checked_in_by INT REFERENCES users(id) ON DELETE SET NULL, security_tag VARCHAR(50), checked_out_at TIMESTAMP WITH TIME ZONE, checked_out_by INT REFERENCES users(id) ON DELETE SET NULL, notes TEXT);
        CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, body TEXT NOT NULL, ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, is_pinned INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS funds (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT, target_amount DECIMAL(12, 2) DEFAULT 0, is_active INT DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS donations (id SERIAL PRIMARY KEY, member_id INT REFERENCES members(id) ON DELETE SET NULL, fund_id INT NOT NULL REFERENCES funds(id) ON DELETE RESTRICT, amount DECIMAL(12, 2) NOT NULL, donated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, payment_method VARCHAR(50) DEFAULT 'Cash', notes TEXT, recorded_by INT REFERENCES users(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(50) NOT NULL, target_table VARCHAR(50) NOT NULL, target_id INT, details TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS bible_study_groups (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, curriculum VARCHAR(255), ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, leader_name VARCHAR(255) NOT NULL, leader_contact VARCHAR(100), meeting_day VARCHAR(50) NOT NULL, meeting_time VARCHAR(50) NOT NULL, location VARCHAR(255) NOT NULL, category VARCHAR(50) NOT NULL DEFAULT 'General', max_capacity INT DEFAULT 12, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS bible_study_topics (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, total_chapters INT DEFAULT 1, summary_notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS system_lookups (id SERIAL PRIMARY KEY, type VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, color VARCHAR(20) DEFAULT '#2C3968', sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(type, name));
        CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL, category VARCHAR(100) DEFAULT 'general', updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
      `);
    }

    // Cleanly drop deprecated prayer_requests and deprecated columns from bible_study_topics in existing databases
    try {
      await sql.unsafe(`
        DROP TABLE IF EXISTS prayer_requests;
        ALTER TABLE bible_study_topics
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS completed_date,
        DROP COLUMN IF EXISTS completed_chapters,
        DROP COLUMN IF EXISTS type,
        DROP COLUMN IF EXISTS testament_or_category,
        DROP COLUMN IF EXISTS lead_teacher,
        DROP COLUMN IF EXISTS key_verse,
        DROP COLUMN IF EXISTS assigned_group_id,
        DROP COLUMN IF EXISTS assigned_ministry_id;
      `);
    } catch { }

    // 2. Ensure username column exists
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE`;
    } catch { }

    // 3. Ensure all 5 roles exist (Admin, Coordinator, Leader, Volunteer, Member)
    try {
      await sql`
        INSERT INTO roles (name) VALUES ('Admin'), ('Coordinator'), ('Leader'), ('Volunteer'), ('Member')
        ON CONFLICT (name) DO NOTHING;
      `;
    } catch { }

    // 4. Ensure membership application form columns exist on members table
    try {
      await sql`
        ALTER TABLE members
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS guardian_names TEXT,
        ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS invited_by VARCHAR(255),
        ADD COLUMN IF NOT EXISTS school_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS program_major VARCHAR(255),
        ADD COLUMN IF NOT EXISTS class_schedule TEXT,
        ADD COLUMN IF NOT EXISTS occupation VARCHAR(255),
        ADD COLUMN IF NOT EXISTS hobbies TEXT,
        ADD COLUMN IF NOT EXISTS previous_church VARCHAR(255),
        ADD COLUMN IF NOT EXISTS facebook_account VARCHAR(100),
        ADD COLUMN IF NOT EXISTS family_details TEXT,
        ADD COLUMN IF NOT EXISTS application_date DATE,
        ADD COLUMN IF NOT EXISTS civil_status VARCHAR(50) DEFAULT 'Single',
        ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS spouse_id INT REFERENCES members(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_baptized BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS baptism_status VARCHAR(50) DEFAULT 'not_baptized',
        ADD COLUMN IF NOT EXISTS baptism_date DATE,
        ADD COLUMN IF NOT EXISTS baptism_notes TEXT;
      `;
    } catch { }

    // 4. Ensure 7 core ministries exist
    try {
      await sql`
        INSERT INTO ministries (name, min_age, max_age, description, color) VALUES
          ('Kinder', 3, 5, 'Ages 3-5: Bible stories, play, crafts, and secure child check-in', '#E07A5F'),
          ('Elementary', 6, 12, 'Ages 6-12: Interactive Sunday school, worship, and Scripture memory', '#D9A441'),
          ('Highschool', 13, 16, 'Ages 13-16: Teen fellowship, small groups, and discipleship', '#B85C56'),
          ('Youth', 17, 21, 'Ages 17-21: College & young adults campus outreach, deep worship', '#6E8B74'),
          ('Young Adult', 22, 35, 'Ages 22-35: Career navigation, marriage & life foundation', '#2C3968'),
          ('Junior Adult', 36, 55, 'Ages 36-55: Family life, parenting, leadership and community impact', '#4A5568'),
          ('Old Adult', 56, 120, 'Ages 56+: Golden years fellowship, prayer warriors & legacy mentorship', '#8D5B4C')
        ON CONFLICT (name) DO NOTHING;
      `;
    } catch { }

    // 5. Ensure default system lookups & settings if baseline seed exists
    const lookupCount = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM system_lookups");
    if (Number(lookupCount?.count || 0) === 0 && seedSqlPath) {
      console.log("🌱 Applying baseline system lookups & settings...");
      const seedSql = fs.readFileSync(seedSqlPath, "utf-8");
      await sql.unsafe(seedSql);
    }

    // 6. Ensure Saturday Duty Roster tables exist
    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS duty_teams (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
          leader_id INT REFERENCES members(id) ON DELETE SET NULL,
          leader_name VARCHAR(255),
          color VARCHAR(20) DEFAULT '#2C3968',
          order_seq INT DEFAULT 1,
          tasks_checklist TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS duty_team_members (
          id SERIAL PRIMARY KEY,
          team_id INT NOT NULL REFERENCES duty_teams(id) ON DELETE CASCADE,
          member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          role VARCHAR(50) DEFAULT 'Member',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, member_id)
        );

        CREATE TABLE IF NOT EXISTS duty_schedules (
          id SERIAL PRIMARY KEY,
          duty_date DATE NOT NULL,
          team_id INT NOT NULL REFERENCES duty_teams(id) ON DELETE CASCADE,
          ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
          status VARCHAR(50) DEFAULT 'scheduled',
          notes TEXT,
          completed_at TIMESTAMP WITH TIME ZONE,
          UNIQUE(duty_date, team_id)
        );

        CREATE INDEX IF NOT EXISTS idx_duty_teams_ministry ON duty_teams(ministry_id);
        CREATE INDEX IF NOT EXISTS idx_duty_schedules_date ON duty_schedules(duty_date);
      `);
    } catch (e: any) {
      console.warn("Duty table check note:", e.message);
    }

    // 7. Ensure dishwashing tables exist
    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS dishwashing_roster (
          id SERIAL PRIMARY KEY,
          duty_date DATE NOT NULL,
          event_name VARCHAR(150) DEFAULT 'Sunday Fellowship Lunch',
          cycle_mode VARCHAR(50) NOT NULL DEFAULT 'biblestudy_group',
          cycle_order_index INT DEFAULT 0,
          biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
          ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
          assigned_name VARCHAR(150) NOT NULL,
          leader_name VARCHAR(150),
          leader_contact VARCHAR(100),
          partner_assigned_name VARCHAR(150),
          partner_leader_name VARCHAR(150),
          partner_biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
          partner_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
          is_joint_duty BOOLEAN DEFAULT false,
          volunteers_count INT DEFAULT 4,
          status VARCHAR(50) DEFAULT 'scheduled',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dishwashing_teams (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          cycle_mode VARCHAR(50) DEFAULT 'biblestudy_group',
          biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
          ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
          leader_id INT REFERENCES members(id) ON DELETE SET NULL,
          leader_name VARCHAR(150),
          leader_contact VARCHAR(100),
          color VARCHAR(20) DEFAULT '#2C3968',
          order_seq INT DEFAULT 1,
          tasks_checklist TEXT,
          volunteers_count INT DEFAULT 4,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dishwashing_team_members (
          id SERIAL PRIMARY KEY,
          team_id INT NOT NULL REFERENCES dishwashing_teams(id) ON DELETE CASCADE,
          member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          role VARCHAR(50) DEFAULT 'Member',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, member_id)
        );

        CREATE TABLE IF NOT EXISTS dishwashing_schedules (
          id SERIAL PRIMARY KEY,
          duty_date DATE NOT NULL,
          team_id INT REFERENCES dishwashing_teams(id) ON DELETE CASCADE,
          biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
          ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
          assigned_name VARCHAR(150),
          leader_name VARCHAR(150),
          status VARCHAR(50) DEFAULT 'scheduled',
          notes TEXT,
          completed_at TIMESTAMP WITH TIME ZONE,
          UNIQUE(duty_date, team_id)
        );

        CREATE INDEX IF NOT EXISTS idx_dishwashing_duty_date ON dishwashing_roster(duty_date);
        CREATE INDEX IF NOT EXISTS idx_dishwashing_status ON dishwashing_roster(status);
        CREATE INDEX IF NOT EXISTS idx_dishwashing_teams_seq ON dishwashing_teams(order_seq);
        CREATE INDEX IF NOT EXISTS idx_dishwashing_schedules_date ON dishwashing_schedules(duty_date);

        ALTER TABLE dishwashing_roster
        ADD COLUMN IF NOT EXISTS partner_assigned_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS partner_leader_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS partner_biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS partner_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_joint_duty BOOLEAN DEFAULT false;
      `);

      // Seed default dishwashing rotating teams from existing BS groups and ministries if empty
      try {
        const teamCount = await sql`SELECT COUNT(*) as count FROM dishwashing_teams`;
        if (Number(teamCount[0]?.count || 0) === 0) {
          const bsGroups = await sql`SELECT id, name, leader_name, ministry_id FROM bible_study_groups ORDER BY id ASC LIMIT 6`;
          let seq = 1;
          for (const g of bsGroups) {
            await sql`
              INSERT INTO dishwashing_teams (name, cycle_mode, biblestudy_group_id, ministry_id, leader_name, color, order_seq, tasks_checklist)
              VALUES (${g.name}, 'biblestudy_group', ${g.id}, ${g.ministry_id || null}, ${g.leader_name || 'Group Leader'}, ${seq % 2 === 1 ? '#2C3968' : '#E07A5F'}, ${seq}, 'Pre-rinse plates and cups, Wash with hot soapy water, Sanitize and wipe down kitchen countertops, Dispose food waste and trash')
            `;
            seq++;
          }
          const mins = await sql`SELECT id, name, color FROM ministries ORDER BY id ASC LIMIT 4`;
          for (const m of mins) {
            await sql`
              INSERT INTO dishwashing_teams (name, cycle_mode, ministry_id, leader_name, color, order_seq, tasks_checklist)
              VALUES (${m.name + ' Ministry'}, 'ministry', ${m.id}, 'Ministry Coordinator', ${m.color || '#3D5A80'}, ${seq}, 'Pre-rinse plates and cups, Wash with hot soapy water, Sanitize and wipe down kitchen countertops, Dispose food waste and trash')
            `;
            seq++;
          }
        }
      } catch (seedErr: any) {
        console.warn("Dishwashing seeding note:", seedErr.message);
      }

      // 8. Ensure chapter, progress tracking, and reschedule columns exist on bible_study_groups
      try {
        await sql.unsafe(`
          ALTER TABLE bible_study_groups
          ADD COLUMN IF NOT EXISTS current_chapter VARCHAR(100) DEFAULT 'Chapter 1',
          ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(100) DEFAULT 'in_progress',
          ADD COLUMN IF NOT EXISTS progress_notes TEXT,
          ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS rescheduled_date VARCHAR(50),
          ADD COLUMN IF NOT EXISTS rescheduled_time VARCHAR(100),
          ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
        `);
      } catch { }

      // 9. Ensure Daily Bible Reading Plan user progress tracking table exists
      try {
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS user_bible_reading_progress (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            day_key VARCHAR(50) NOT NULL,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            UNIQUE(user_id, day_key)
          );

          CREATE INDEX IF NOT EXISTS idx_bible_reading_user_id ON user_bible_reading_progress(user_id);
          CREATE INDEX IF NOT EXISTS idx_bible_reading_day_key ON user_bible_reading_progress(day_key);
          CREATE INDEX IF NOT EXISTS idx_bible_reading_completed_at ON user_bible_reading_progress(completed_at);
        `);
      } catch (brErr: any) {
        console.warn("Bible reading table init note:", brErr.message);
      }

      // 10. Ensure Recurring Sunday Annual Events table exists
      try {
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS recurring_sunday_events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            theme_tagline TEXT,
            description TEXT,
            month INT NOT NULL,
            week_pattern VARCHAR(50) NOT NULL DEFAULT '1st_sunday',
            target_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
            target_ministry_name VARCHAR(100),
            color VARCHAR(50) DEFAULT '#2C3968',
            icon VARCHAR(50) DEFAULT 'Sparkles',
            liturgical_notes TEXT,
            program_highlights TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_recurring_sunday_events_month ON recurring_sunday_events(month);
        `);

        const sundayEventsCount = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM recurring_sunday_events");
        if (Number(sundayEventsCount?.count || 0) === 0) {
          console.log("🌱 Seeding default Annual Sunday Church Events Cycle...");
          await sql`
            INSERT INTO recurring_sunday_events (title, theme_tagline, description, month, week_pattern, target_ministry_name, color, icon, program_highlights, liturgical_notes) VALUES
              ('New Year Covenant & Consecration Sunday', 'Commit your way to the Lord; trust in Him (Psalm 37:5)', 'Church-wide spiritual dedication and prayer covenant for the incoming ministry year.', 1, '1st_sunday', 'Church-wide / All Ministries', '#4F46E5', 'Sparkles', 'Covenant Prayer Cards, Holy Communion, Ministry Leaders Consecration', 'Liturgical White & Gold'),
              ('Youth Harvest & Campus Commissioning Sunday', 'Let no one despise your youth, but set an example (1 Timothy 4:12)', 'Honoring Christian youth disciples, campus ambassadors, and young leaders.', 2, '3rd_sunday', 'Youth Ministry', '#D97706', 'Flame', 'Youth Band Praise & Worship, Spoken Word, Campus Commissioning Blessing', 'Energetic Amber & Gold'),
              ('Resurrection Sunday / Easter Triumph', 'He is not here; He has risen! (Luke 24:6)', 'Grand celebratory Sunday marking the triumph of Christ over the grave.', 4, '1st_sunday', 'Church-wide / All Ministries', '#7C3AED', 'Sun', 'Sunrise Fellowship, Grand Easter Cantata, Family Photo Booth, Holy Communion', 'Royal Purple & Radiant Gold'),
              ('Mother''s Day Celebration Sunday', 'Her children arise and call her blessed (Proverbs 31:28)', 'A tribute Sunday honoring all godly mothers, grandmothers, and spiritual mothers.', 5, '2nd_sunday', 'Junior & Old Adult / Women', '#E11D48', 'Heart', 'Floral Token Distribution, Special Song from Children, Mother-Child Blessing Prayer', 'Rose Pink & Warm Ivory'),
              ('Father''s Day Celebration Sunday', 'As for me and my house, we will serve the Lord (Joshua 24:15)', 'Honoring Christian fathers, household heads, and spiritual leaders of the home.', 6, '3rd_sunday', 'Junior & Old Adult / Men', '#2563EB', 'ShieldCheck', 'Fathers Blessing Altar Call, Brotherhood Recognition, Fellowship Lunch', 'Deep Royal Blue & Silver'),
              ('Grand Church Anniversary & Homecoming Sunday', 'The Lord has done great things for us, and we are filled with joy (Psalm 126:3)', 'Our annual church founding thanksgiving celebration and grand alumni homecoming.', 7, 'last_sunday', 'Church-wide / All Ministries', '#059669', 'Award', 'Historical Video Documentary, Agape Thanksgiving Banquet, Ordination & Dedication', 'Emerald Green & Gold'),
              ('Missions & Evangelism Impact Sunday', 'Go into all the world and proclaim the gospel (Mark 16:15)', 'Spotlight on local community outreach, church planting, and global mission partners.', 8, '3rd_sunday', 'Church-wide / Outreach', '#EA580C', 'Globe', 'Missionary Testimonies, Faith-Promise Giving Pledge, Outreach Highlights', 'Fiery Orange & Earth Brown'),
              ('Teachers'' & Sunday School Educators Day', 'And the things you have heard me say... entrust to reliable people (2 Timothy 2:2)', 'Appreciation Sunday honoring Sunday school teachers, cell group leaders, and catechists.', 9, '4th_sunday', 'Sunday School & Educators', '#0284C7', 'BookOpen', 'Educator Appreciation Plaque, Gift Tokens from Students, Teaching Ministry Tribute', 'Sky Blue & Academic Gold'),
              ('Pastoral & Clergy Appreciation Sunday', 'Honor those who work hard among you and care for you (1 Thessalonians 5:12-13)', 'A special Sunday to bless, honor, and pray over the pastors, ministers, and pastoral families.', 10, '2nd_sunday', 'Church-wide / Leadership', '#9333EA', 'Crown', 'Love Gift Offering, Pastoral Family Tribute Video, Congregation Prayer of Blessing', 'Royal Violet & Gold'),
              ('Children''s Day & Sunday School Festival', 'Let the little children come to me, and do not hinder them (Matthew 19:14)', 'A joyful Sunday dedicated to kids, Sunday School presentations, and family celebration.', 10, '4th_sunday', 'Kinder & Elementary', '#F59E0B', 'Smile', 'Children Choir Special, Bible Costume Parade, Sunday School Awards & Treat Bags', 'Bright Yellow, Coral & Cyan'),
              ('Water Baptism & Discipleship Harvest Sunday', 'Buried with Him in baptism, raised to walk in new life (Romans 6:4)', 'Solemn and celebratory Sunday ceremony for disciples receiving holy Water Baptism.', 11, '3rd_sunday', 'Discipleship / Candidates', '#0891B2', 'Droplets', 'Water Baptism Ceremony, Testimony Videos, Candidates Certificate Conferment', 'Cyan, Aqua & Ocean Blue'),
              ('Christmas Thanksgiving & Year-End Dedication', 'For unto us a Child is born, unto us a Son is given (Isaiah 9:6)', 'Grand year-end Christmas worship service celebrating the incarnation of Christ.', 12, 'last_sunday', 'Church-wide / All Ministries', '#DC2626', 'Gift', 'Candlelight Service, Christmas Carol Medley, Year-End Thanksgiving Testimonies', 'Christmas Crimson & Evergreen');
          `;
        }
        // 11. Ensure Bible Study Session & Attendance tracking tables exist
        try {
          await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS bible_study_sessions (
            id SERIAL PRIMARY KEY,
            group_id INT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
            session_date DATE NOT NULL,
            topic_title VARCHAR(255),
            chapter VARCHAR(100),
            notes TEXT,
            is_special BOOLEAN DEFAULT FALSE,
            special_reason TEXT,
            recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, session_date)
          );

          ALTER TABLE bible_study_sessions ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;
          ALTER TABLE bible_study_sessions ADD COLUMN IF NOT EXISTS special_reason TEXT;

          CREATE TABLE IF NOT EXISTS bible_study_attendance (
            id SERIAL PRIMARY KEY,
            group_id INT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
            session_date DATE NOT NULL,
            member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'present',
            notes TEXT,
            recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, session_date, member_id)
          );

          CREATE INDEX IF NOT EXISTS idx_bs_att_group ON bible_study_attendance(group_id);
          CREATE INDEX IF NOT EXISTS idx_bs_att_date ON bible_study_attendance(session_date);
          CREATE INDEX IF NOT EXISTS idx_bs_att_member ON bible_study_attendance(member_id);
          CREATE INDEX IF NOT EXISTS idx_bs_sess_group ON bible_study_sessions(group_id);
          CREATE INDEX IF NOT EXISTS idx_bs_sess_date ON bible_study_sessions(session_date);
        `);
        } catch (bsAttErr: any) {
          console.warn("Bible study attendance table init note:", bsAttErr.message);
        }
      } catch (e: any) {
        console.warn("Table check note:", e.message);
      }

      // Ensure high-performance indexes exist across all core tables
      try {
        await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON attendance(member_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_ministry_id ON attendance(ministry_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_checked_in_at ON attendance(checked_in_at);
        CREATE INDEX IF NOT EXISTS idx_members_household_id ON members(household_id);
        CREATE INDEX IF NOT EXISTS idx_members_ministry_id ON members(ministry_id);
        CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
        CREATE INDEX IF NOT EXISTS idx_user_ministries_user_id ON user_ministries(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_ministries_ministry_id ON user_ministries(ministry_id);
        CREATE INDEX IF NOT EXISTS idx_duty_team_members_team_id ON duty_team_members(team_id);
        CREATE INDEX IF NOT EXISTS idx_duty_team_members_member_id ON duty_team_members(member_id);
        CREATE INDEX IF NOT EXISTS idx_dishwashing_team_members_team_id ON dishwashing_team_members(team_id);
        CREATE INDEX IF NOT EXISTS idx_dishwashing_team_members_member_id ON dishwashing_team_members(member_id);
        CREATE INDEX IF NOT EXISTS idx_bible_study_members_group_id ON bible_study_members(group_id);
        CREATE INDEX IF NOT EXISTS idx_donations_fund_id ON donations(fund_id);
        CREATE INDEX IF NOT EXISTS idx_donations_member_id ON donations(member_id);
        CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
      `);
      } catch (idxErr: any) {
        console.warn("Index check note:", idxErr.message);
      }

      // 12. Ensure attendance_log view and performance indexes are created
      try {
        const attLogSqlPath = getMigrationFilePath("004_attendance_log_view.sql");
        if (attLogSqlPath && fs.existsSync(attLogSqlPath)) {
          const attLogSql = fs.readFileSync(attLogSqlPath, "utf-8");
          await sql.unsafe(attLogSql);
        } else {
          await sql.unsafe(`
            CREATE INDEX IF NOT EXISTS idx_bs_att_member_date ON bible_study_attendance(member_id, session_date);
            CREATE INDEX IF NOT EXISTS idx_bs_att_group_date ON bible_study_attendance(group_id, session_date);
            CREATE INDEX IF NOT EXISTS idx_attendance_member_checked_in ON attendance(member_id, checked_in_at);

            DROP VIEW IF EXISTS attendance_log CASCADE;

            CREATE VIEW attendance_log AS
            SELECT
              'sunday_service'::VARCHAR(50) AS log_type,
              a.member_id,
              (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
              'present'::VARCHAR(20) AS status,
              NULL::INT AS group_id,
              NULL::INT AS event_id,
              a.checked_in_at AS recorded_at
            FROM attendance a
            WHERE a.event_id IS NULL
            UNION ALL
            SELECT
              'event'::VARCHAR(50) AS log_type,
              a.member_id,
              (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
              'present'::VARCHAR(20) AS status,
              NULL::INT AS group_id,
              a.event_id AS event_id,
              a.checked_in_at AS recorded_at
            FROM attendance a
            WHERE a.event_id IS NOT NULL
            UNION ALL
            SELECT
              'event'::VARCHAR(50) AS log_type,
              er.member_id,
              (COALESCE(e.start_time, er.created_at) AT TIME ZONE 'Asia/Manila')::DATE AS log_date,
              'present'::VARCHAR(20) AS status,
              NULL::INT AS group_id,
              er.event_id AS event_id,
              er.created_at AS recorded_at
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            WHERE er.status = 'attended'
              AND NOT EXISTS (
                SELECT 1 FROM attendance a
                WHERE a.event_id = er.event_id AND a.member_id = er.member_id
              )
            UNION ALL
            SELECT
              'bible_study'::VARCHAR(50) AS log_type,
              bsa.member_id,
              bsa.session_date AS log_date,
              bsa.status::VARCHAR(20) AS status,
              bsa.group_id,
              NULL::INT AS event_id,
              bsa.created_at AS recorded_at
            FROM bible_study_attendance bsa;
          `);
        }
      } catch (attLogErr: any) {
        console.warn("Attendance log view init note:", attLogErr.message);
      }

      // 13. Ensure services table exists for Service Calendar & Attendance Intelligence
      try {
        const servicesMigrationPath = getMigrationFilePath("005_service_calendar_and_attendance_intelligence.sql");
        if (servicesMigrationPath && fs.existsSync(servicesMigrationPath)) {
          const servicesSql = fs.readFileSync(servicesMigrationPath, "utf-8");
          await sql.unsafe(servicesSql);
        } else {
          await sql.unsafe(`
            CREATE TABLE IF NOT EXISTS services (
              id SERIAL PRIMARY KEY,
              service_date DATE NOT NULL,
              service_type VARCHAR(50) NOT NULL DEFAULT 'sunday_service',
              title VARCHAR(255) NOT NULL DEFAULT 'Sunday Worship Service',
              status VARCHAR(50) NOT NULL DEFAULT 'held',
              notes TEXT,
              created_by INT REFERENCES users(id) ON DELETE SET NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(service_date, service_type)
            );
            CREATE INDEX IF NOT EXISTS idx_services_date ON services(service_date);
            CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
            CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
          `);
        }
      } catch (srvErr: any) {
        console.warn("Services migration note:", srvErr.message);
      }

      // 14. Ensure composite and query performance indexes exist
      try {
        const perfIndexesMigrationPath = getMigrationFilePath("006_performance_indexes.sql");
        if (perfIndexesMigrationPath && fs.existsSync(perfIndexesMigrationPath)) {
          const perfIndexesSql = fs.readFileSync(perfIndexesMigrationPath, "utf-8");
          await sql.unsafe(perfIndexesSql);
          console.log("⚡ Applied performance composite indexes (Migration 006).");
        }
      } catch (perfErr: any) {
        console.warn("Performance indexes note:", perfErr.message);
      }
    } catch (err: any) {
      console.error("⚠️ PostgreSQL auto-init error:", {
        message: err?.message,
        code: err?.code,
        detail: err?.detail,
        errno: err?.errno,
        address: err?.address,
        port: err?.port,
        stack: err?.stack
      });
    }
  } catch (outerError: any) {
    console.error("Unuthorized  Error initializing Schema", outerError);
  }
}