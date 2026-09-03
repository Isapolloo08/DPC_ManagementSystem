import postgres from "postgres";
import fs from "fs";
import dotenv from "dotenv";
import { getMigrationFilePath } from "./schema";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgrespassword@localhost:5432/chms_db";

export async function runPostgresMigrations() {
  console.log(`🔌 Connecting to PostgreSQL at: ${connectionString.replace(/:[^:@]+@/, ":****@")}`);

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 10,
    onnotice: () => {}
  });

  try {
    // 1. Run 001_init_postgres.sql
    const initSqlPath = getMigrationFilePath("001_init_postgres.sql");
    if (initSqlPath) {
      console.log(`📄 Executing: ${initSqlPath}...`);
      const initSql = fs.readFileSync(initSqlPath, "utf-8");
      await sql.unsafe(initSql);
      console.log(`✅ Schema created/verified successfully.`);
    }

    // 2. Run 002_seed_postgres.sql
    const seedSqlPath = getMigrationFilePath("002_seed_postgres.sql");
    if (seedSqlPath) {
      console.log(`🌱 Executing: ${seedSqlPath}...`);
      const seedSql = fs.readFileSync(seedSqlPath, "utf-8");
      await sql.unsafe(seedSql);
      console.log(`✅ Seed data applied successfully.`);
    }

    // Verify
    const count = await sql`SELECT count(*) FROM ministries`;
    console.log(`✨ Verification: ${count[0].count} ministries active in PostgreSQL database.`);
  } catch (err: any) {
    console.error("❌ PostgreSQL migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  runPostgresMigrations();
}
