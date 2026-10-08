import { Router, Response } from "express";
import { authMiddleware, AuthRequest, requireRoles } from "../middleware/auth";
import {
  getCloudSyncStatus,
  testCloudConnection,
  saveCloudDbUrl,
  pushLocalToCloud,
  pullCloudToLocal
} from "../db/cloudSyncService";
import { emitRealtimeEvent } from "../socket";

const router = Router();
let syncInProgress = false;

// Require login for all cloud sync operations
router.use(authMiddleware, requireRoles("Admin"));

/**
 * 1. GET /api/cloud-sync/status
 * Get status of Cloud Sync & table comparison
 */
router.get("/status", async (_req: AuthRequest, res: Response) => {
  try {
    const status = await getCloudSyncStatus();
    res.json(status);
  } catch (err: any) {
    console.error("Cloud Sync status error:", err);
    res.status(500).json({ error: err.message || "Failed to get Cloud Sync status" });
  }
});

/**
 * 2. POST /api/cloud-sync/config
 * Save or update Cloud Database URL
 */
router.post("/config", async (req: AuthRequest, res: Response) => {
  try {
    const { cloudDatabaseUrl } = req.body;
    if (!cloudDatabaseUrl || typeof cloudDatabaseUrl !== "string") {
      return res.status(400).json({ error: "Please provide a valid Cloud Database connection string." });
    }

    // Test connection first
    const testRes = await testCloudConnection(cloudDatabaseUrl);
    if (!testRes.success) {
      return res.status(400).json({ error: `Connection failed: ${testRes.message}` });
    }

    await saveCloudDbUrl(cloudDatabaseUrl);

    emitRealtimeEvent("settings:updated", { key: "cloud_database_url" });

    res.json({
      success: true,
      message: "Cloud Database connection string saved and verified successfully!",
      host: testRes.host
    });
  } catch (err: any) {
    console.error("Cloud Sync config error:", err);
    res.status(500).json({ error: err.message || "Failed to save Cloud Sync configuration" });
  }
});

/**
 * 3. POST /api/cloud-sync/test
 * Test connection to Cloud Database
 */
router.post("/test", async (req: AuthRequest, res: Response) => {
  try {
    const { cloudDatabaseUrl } = req.body;
    const testRes = await testCloudConnection(cloudDatabaseUrl);
    res.json(testRes);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Test connection failed" });
  }
});

/**
 * 4. POST /api/cloud-sync/push
 * Push local database records -> Supabase Cloud
 */
router.post("/push", async (req: AuthRequest, res: Response) => {
  await handleTransfer("push", req, res);
});

/**
 * 5. POST /api/cloud-sync/pull
 * Pull database records from Supabase Cloud -> Local Database
 */
router.post("/pull", async (req: AuthRequest, res: Response) => {
  await handleTransfer("pull", req, res);
});

async function handleTransfer(direction: "push" | "pull", req: AuthRequest, res: Response) {
  if (syncInProgress) {
    res.status(409).json({ error: "A cloud sync is already running. Wait for it to finish before retrying." });
    return;
  }
  syncInProgress = true;
  const controller = new AbortController();
  const onDisconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", onDisconnect);
  try {
    const userName = req.user?.name || "Administrator";
    emitRealtimeEvent("cloudSync:started", { direction, user: userName });
    const transfer = direction === "push" ? pushLocalToCloud : pullCloudToLocal;
    const result = await transfer(userName, (progress) => {
      emitRealtimeEvent("cloudSync:progress", progress);
    }, controller.signal);
    emitRealtimeEvent("cloudSync:completed", { direction, ...result });
    if (!res.headersSent && !res.destroyed) res.json(result);
  } catch (err: any) {
    console.error(`Cloud ${direction} error:`, err);
    emitRealtimeEvent("cloudSync:failed", { direction, error: err.message });
    if (!res.headersSent && !res.destroyed) res.status(500).json({ error: err.message || "Cloud sync failed" });
  } finally {
    res.off("close", onDisconnect);
    syncInProgress = false;
  }
}

export default router;
