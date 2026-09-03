"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const migrate_postgres_1 = require("./migrate-postgres");
async function seedDatabase() {
    console.log("🌱 Starting PostgreSQL database seed...");
    await (0, migrate_postgres_1.runPostgresMigrations)();
    console.log("✨ PostgreSQL database seeded successfully.");
}
if (require.main === module) {
    seedDatabase();
}
