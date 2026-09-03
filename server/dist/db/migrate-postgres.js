"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPostgresMigrations = runPostgresMigrations;
const postgres_1 = __importDefault(require("postgres"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const schema_1 = require("./schema");
dotenv_1.default.config();
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgrespassword@localhost:5432/chms_db";
async function runPostgresMigrations() {
    console.log(`🔌 Connecting to PostgreSQL at: ${connectionString.replace(/:[^:@]+@/, ":****@")}`);
    const sql = (0, postgres_1.default)(connectionString, {
        max: 1,
        connect_timeout: 10,
        idle_timeout: 10,
        onnotice: () => { }
    });
    try {
        // 1. Run 001_init_postgres.sql
        const initSqlPath = (0, schema_1.getMigrationFilePath)("001_init_postgres.sql");
        if (initSqlPath) {
            console.log(`📄 Executing: ${initSqlPath}...`);
            const initSql = fs_1.default.readFileSync(initSqlPath, "utf-8");
            await sql.unsafe(initSql);
            console.log(`✅ Schema created/verified successfully.`);
        }
        // 2. Run 002_seed_postgres.sql
        const seedSqlPath = (0, schema_1.getMigrationFilePath)("002_seed_postgres.sql");
        if (seedSqlPath) {
            console.log(`🌱 Executing: ${seedSqlPath}...`);
            const seedSql = fs_1.default.readFileSync(seedSqlPath, "utf-8");
            await sql.unsafe(seedSql);
            console.log(`✅ Seed data applied successfully.`);
        }
        // Verify
        const count = await sql `SELECT count(*) FROM ministries`;
        console.log(`✨ Verification: ${count[0].count} ministries active in PostgreSQL database.`);
    }
    catch (err) {
        console.error("❌ PostgreSQL migration failed:", err.message);
        process.exitCode = 1;
    }
    finally {
        await sql.end();
    }
}
if (require.main === module) {
    runPostgresMigrations();
}
