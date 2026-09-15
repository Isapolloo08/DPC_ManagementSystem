import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgres://postgres:admin123@localhost:5432/chms_db";

export async function clearDatabase() {
  console.log(`🧹 Connecting to PostgreSQL to remove all seed & mock data...`);
  const isSupabaseOrRemote = connectionString.includes("supabase") || connectionString.includes("render") || connectionString.includes("sslmode=require") || process.env.NODE_ENV === "production";

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 15,
    idle_timeout: 10,
    ssl: isSupabaseOrRemote ? "require" : undefined,
    onnotice: () => {}
  });

  try {
    console.log("🗑️  Truncating all mock data tables...");

    await sql.unsafe(`
      TRUNCATE TABLE 
        attendance,
        donations,
        funds,
        event_registrations,
        events,
        announcements,
        bible_study_members,
        bible_study_topics,
        bible_study_groups,
        duty_team_members,
        duty_schedules,
        duty_teams,
        dishwashing_roster,
        members,
        households,
        user_ministries,
        audit_logs,
        users
      RESTART IDENTITY CASCADE;
    `);

    // Reset sequences
    await sql.unsafe(`
      SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1));
      SELECT setval('ministries_id_seq', COALESCE((SELECT MAX(id) FROM ministries), 1));
      SELECT setval('system_lookups_id_seq', COALESCE((SELECT MAX(id) FROM system_lookups), 1));
    `);

    // Ensure roles exist
    await sql.unsafe(`
      INSERT INTO roles (id, name) VALUES
        (1, 'Admin'),
        (2, 'Coordinator'),
        (3, 'Leader'),
        (4, 'Volunteer'),
        (5, 'Member')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Ensure 7 core ministries exist
    await sql.unsafe(`
      INSERT INTO ministries (id, name, min_age, max_age, description, color) VALUES
        (1, 'Kinder', 3, 5, 'Ages 3-5: Bible stories, play, crafts, and secure child check-in', '#E07A5F'),
        (2, 'Elementary', 6, 12, 'Ages 6-12: Interactive Sunday school, worship, and Scripture memory', '#D9A441'),
        (3, 'Highschool', 13, 16, 'Ages 13-16: Teen fellowship, small groups, and discipleship', '#B85C56'),
        (4, 'Youth', 17, 21, 'Ages 17-21: College & young adults campus outreach, deep worship', '#6E8B74'),
        (5, 'Young Adult', 22, 35, 'Ages 22-35: Career navigation, marriage & life foundation', '#2C3968'),
        (6, 'Junior Adult', 36, 55, 'Ages 36-55: Family life, parenting, leadership and community impact', '#4A5568'),
        (7, 'Old Adult', 56, 120, 'Ages 56+: Golden years fellowship, prayer warriors & legacy mentorship', '#8D5B4C')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Verify row counts
    const userCount = await sql`SELECT count(*) FROM users`;
    const memberCount = await sql`SELECT count(*) FROM members`;
    const groupCount = await sql`SELECT count(*) FROM bible_study_groups`;
    const eventCount = await sql`SELECT count(*) FROM events`;
    const donationCount = await sql`SELECT count(*) FROM donations`;
    const dutyCount = await sql`SELECT count(*) FROM duty_teams`;
    const dishCount = await sql`SELECT count(*) FROM dishwashing_roster`;

    console.log("✨ Database successfully cleaned!");
    console.log(`   - Users: ${userCount[0].count}`);
    console.log(`   - Members: ${memberCount[0].count}`);
    console.log(`   - Bible Study Groups: ${groupCount[0].count}`);
    console.log(`   - Events: ${eventCount[0].count}`);
    console.log(`   - Donations: ${donationCount[0].count}`);
    console.log(`   - Duty Teams: ${dutyCount[0].count}`);
    console.log(`   - Dishwashing Schedules: ${dishCount[0].count}`);
  } catch (err: any) {
    console.error("❌ Error cleaning database:", err.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  clearDatabase();
}
