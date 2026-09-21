import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { db, initSchema } from "./db/schema";
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
import attendanceLogRouter from "./routes/attendanceLog";
import servicesRouter from "./routes/services";

import { logger, httpLogger } from "./utils/logger";
import { initSentry, setupSentryErrorHandler } from "./utils/sentry";

dotenv.config();

// Initialize Sentry error tracking if SENTRY_DSN is configured
initSentry();

const app = express();

const httpServer = http.createServer(app);
const rawPort = process.env.PORT;
const PORT: number = rawPort && !isNaN(Number(rawPort)) ? Number(rawPort) : (process.env.NODE_ENV === "production" ? 10000 : 4000);

// 1. Trust Reverse Proxy (Render / Nginx / Load Balancer) for accurate client IP rate limiting
app.set("trust proxy", 1);

// 2. Initialize Socket.IO
initSocketServer(httpServer);

// 3. Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Allows Electron and local API fetching
}));

// 4. CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 5. Structured Pino HTTP Request Logger (captures request duration ms and status)
app.use(httpLogger);

// 6. High-Performance Gzip / Deflate Compression (Payloads > 1KB)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  }
}));

// 7. Rate Limiters
// General API rate limiter: 300 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again after a minute." }
});

// Strict Auth rate limiter: 10 requests per 15 minutes per IP (Brute-force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again after 15 minutes." }
});

// Apply general limiter across all /api routes
app.use("/api", generalLimiter);

// 8. Request Timeout Middleware (15 seconds)
app.use((_req, res, next) => {
  res.setTimeout(15000, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: "Gateway Timeout: Request exceeded 15 seconds limit" });
    }
  });
  next();
});

// 9. Body Parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 10. Root Landing & Health Check Endpoints
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "online",
    name: "Daet Presbyterian Church — ChMS Backend API",
    version: "1.0.0",
    service: "Node.js + Express + PostgreSQL + Socket.IO",
    healthCheck: "/api/health",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.head("/", (_req, res) => {
  res.status(200).end();
});

// Database-Aware Health Check Endpoint (accessible at both /api/health and /health)
const handleHealthCheck = async (_req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  try {
    await db.query("SELECT 1 as healthy");
    const dbLatencyMs = Date.now() - startTime;
    res.status(200).json({
      status: "ok",
      database: "connected",
      dbLatencyMs: `${dbLatencyMs}ms`,
      service: "Church Management System API (Node.js + PostgreSQL + Socket.IO)",
      uptimeSeconds: Math.floor(process.uptime()),
      time: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: "degraded",
      database: "disconnected",
      error: err.message,
      time: new Date().toISOString()
    });
  }
};

app.get("/api/health", handleHealthCheck);
app.get("/health", handleHealthCheck);
app.head("/health", (_req, res) => res.status(200).end());
app.head("/api/health", (_req, res) => res.status(200).end());

// 11. API Routes (Auth routes use strict authLimiter on sensitive sub-routes)
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/change-password", authLimiter);
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
app.use("/api/attendance-log", attendanceLogRouter);
app.use("/api/services", servicesRouter);

// Sentry error handler (must be before any other error middleware)
setupSentryErrorHandler(app);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled API Error");
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
