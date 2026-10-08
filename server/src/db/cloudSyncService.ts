import postgres from "postgres";
import fs from "fs";
import { db, sql } from "./schema";
import { cleanDbConnectionString, getMigrationFilePath } from "./schema";
import { transferTables } from "./cloudSyncTransfer";

export interface SyncCountComparison {
  table: string;
  label: string;
  localCount: number;
  cloudCount: number;
}

export interface CloudSyncStatusResponse {
  configured: boolean;
  cloudHost: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
  lastSyncedBy: string | null;
  lastSyncDirection: "push" | "pull" | null;
  comparison: SyncCountComparison[];
  error?: string;
}

export interface SyncProgressUpdate {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface TableSyncConfig {
  name: string;
  label: string;
  conflictTarget: string;
  isSerial?: boolean;
}

/**
 * Ordered list of all tables with specific unique constraints for foreign-key-safe replication
 */
export const SYNC_TABLES: TableSyncConfig[] = [
  { name: "roles", label: "Roles", conflictTarget: "name", isSerial: true },
  { name: "ministries", label: "Ministries", conflictTarget: "name", isSerial: true },
  { name: "system_lookups", label: "Lookups", conflictTarget: "type, name", isSerial: true },
  { name: "system_settings", label: "Settings", conflictTarget: "key", isSerial: false },
  { name: "users", label: "User Accounts", conflictTarget: "email", isSerial: true },
  { name: "user_ministries", label: "Staff Ministries", conflictTarget: "user_id, ministry_id", isSerial: true },
  { name: "households", label: "Households", conflictTarget: "id", isSerial: true },
  { name: "members", label: "Church Members", conflictTarget: "id", isSerial: true },
  { name: "duty_teams", label: "Duty Teams", conflictTarget: "id", isSerial: true },
  { name: "duty_team_members", label: "Duty Members", conflictTarget: "team_id, member_id", isSerial: true },
  { name: "duty_schedules", label: "Duty Schedules", conflictTarget: "id", isSerial: true },
  { name: "bible_study_groups", label: "Bible Study Groups", conflictTarget: "id", isSerial: true },
  { name: "dishwashing_roster", label: "Dishwashing", conflictTarget: "id", isSerial: true },
  { name: "bible_study_topics", label: "Curriculum Topics", conflictTarget: "id", isSerial: true },
  { name: "bible_study_group_transitions", label: "Group Transitions", conflictTarget: "id", isSerial: true },
  { name: "bible_study_group_transition_sources", label: "Transition Source Groups", conflictTarget: "transition_id, source_group_id", isSerial: true },
  { name: "bible_study_members", label: "Group Roster", conflictTarget: "id", isSerial: true },
  { name: "events", label: "Events", conflictTarget: "id", isSerial: true },
  { name: "event_registrations", label: "Event RSVPs", conflictTarget: "event_id, member_id", isSerial: true },
  { name: "announcements", label: "Announcements", conflictTarget: "id", isSerial: true },
  { name: "attendance", label: "Attendance Records", conflictTarget: "id", isSerial: true },
  { name: "services", label: "Service Calendar", conflictTarget: "service_date, service_type", isSerial: true },
  { name: "audit_logs", label: "Audit Logs", conflictTarget: "id", isSerial: true }
];

/**
 * Get configured cloud database connection string
 */
export async function getCloudDbUrl(): Promise<string | null> {
  if (process.env.CLOUD_DATABASE_URL && process.env.CLOUD_DATABASE_URL.trim()) {
    return cleanDbConnectionString(process.env.CLOUD_DATABASE_URL);
  }
  if (process.env.SUPABASE_DATABASE_URL && process.env.SUPABASE_DATABASE_URL.trim()) {
    return cleanDbConnectionString(process.env.SUPABASE_DATABASE_URL);
  }

  try {
    const row = await db.get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'cloud_database_url'"
    );
    if (row && row.value && row.value.trim()) {
      return cleanDbConnectionString(row.value);
    }
  } catch {}

  return null;
}

/**
 * Save cloud database connection string to system_settings
 */
export async function saveCloudDbUrl(rawUrl: string): Promise<void> {
  const cleanUrl = cleanDbConnectionString(rawUrl);
  await db.exec(`
    INSERT INTO system_settings (key, value, category, updated_at)
    VALUES ('cloud_database_url', '${cleanUrl.replace(/'/g, "''")}', 'cloud_sync', CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
  `);
}

/**
 * Create a temporary PostgreSQL client for Cloud Database operations
 */
