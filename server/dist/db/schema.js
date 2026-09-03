"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.sql = void 0;
exports.getMigrationFilePath = getMigrationFilePath;
exports.initSchema = initSchema;
const postgres_1 = __importDefault(require("postgres"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgrespassword@localhost:5432/chms_db";
exports.sql = (0, postgres_1.default)(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => { }, // Silence harmless PostgreSQL NOTICE logs
    transform: {
        undefined: null
    }
});
/**
 * Clean helper wrapper for executing PostgreSQL queries
 */
exports.db = {
    /**
     * Execute raw SQL string (e.g. DDL / multi-statement script)
     */
    async exec(queryStr) {
        return await exports.sql.unsafe(queryStr);
    },
    /**
     * Query all rows
     */
    async all(queryStr, params = []) {
        const rows = await exports.sql.unsafe(queryStr, params);
        return Array.from(rows);
    },
    /**
     * Query single row
     */
    async get(queryStr, params = []) {
        const rows = await exports.sql.unsafe(queryStr, params);
        return rows[0] || null;
    },
    /**
     * Execute INSERT/UPDATE/DELETE and return metadata
     */
    async run(queryStr, params = []) {
        const rows = await exports.sql.unsafe(queryStr, params);
        return {
            lastInsertRowid: rows[0]?.id || null,
            changes: rows.count || 0
        };
    }
};
/**
 * Robust helper to locate migration SQL files across development (src/) and production (dist/) paths
 */
function getMigrationFilePath(filename) {
    const candidates = [
        path_1.default.resolve(__dirname, "migrations", filename),
        path_1.default.resolve(__dirname, "../../src/db/migrations", filename),
        path_1.default.resolve(__dirname, "../src/db/migrations", filename),
        path_1.default.resolve(process.cwd(), "src/db/migrations", filename),
        path_1.default.resolve(process.cwd(), "server/src/db/migrations", filename),
        path_1.default.resolve(__dirname, "../../server/src/db/migrations", filename)
    ];
    for (const c of candidates) {
        if (fs_1.default.existsSync(c)) {
            return c;
        }
    }
    return null;
}
/**
 * Initialize PostgreSQL Schema & Base Seed data
 */
async function initSchema() {
    try {
        const initSqlPath = getMigrationFilePath("001_init_postgres.sql");
        const seedSqlPath = getMigrationFilePath("002_seed_postgres.sql");
        // 1. Ensure all 19 system tables exist
        if (initSqlPath) {
            console.log(`📄 Initializing schema from: ${initSqlPath}`);
            const initSql = fs_1.default.readFileSync(initSqlPath, "utf-8");
            await exports.sql.unsafe(initSql);
            console.log("✅ PostgreSQL schema verified & all tables ensured.");
        }
        else {
            console.warn("⚠️ 001_init_postgres.sql path not resolved, creating core tables inline...");
            await exports.sql.unsafe(`
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
        CREATE TABLE IF NOT EXISTS prayer_requests (id SERIAL PRIMARY KEY, member_id INT REFERENCES members(id) ON DELETE SET NULL, requester_name VARCHAR(100) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT NOT NULL, ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, is_private INT DEFAULT 0, is_anonymous INT DEFAULT 0, status VARCHAR(20) DEFAULT 'open', prayer_count INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS funds (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT, target_amount DECIMAL(12, 2) DEFAULT 0, is_active INT DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS donations (id SERIAL PRIMARY KEY, member_id INT REFERENCES members(id) ON DELETE SET NULL, fund_id INT NOT NULL REFERENCES funds(id) ON DELETE RESTRICT, amount DECIMAL(12, 2) NOT NULL, donated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, payment_method VARCHAR(50) DEFAULT 'Cash', notes TEXT, recorded_by INT REFERENCES users(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(50) NOT NULL, target_table VARCHAR(50) NOT NULL, target_id INT, details TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS bible_study_groups (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, curriculum VARCHAR(255), ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, leader_name VARCHAR(255) NOT NULL, leader_contact VARCHAR(100), meeting_day VARCHAR(50) NOT NULL, meeting_time VARCHAR(50) NOT NULL, location VARCHAR(255) NOT NULL, category VARCHAR(50) NOT NULL DEFAULT 'General', max_capacity INT DEFAULT 12, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS bible_study_members (id SERIAL PRIMARY KEY, group_id INT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE, member_id INT REFERENCES members(id) ON DELETE CASCADE, member_name VARCHAR(255), joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_id, member_id));
        CREATE TABLE IF NOT EXISTS bible_study_topics (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, type VARCHAR(50) NOT NULL DEFAULT 'book', testament_or_category VARCHAR(100), total_chapters INT DEFAULT 1, completed_chapters INT DEFAULT 0, status VARCHAR(50) NOT NULL DEFAULT 'in_progress', completed_date VARCHAR(50), assigned_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL, assigned_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL, lead_teacher VARCHAR(255), key_verse VARCHAR(255), summary_notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS system_lookups (id SERIAL PRIMARY KEY, type VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, color VARCHAR(20) DEFAULT '#2C3968', sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(type, name));
        CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL, category VARCHAR(100) DEFAULT 'general', updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
      `);
        }
        // 2. Ensure username column exists
        try {
            await (0, exports.sql) `ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE`;
        }
        catch { }
        // 3. Ensure all 5 roles exist (Admin, Coordinator, Leader, Volunteer, Member)
        try {
            await (0, exports.sql) `
        INSERT INTO roles (name) VALUES ('Admin'), ('Coordinator'), ('Leader'), ('Volunteer'), ('Member')
        ON CONFLICT (name) DO NOTHING;
      `;
        }
        catch { }
        // 4. Ensure membership application form columns exist on members table
        try {
            await (0, exports.sql) `
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
        ADD COLUMN IF NOT EXISTS application_date DATE;
      `;
        }
        catch { }
        // 4. Seed demo users if Leader role account is missing
        try {
            const leaderUser = await exports.db.get("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Leader'");
            if (!leaderUser) {
                const leaderRole = await exports.db.get("SELECT id FROM roles WHERE name = 'Leader'");
                if (leaderRole) {
                    await exports.db.run(`
            INSERT INTO users (name, username, email, password_hash, role_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO NOTHING
          `, [
                        "Daniel Cruz (Life Group Leader)",
                        "leader.daniel",
                        "leader.daniel@church.org",
                        "$2a$10$wU05/0WwZ4nCgT5Y5f9/kO1qI11YJ5n1kO7G1n1kO7G1n1kO7G1n1",
                        leaderRole.id
                    ]);
                }
            }
        }
        catch { }
        // 5. Seed system_lookups if empty
        const lookupCount = await exports.db.get("SELECT COUNT(*) as count FROM system_lookups");
        if (Number(lookupCount?.count || 0) === 0 && seedSqlPath) {
            console.log("🌱 Seeding default system lookups...");
            const seedSql = fs_1.default.readFileSync(seedSqlPath, "utf-8");
            await exports.sql.unsafe(seedSql);
        }
        // 6. Ensure Saturday Duty Roster tables exist
        try {
            await exports.sql.unsafe(`
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
            // Seed starter duty teams (Team 1 & Team 2) if empty
            const teamCount = await exports.db.get("SELECT COUNT(*) as count FROM duty_teams");
            if (Number(teamCount?.count || 0) === 0) {
                const youthMin = await exports.db.get("SELECT id FROM ministries WHERE name ILIKE '%Youth%' LIMIT 1");
                const youthMinId = youthMin?.id || null;
                const members = await exports.db.all("SELECT id, first_name, last_name FROM members ORDER BY id ASC LIMIT 4");
                const t1 = await exports.db.run(`
          INSERT INTO duty_teams (name, ministry_id, leader_id, leader_name, color, order_seq, tasks_checklist)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, [
                    "Team 1",
                    youthMinId,
                    members[0]?.id || null,
                    members[0] ? `${members[0].first_name} ${members[0].last_name}` : "Assigned Leader",
                    "#2C3968",
                    1,
                    "Sanctuary Cleaning, Trash Disposal, Restroom Sanitation, Sound Setup"
                ]);
                const t2 = await exports.db.run(`
          INSERT INTO duty_teams (name, ministry_id, leader_id, leader_name, color, order_seq, tasks_checklist)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, [
                    "Team 2",
                    youthMinId,
                    members[1]?.id || null,
                    members[1] ? `${members[1].first_name} ${members[1].last_name}` : "Assigned Leader",
                    "#E07A5F",
                    2,
                    "Fellowship Hall Cleaning, Musical Instruments Inspection, Entrance/Porch Sweeping"
                ]);
                if (t1.lastInsertRowid && members[0]?.id) {
                    await exports.db.run("INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT DO NOTHING", [t1.lastInsertRowid, members[0].id]);
                    if (members[2]?.id) {
                        await exports.db.run("INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Member') ON CONFLICT DO NOTHING", [t1.lastInsertRowid, members[2].id]);
                    }
                }
                if (t2.lastInsertRowid && members[1]?.id) {
                    await exports.db.run("INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT DO NOTHING", [t2.lastInsertRowid, members[1].id]);
                    if (members[3]?.id) {
                        await exports.db.run("INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Member') ON CONFLICT DO NOTHING", [t2.lastInsertRowid, members[3].id]);
                    }
                }
            }
        }
        catch (e) {
            console.warn("Duty table check note:", e.message);
        }
        // 7. Ensure dishwashing_roster table exists
        try {
            await exports.sql.unsafe(`
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

        CREATE INDEX IF NOT EXISTS idx_dishwashing_duty_date ON dishwashing_roster(duty_date);
        CREATE INDEX IF NOT EXISTS idx_dishwashing_status ON dishwashing_roster(status);

        ALTER TABLE dishwashing_roster
        ADD COLUMN IF NOT EXISTS partner_assigned_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS partner_leader_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS partner_biblestudy_group_id INT REFERENCES bible_study_groups(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS partner_ministry_id INT REFERENCES ministries(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_joint_duty BOOLEAN DEFAULT false;
      `);
            // Seed starter dishwashing cycle if table is empty
            const dishCount = await exports.db.get("SELECT COUNT(*) as count FROM dishwashing_roster");
            if (Number(dishCount?.count || 0) === 0) {
                const groups = await exports.db.all("SELECT id, name, leader_name, leader_contact, ministry_id FROM bible_study_groups ORDER BY id ASC");
                const ministries = await exports.db.all("SELECT id, name FROM ministries ORDER BY id ASC");
                // Starter 4-week Sunday rotation from Aug 30, 2026
                const starterSundays = [
                    "2026-08-30",
                    "2026-09-06",
                    "2026-09-13",
                    "2026-09-20"
                ];
                for (let i = 0; i < starterSundays.length; i++) {
                    const date = starterSundays[i];
                    if (groups.length > 0) {
                        const grp = groups[i % groups.length];
                        await exports.db.run(`
              INSERT INTO dishwashing_roster (
                duty_date, event_name, cycle_mode, cycle_order_index,
                biblestudy_group_id, ministry_id, assigned_name, leader_name, leader_contact, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                            date,
                            "Sunday Fellowship Lunch",
                            "biblestudy_group",
                            i + 1,
                            grp.id,
                            grp.ministry_id,
                            grp.name,
                            grp.leader_name,
                            grp.leader_contact || "+63 912 345 6789",
                            i === 0 ? "scheduled" : "scheduled"
                        ]);
                    }
                    else if (ministries.length > 0) {
                        const min = ministries[i % ministries.length];
                        await exports.db.run(`
              INSERT INTO dishwashing_roster (
                duty_date, event_name, cycle_mode, cycle_order_index,
                ministry_id, assigned_name, leader_name, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                            date,
                            "Sunday Fellowship Lunch",
                            "ministry",
                            i + 1,
                            min.id,
                            `${min.name} Ministry`,
                            "Ministry Coordinator",
                            "scheduled"
                        ]);
                    }
                }
            }
        }
        catch (e) {
            console.warn("Dishwashing table check note:", e.message);
        }
    }
    catch (err) {
        console.error("⚠️ PostgreSQL auto-init notice:", err.message);
    }
}
