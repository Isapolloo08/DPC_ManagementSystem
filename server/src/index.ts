import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initSchema } from "./db/schema";
import { initSocketServer } from "./socket";

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
import backupRouter from "./routes/backup";
import bibleReadingRouter from "./routes/bibleReading";
import cloudSyncRouter from "./routes/cloudSync";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const rawPort = process.env.PORT;
const PORT: number = rawPort && !isNaN(Number(rawPort)) ? Number(rawPort) : (process.env.NODE_ENV === "production" ? 10000 : 4000);

import zlib from "zlib";

// Initialize Socket.IO
initSocketServer(httpServer);

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Native Gzip Compression for API payloads > 1KB
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const acceptEncoding = (req.headers["accept-encoding"] as string) || "";
  if (!acceptEncoding.includes("gzip")) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    try {
      const jsonStr = JSON.stringify(body);
      if (jsonStr && jsonStr.length > 1024) {
        zlib.gzip(Buffer.from(jsonStr), (err, buffer) => {
          if (err || !buffer) {
            return originalJson(body);
          }
          if (!res.headersSent) {
            res.setHeader("Content-Encoding", "gzip");
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Content-Length", buffer.length);
            res.end(buffer);
          }
        });
        return res;
      }
    } catch {}
    return originalJson(body);
  };
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Church Management System API (Node.js + PostgreSQL + Socket.IO)",
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
app.use("/api/backup", backupRouter);
app.use("/api/bible-reading", bibleReadingRouter);
app.use("/api/cloud-sync", cloudSyncRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Start Server
async function start() {
  await initSchema();

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✨ ChMS Backend API & Socket.IO running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error("Failed to start ChMS Server:", err);
});
