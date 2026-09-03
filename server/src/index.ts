import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initSchema } from "./db/schema";

import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import ministriesRouter from "./routes/ministries";
import membersRouter from "./routes/members";
import householdsRouter from "./routes/households";
import attendanceRouter from "./routes/attendance";
import eventsRouter from "./routes/events";
import communicationsRouter from "./routes/communications";
import groupsRouter from "./routes/groups";
import studyTopicsRouter from "./routes/studyTopics";
import financeRouter from "./routes/finance";
import settingsRouter from "./routes/settings";
import reportsRouter from "./routes/reports";
import auditRouter from "./routes/audit";
import dutyRouter from "./routes/duty";
import dishwashingRouter from "./routes/dishwashing";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Church Management System API (Node.js + PostgreSQL)",
    time: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api", usersRouter); // provides /api/roles and /api/users
app.use("/api/ministries", ministriesRouter);
app.use("/api/members", membersRouter);
app.use("/api/households", householdsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/events", eventsRouter);
app.use("/api/communications", communicationsRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/study-topics", studyTopicsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/duty", dutyRouter);
app.use("/api/dishwashing", dishwashingRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Start Server
async function start() {
  await initSchema();

  app.listen(PORT, () => {
    console.log(`✨ ChMS Backend API (Node.js + Express + PostgreSQL) running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error("Failed to start ChMS Server:", err);
});
