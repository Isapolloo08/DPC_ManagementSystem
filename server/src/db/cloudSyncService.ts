import postgres from "postgres";
import { db, sql } from "./schema";
import { cleanDbConnectionString } from "./schema";

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
  updateCols: string[];
  isSerial?: boolean;
}

/**
 * Ordered list of all tables with specific unique constraints for foreign-key-safe replication
 */
export const SYNC_TABLES: TableSyncConfig[] = [
  { name: "roles", label: "Roles", conflictTarget: "name", updateCols: [], isSerial: true },
  { name: "ministries", label: "Ministries", conflictTarget: "name", updateCols: ["min_age", "max_age", "description", "color"], isSerial: true },
  { name: "system_lookups", label: "Lookups", conflictTarget: "type, name", updateCols: ["description", "color", "sort_order", "is_active"], isSerial: true },
  { name: "system_settings", label: "Settings", conflictTarget: "key", updateCols: ["value", "category", "updated_at"], isSerial: false },
  { name: "users", label: "User Accounts", conflictTarget: "email", updateCols: ["name", "username", "password_hash", "role_id"], isSerial: true },
  { name: "user_ministries", label: "Staff Ministries", conflictTarget: "user_id, ministry_id", updateCols: [], isSerial: true },
  { name: "households", label: "Households", conflictTarget: "id", updateCols: ["name", "address", "primary_contact_phone"], isSerial: true },
  { 
    name: "members", 
    label: "Church Members", 
    conflictTarget: "id", 
    updateCols: [
      "first_name", "last_name", "birthdate", "gender", "contact_email", "contact_phone",
      "household_id", "ministry_id", "user_id", "status", "photo_url", "medical_notes",
      "grade_level", "address", "guardian_names", "guardian_phone", "invited_by",
      "school_name", "program_major", "class_schedule", "occupation", "hobbies",
      "previous_church", "facebook_account", "family_details", "application_date",
      "civil_status", "spouse_name", "spouse_id"
    ], 
    isSerial: true 
  },
  { name: "duty_teams", label: "Duty Teams", conflictTarget: "id", updateCols: ["name", "ministry_id", "leader_id", "leader_name", "color", "order_seq", "tasks_checklist"], isSerial: true },
  { name: "duty_team_members", label: "Duty Members", conflictTarget: "team_id, member_id", updateCols: ["role"], isSerial: true },
  { name: "duty_schedules", label: "Duty Schedules", conflictTarget: "id", updateCols: ["duty_date", "team_id", "ministry_id", "status", "notes", "completed_at"], isSerial: true },
  { name: "dishwashing_roster", label: "Dishwashing", conflictTarget: "id", updateCols: ["schedule_date", "assigned_member_ids", "assigned_member_names", "status", "notes", "completed_at"], isSerial: true },
  { name: "bible_study_groups", label: "Bible Study Groups", conflictTarget: "id", updateCols: ["name", "description", "curriculum", "ministry_id", "leader_name", "leader_contact", "meeting_day", "meeting_time", "location", "category", "max_capacity"], isSerial: true },
  { name: "bible_study_topics", label: "Curriculum Topics", conflictTarget: "id", updateCols: ["title", "total_chapters", "summary_notes"], isSerial: true },
  { name: "bible_study_members", label: "Group Roster", conflictTarget: "id", updateCols: ["group_id", "member_id", "role"], isSerial: true },
  { name: "funds", label: "Church Funds", conflictTarget: "name", updateCols: ["description", "target_amount", "is_active"], isSerial: true },
  { name: "donations", label: "Donations & Tithes", conflictTarget: "id", updateCols: ["member_id", "fund_id", "amount", "donated_at", "payment_method", "notes", "recorded_by"], isSerial: true },
  { name: "events", label: "Events", conflictTarget: "id", updateCols: ["ministry_id", "title", "description", "start_time", "end_time", "location", "created_by"], isSerial: true },
  { name: "event_registrations", label: "Event RSVPs", conflictTarget: "event_id, member_id", updateCols: ["user_id", "guests_count", "status"], isSerial: true },
  { name: "announcements", label: "Announcements", conflictTarget: "id", updateCols: ["title", "body", "ministry_id", "created_by", "is_pinned"], isSerial: true },
  { name: "attendance", label: "Attendance Records", conflictTarget: "id", updateCols: ["member_id", "ministry_id", "event_id", "checked_in_at", "checked_in_by", "security_tag", "checked_out_at", "checked_out_by", "notes"], isSerial: true },
  { name: "audit_logs", label: "Audit Logs", conflictTarget: "id", updateCols: ["user_id", "action", "target_table", "target_id", "details"], isSerial: true }
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
    const keyTables = ["members", "attendance", "households", "users", "events", "donations", "duty_schedules", "bible_study_groups"];
    
    const multiCountQuery = `
      SELECT
        (SELECT COUNT(*) FROM members) as members,
        (SELECT COUNT(*) FROM attendance) as attendance,
        (SELECT COUNT(*) FROM households) as households,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM donations) as donations,
        (SELECT COUNT(*) FROM duty_schedules) as duty_schedules,
        (SELECT COUNT(*) FROM bible_study_groups) as bible_study_groups
    `;

    const [localRes, cloudRes] = await Promise.all([
      sql.unsafe(multiCountQuery).catch(() => [{}]),
      cloudSql.unsafe(multiCountQuery).catch(() => [{}])
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

/**
 * Helper to execute upsert on a target PostgreSQL connection
 */
async function executeTableUpsert(
  targetSql: any,
  tableConfig: TableSyncConfig,
  rows: any[]
): Promise<number> {
  const { name: table, conflictTarget, updateCols, isSerial } = tableConfig;
  if (!rows || rows.length === 0) return 0;

  const targetCols = conflictTarget.split(",").map(c => `"${c.trim()}"`).join(", ");
  let inserted = 0;

  for (const row of rows) {
    const keys = Object.keys(row);
    const values = Object.values(row);

    if (keys.length === 0) continue;

    const cols = keys.map(k => `"${k}"`).join(", ");
    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");

    let query = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`;

    if (updateCols && updateCols.length > 0) {
      const availableUpdates = updateCols
        .filter(col => keys.includes(col))
        .map(col => `"${col}" = EXCLUDED."${col}"`)
        .join(", ");

      if (availableUpdates) {
        query += ` ON CONFLICT (${targetCols}) DO UPDATE SET ${availableUpdates}`;
      } else {
        query += ` ON CONFLICT (${targetCols}) DO NOTHING`;
      }
    } else {
      query += ` ON CONFLICT (${targetCols}) DO NOTHING`;
    }

    const cleanValues = values.map(val => {
      if (val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      return val;
    });

    try {
      await targetSql.unsafe(query, cleanValues as any);
      inserted++;
    } catch (rowErr: any) {
      // Smart Auto-Repair: If foreign key constraint failed on user_id (e.g. in audit_logs or events created_by from old deleted users),
      // set user_id / created_by to null so the record is preserved without violating FK constraints
      if (rowErr.message?.includes("violates foreign key constraint")) {
        if (keys.includes("user_id")) {
          try {
            const userIdx = keys.indexOf("user_id");
            const retryValues = [...cleanValues];
            retryValues[userIdx] = null;
            await targetSql.unsafe(query, retryValues as any);
            inserted++;
            continue;
          } catch {}
        }
        if (keys.includes("created_by")) {
          try {
            const cbIdx = keys.indexOf("created_by");
            const retryValues = [...cleanValues];
            retryValues[cbIdx] = null;
            await targetSql.unsafe(query, retryValues as any);
            inserted++;
            continue;
          } catch {}
        }
      }

      // Fallback: If conflict on primary key fails due to a secondary unique constraint, try simple ignore
      try {
        const fallbackQuery = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await targetSql.unsafe(fallbackQuery, cleanValues as any);
        inserted++;
      } catch (fbErr: any) {
        console.warn(`⚠️ Warning: skipped row in ${table}:`, rowErr.message);
      }
    }
  }

  // Reset sequence if table is serial
  if (isSerial) {
    try {
      await targetSql.unsafe(`
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1)
        )
      `);
    } catch {}
  }

  return inserted;
}

/**
 * PUSH: Synchronize all data from Local Master DB -> Supabase Cloud DB
 */
export async function pushLocalToCloud(
  syncedByName: string,
  onProgress?: (update: SyncProgressUpdate) => void
): Promise<{ success: boolean; syncedTables: number; totalRows: number; message: string }> {
  const cloudUrl = await getCloudDbUrl();
  if (!cloudUrl) {
    throw new Error("No Cloud Database URL configured. Please configure your Supabase URL in Settings.");
  }

  const cloudSql = createCloudClient(cloudUrl);
  let totalRows = 0;
  let syncedTables = 0;

  try {
    const totalSteps = SYNC_TABLES.length;

    for (let i = 0; i < SYNC_TABLES.length; i++) {
      const tableConfig = SYNC_TABLES[i];
      const { name: table, label } = tableConfig;
      const stepNum = i + 1;
      const pct = Math.round((stepNum / totalSteps) * 100);

      if (onProgress) {
        onProgress({
          step: table,
          current: stepNum,
          total: totalSteps,
          percentage: pct,
          message: `Reading local ${label}...`
        });
      }

      // Fetch all local rows
      const localRows = await sql.unsafe(`SELECT * FROM ${table}`);
      
      if (localRows && localRows.length > 0) {
        await executeTableUpsert(cloudSql, tableConfig, localRows);
        totalRows += localRows.length;
      }

      syncedTables++;

      if (onProgress) {
        onProgress({
          step: table,
          current: stepNum,
          total: totalSteps,
          percentage: pct,
          message: `Synced ${localRows?.length || 0} ${label} to Cloud`
        });
      }
    }

    // Update sync timestamps
    const nowIso = new Date().toISOString();
    await db.exec(`
      INSERT INTO system_settings (key, value, category, updated_at) VALUES 
        ('cloud_last_synced_at', '${nowIso}', 'cloud_sync', CURRENT_TIMESTAMP),
        ('cloud_last_synced_by', '${syncedByName.replace(/'/g, "''")}', 'cloud_sync', CURRENT_TIMESTAMP),
        ('cloud_last_sync_direction', 'push', 'cloud_sync', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    `);

    try {
      await cloudSql.unsafe(`
        INSERT INTO system_settings (key, value, category, updated_at) VALUES 
          ('cloud_last_synced_at', '${nowIso}', 'cloud_sync', CURRENT_TIMESTAMP),
          ('cloud_last_synced_by', '${syncedByName.replace(/'/g, "''")}', 'cloud_sync', CURRENT_TIMESTAMP),
          ('cloud_last_sync_direction', 'push', 'cloud_sync', CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
      `);
    } catch {}

    // Record audit log
    await db.exec(`
      INSERT INTO audit_logs (action, target_table, details)
      VALUES ('CLOUD_PUSH', 'all', 'Synchronized ${totalRows} records across ${syncedTables} tables to Supabase Cloud by ${syncedByName.replace(/'/g, "''")}')
    `);

    return {
      success: true,
      syncedTables,
      totalRows,
      message: `Successfully pushed ${totalRows} records across ${syncedTables} tables to Supabase Cloud.`
    };
  } finally {
    await cloudSql.end().catch(() => {});
  }
}

/**
 * PULL: Download all data from Supabase Cloud DB -> Local Master DB
 */
export async function pullCloudToLocal(
  syncedByName: string,
  onProgress?: (update: SyncProgressUpdate) => void
): Promise<{ success: boolean; syncedTables: number; totalRows: number; message: string }> {
  const cloudUrl = await getCloudDbUrl();
  if (!cloudUrl) {
    throw new Error("No Cloud Database URL configured. Please configure your Supabase URL in Settings.");
  }

  const cloudSql = createCloudClient(cloudUrl);
  let totalRows = 0;
  let syncedTables = 0;

  try {
    const totalSteps = SYNC_TABLES.length;

    for (let i = 0; i < SYNC_TABLES.length; i++) {
      const tableConfig = SYNC_TABLES[i];
      const { name: table, label } = tableConfig;
      const stepNum = i + 1;
      const pct = Math.round((stepNum / totalSteps) * 100);

      if (onProgress) {
        onProgress({
          step: table,
          current: stepNum,
          total: totalSteps,
          percentage: pct,
          message: `Fetching ${label} from Cloud...`
        });
      }

      // Fetch all cloud rows
      const cloudRows = await cloudSql.unsafe(`SELECT * FROM "${table}"`);

      if (cloudRows && cloudRows.length > 0) {
        await executeTableUpsert(sql, tableConfig, cloudRows);
        totalRows += cloudRows.length;
      }

      syncedTables++;

      if (onProgress) {
        onProgress({
          step: table,
          current: stepNum,
          total: totalSteps,
          percentage: pct,
          message: `Imported ${cloudRows?.length || 0} ${label} to Local DB`
        });
      }
    }

    // Update sync timestamps
    const nowIso = new Date().toISOString();
    await db.exec(`
      INSERT INTO system_settings (key, value, category, updated_at) VALUES 
        ('cloud_last_synced_at', '${nowIso}', 'cloud_sync', CURRENT_TIMESTAMP),
        ('cloud_last_synced_by', '${syncedByName.replace(/'/g, "''")}', 'cloud_sync', CURRENT_TIMESTAMP),
        ('cloud_last_sync_direction', 'pull', 'cloud_sync', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    `);

    // Record audit log
    await db.exec(`
      INSERT INTO audit_logs (action, target_table, details)
      VALUES ('CLOUD_PULL', 'all', 'Imported ${totalRows} records from Supabase Cloud to Local DB by ${syncedByName.replace(/'/g, "''")}')
    `);

    return {
      success: true,
      syncedTables,
      totalRows,
      message: `Successfully pulled ${totalRows} records from Supabase Cloud into Local Database.`
    };
  } finally {
    await cloudSql.end().catch(() => {});
  }
}