export function createCloudClient(url: string) {
  const cleanUrl = cleanDbConnectionString(url);
  const isSupabaseOrRemote =
    cleanUrl.includes("supabase") ||
    cleanUrl.includes("render") ||
    cleanUrl.includes("sslmode=require") ||
    process.env.NODE_ENV === "production";

  return postgres(cleanUrl, {
    max: 2,
    connect_timeout: 15,
    idle_timeout: 10,
    prepare: false, // Compatible with Supabase transaction poolers.
    ssl: isSupabaseOrRemote ? "require" : undefined,
    onnotice: () => {}
  });
}

/**
 * Test connectivity to cloud database
 */
export async function testCloudConnection(customUrl?: string): Promise<{ success: boolean; message: string; host?: string }> {
  const url = customUrl ? cleanDbConnectionString(customUrl) : await getCloudDbUrl();
  if (!url) {
    return { success: false, message: "No Cloud Database URL configured." };
  }

  const cloudSql = createCloudClient(url);
  try {
    const result = await cloudSql`SELECT current_database() as db, version() as ver`;
    const hostMatch = url.match(/@([^:/]+)/);
    const host = hostMatch ? hostMatch[1] : "Cloud Host";
    return {
      success: true,
      message: `Successfully connected to Cloud Database (${result[0]?.db || "postgres"})`,
      host
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Cloud connection failed: ${err.message || String(err)}`
    };
  } finally {
    await cloudSql.end().catch(() => {});
  }
}

/**
 * Get comprehensive cloud sync status & table comparison
 */
export async function getCloudSyncStatus(): Promise<CloudSyncStatusResponse> {
  const cloudUrl = await getCloudDbUrl();
  
  let lastSyncedAt: string | null = null;
  let lastSyncedBy: string | null = null;
  let lastSyncDirection: "push" | "pull" | null = null;

  try {
    const metaRows = await db.all<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings WHERE key IN ('cloud_last_synced_at', 'cloud_last_synced_by', 'cloud_last_sync_direction')"
    );
    for (const r of metaRows) {
      if (r.key === "cloud_last_synced_at") lastSyncedAt = r.value;
      if (r.key === "cloud_last_synced_by") lastSyncedBy = r.value;
      if (r.key === "cloud_last_sync_direction") lastSyncDirection = r.value as any;
    }
  } catch {}

  if (!cloudUrl) {
    return {
      configured: false,
      cloudHost: null,
      connected: false,
      lastSyncedAt,
      lastSyncedBy,
      lastSyncDirection,
      comparison: []
    };
  }

  const hostMatch = cloudUrl.match(/@([^:/]+)/);
  const cloudHost = hostMatch ? hostMatch[1] : "Supabase Cloud";

  const cloudSql = createCloudClient(cloudUrl);
  const comparison: SyncCountComparison[] = [];

  try {
    const keyTables = ["members", "attendance", "households", "users", "events", "duty_schedules", "bible_study_groups"];
    
    const multiCountQuery = `
      SELECT
        (SELECT COUNT(*) FROM members) as members,
        (SELECT COUNT(*) FROM attendance) as attendance,
        (SELECT COUNT(*) FROM households) as households,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM duty_schedules) as duty_schedules,
        (SELECT COUNT(*) FROM bible_study_groups) as bible_study_groups
    `;

    const [localRes, cloudRes] = await Promise.all([
      sql.unsafe(multiCountQuery),
      cloudSql.unsafe(multiCountQuery)
    ]);

    const localRow = localRes[0] || {};
    const cloudRow = cloudRes[0] || {};

    for (const table of keyTables) {
      const tableConfig = SYNC_TABLES.find(t => t.name === table);
      const label = tableConfig?.label || table;

      comparison.push({
        table,
        label,
        localCount: parseInt(localRow[table] || "0", 10),
        cloudCount: parseInt(cloudRow[table] || "0", 10)
      });
    }

    return {
      configured: true,
      cloudHost,
      connected: true,
      lastSyncedAt,
      lastSyncedBy,
      lastSyncDirection,
      comparison
    };
  } catch (err: any) {
    return {
      configured: true,
      cloudHost,
      connected: false,
      lastSyncedAt,
      lastSyncedBy,
      lastSyncDirection,
      comparison: [],
      error: err.message || "Failed to query Cloud Database"
    };
  } finally {
    await cloudSql.end().catch(() => {});
  }
}

/** Push and pull share the same atomic, identity-aware transfer path. */
async function synchronize(
  direction: "push" | "pull",
  syncedByName: string,
  onProgress?: (update: SyncProgressUpdate) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; syncedTables: number; totalRows: number; message: string }> {
  const cloudUrl = await getCloudDbUrl();
  if (!cloudUrl) throw new Error("No Cloud Database URL configured. Please configure your Supabase URL in Settings.");
  const cloudSql = createCloudClient(cloudUrl);
  const source = direction === "push" ? sql : cloudSql;
  const target = direction === "push" ? cloudSql : sql;
  try {
    const result = await target.begin(async (tx: any) => {
      await tx.unsafe("SET LOCAL statement_timeout = '30s'");
      await tx.unsafe("SET LOCAL lock_timeout = '5s'");
      const [lock] = await tx.unsafe("SELECT pg_try_advisory_xact_lock(728194, 1) AS locked");
      if (!lock.locked) throw new Error("Another cloud sync is already writing to this database. Retry when it finishes.");
      if (direction === "push") {
        onProgress?.({ step: "schema", current: 0, total: SYNC_TABLES.length, percentage: 0,
          message: "Checking cloud schema compatibility..." });
        const compatibilityColumns = await tx.unsafe(`SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND
            ((table_name = 'users' AND column_name IN ('bible_language', 'reading_start'))
              OR (table_name = 'bible_study_groups' AND column_name = 'leader_user_id'))`);
        // Avoid taking an ALTER TABLE lock during every subsequent transfer.
        if (compatibilityColumns.length < 3) {
          const migration = getMigrationFilePath("015_cloud_sync_columns.sql");
          if (!migration) throw new Error("Missing cloud sync compatibility migration 015. Rebuild the server before retrying.");
          await tx.unsafe(fs.readFileSync(migration, "utf8"));
        }
      }
      const counts = await source.begin(async (readTx: any) => {
        await readTx.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await readTx.unsafe("SET LOCAL statement_timeout = '30s'");
        return transferTables(readTx, tx, SYNC_TABLES, direction, onProgress, signal);
      });
      if (signal?.aborted) throw new Error("Cloud sync cancelled because the client disconnected. No transfer was committed.");
      await writeSyncMetadata(tx, direction, syncedByName);
      if (direction === "pull") {
        await writeSyncAudit(tx, direction, syncedByName, counts.totalRows, counts.syncedTables);
      }
      if (signal?.aborted) throw new Error("Cloud sync cancelled because the client disconnected. No transfer was committed.");
      return counts;
    });

    // A push commits on the cloud first. Local metadata can only describe that
    // successful commit; failures here must not falsely report a rolled-back push.
    let metadataWarning = "";
    if (direction === "push") {
      try {
        await sql.begin(async (tx: any) => {
          await writeSyncMetadata(tx, direction, syncedByName);
          await writeSyncAudit(tx, direction, syncedByName, result.totalRows, result.syncedTables);
        });
      } catch {
        metadataWarning = " Cloud transfer committed, but local sync history could not be updated.";
      }
    }
    return { success: true, ...result,
      message: `Successfully ${direction === "push" ? "pushed" : "pulled"} ${result.totalRows} records across ${result.syncedTables} tables ${direction === "push" ? "to Supabase Cloud" : "into Local Database"}.${metadataWarning}` };
  } finally {
    await cloudSql.end({ timeout: 5 }).catch(() => {});
  }
}

async function writeSyncMetadata(target: any, direction: "push" | "pull", name: string) {
  await target.unsafe(`INSERT INTO system_settings (key, value, category, updated_at) VALUES
    ('cloud_last_synced_at', $1, 'cloud_sync', CURRENT_TIMESTAMP),
    ('cloud_last_synced_by', $2, 'cloud_sync', CURRENT_TIMESTAMP),
    ('cloud_last_sync_direction', $3, 'cloud_sync', CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [new Date().toISOString(), name, direction]);
}

async function writeSyncAudit(target: any, direction: "push" | "pull", name: string, totalRows: number, tables: number) {
  await target.unsafe(`INSERT INTO audit_logs (action, target_table, details) VALUES ($1, 'all', $2)`,
    [direction === "push" ? "CLOUD_PUSH" : "CLOUD_PULL", `Synchronized ${totalRows} records across ${tables} tables by ${name}`]);
}

export function pushLocalToCloud(name: string, onProgress?: (update: SyncProgressUpdate) => void, signal?: AbortSignal) {
  return synchronize("push", name, onProgress, signal);
}

export function pullCloudToLocal(name: string, onProgress?: (update: SyncProgressUpdate) => void, signal?: AbortSignal) {
  return synchronize("pull", name, onProgress, signal);
}
