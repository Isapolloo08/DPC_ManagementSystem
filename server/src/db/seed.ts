import { runPostgresMigrations } from "./migrate-postgres";

export async function seedDatabase() {
  console.log("🌱 Starting PostgreSQL database seed...");
  await runPostgresMigrations();
  console.log("✨ PostgreSQL database seeded successfully.");
}

if (require.main === module) {
  seedDatabase();
}
