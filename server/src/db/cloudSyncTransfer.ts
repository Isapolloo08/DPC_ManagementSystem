import type { TableSyncConfig, SyncProgressUpdate } from "./cloudSyncService";

export interface SyncSql {
  unsafe(query: string, params?: any[]): Promise<any[]>;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export async function transferTables(
  source: SyncSql,
  target: SyncSql,
  tables: TableSyncConfig[],
  direction: "push" | "pull",
  onProgress?: (update: SyncProgressUpdate) => void,
  signal?: AbortSignal
): Promise<{ totalRows: number; syncedTables: number }> {
  const deadline = Date.now() + 5 * 60 * 1000;
  const checkActive = () => {
    if (signal?.aborted) throw new Error("Cloud sync cancelled because the client disconnected. No transfer was committed.");
    if (Date.now() >= deadline) throw new Error("Cloud sync exceeded five minutes. No transfer was committed.");
  };
  checkActive();

  // Fail before copying data if an unsupported schema difference remains.
  const columnQuery = `SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = current_schema()`;
  const [sourceColumns, targetColumns] = await Promise.all([
    source.unsafe(columnQuery), target.unsafe(columnQuery)
  ]);
  const targetColumnSet = new Set(targetColumns.map(c => `${c.table_name}.${c.column_name}`));
  const sourceTableSet = new Set(sourceColumns.map(c => c.table_name));
  const targetTableSet = new Set(targetColumns.map(c => c.table_name));
  for (const { name } of tables) {
    if (!sourceTableSet.has(name) || !targetTableSet.has(name)) {
      throw new Error(`Cloud sync schema mismatch: table ${name} is missing. Apply the application migrations before retrying.`);
    }
    const missing = sourceColumns.filter(c => c.table_name === name && !targetColumnSet.has(`${name}.${c.column_name}`));
    if (missing.length) {
      throw new Error(`Cloud sync schema mismatch: ${missing.map(c => `${name}.${c.column_name}`).join(", ")} missing on destination. Apply the application migrations before retrying.`);
    }
  }

  const foreignKeys = await source.unsafe(`
    SELECT child.relname AS table_name, attr.attname AS column_name,
           parent.relname AS referenced_table
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_attribute attr ON attr.attrelid = child.oid AND attr.attnum = fk.conkey[1]
    JOIN pg_attribute parent_attr ON parent_attr.attrelid = parent.oid AND parent_attr.attnum = fk.confkey[1]
    WHERE fk.contype = 'f' AND ns.nspname = current_schema()
      AND cardinality(fk.conkey) = 1 AND parent_attr.attname = 'id'
  `);
  const idMaps = new Map<string, Map<number, number>>();
  let totalRows = 0;

  for (const [index, config] of tables.entries()) {
    checkActive();
    const table = quote(config.name);
    onProgress?.({ step: config.name, current: index, total: tables.length,
      percentage: Math.round(index / tables.length * 100), message: `Reading ${config.label}...` });
    // Connection settings and completion metadata belong to each server.
    const filter = config.name === "system_settings" ? " WHERE LEFT(key, 6) <> 'cloud_'" : "";
    const sourceRows = await source.unsafe(`SELECT * FROM ${table}${filter}${config.isSerial ? " ORDER BY id" : ""}`);
    const rows = sourceRows.map(row => ({ ...row }));
    for (const fk of foreignKeys.filter(f => f.table_name === config.name)) {
      const mapping = idMaps.get(fk.referenced_table);
      if (mapping) for (const row of rows) {
        const value = row[fk.column_name];
        if (value != null && mapping.has(value)) row[fk.column_name] = mapping.get(value);
      }
    }

    // Natural-key matches retain the destination ID. Allocate a new ID when a
    // different destination entity already occupies the incoming numeric ID.
    // Users can have no email, so match by either unique account identifier.
    const identityColumns = config.name === "users" ? ["email", "username"]
      : config.conflictTarget.split(",").map(c => c.trim());
    if (config.isSerial) {
      const mapping = new Map<number, number>();
      idMaps.set(config.name, mapping);
      if (config.conflictTarget !== "id") {
        const existing = await target.unsafe(`SELECT ${["id", ...identityColumns].map(quote).join(", ")} FROM ${table}`);
        const usedIds = new Set(existing.map(row => Number(row.id)));
        let nextId = [...existing, ...rows].reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1;
        for (const row of rows) {
          const matches = existing.filter(candidate => config.name === "users"
            ? identityColumns.some(key => row[key] != null && candidate[key] === row[key])
            : identityColumns.every(key => row[key] != null && candidate[key] === row[key]));
          if (new Set(matches.map(match => match.id)).size > 1) {
            throw new Error(`Cloud sync identity conflict in ${config.name} for source ID ${row.id}: unique identifiers match different destination records.`);
          }
          const sourceId = row.id;
          row.id = matches[0]?.id ?? (usedIds.has(Number(sourceId)) ? nextId++ : sourceId);
          mapping.set(sourceId, row.id);
          usedIds.add(Number(row.id));
        }
      } else {
        for (const row of rows) mapping.set(row.id, row.id);
      }
    }

    if (rows.length) {
      const keys = Object.keys(rows[0]);
      const jsonKeys = new Set(sourceColumns.filter(c => c.table_name === config.name &&
        (c.data_type === "json" || c.data_type === "jsonb")).map(c => c.column_name));
      // Preserve every source field, including preferences and newer schema fields.
      const conflictKeys = config.isSerial ? ["id"] : identityColumns;
      const updates = keys.filter(key => !conflictKeys.includes(key) && key !== "created_at");
      const conflict = updates.length
        ? `DO UPDATE SET ${updates.map(key => `${quote(key)} = EXCLUDED.${quote(key)}`).join(", ")}`
        : "DO NOTHING";
      // Nullable self-references (spouses and merged groups) may point to rows
      // in a later batch. Restore them after all IDs exist, in this transaction.
      const selfKeys = foreignKeys.filter(f => f.table_name === config.name &&
        f.referenced_table === config.name).map(f => f.column_name);
      const deferredRows = rows.filter(row => selfKeys.some(key => row[key] != null));
      const initialRows = deferredRows.length ? rows.map(row => {
        const staged = { ...row };
        for (const key of selfKeys) staged[key] = null;
        return staged;
      }) : rows;
      const batchSize = Math.min(100, Math.floor(60000 / keys.length));
      for (const [pass, passRows] of [initialRows, deferredRows].entries()) {
        for (let start = 0; start < passRows.length; start += batchSize) {
          checkActive();
          const batch = passRows.slice(start, start + batchSize);
          const values: any[] = [];
          const placeholders = batch.map(row => `(${keys.map(key => {
            const value = row[key];
            values.push(value == null ? null : jsonKeys.has(key) ? JSON.stringify(value)
              : value instanceof Date ? value.toISOString() : value);
            // Both pg and postgres.js accept text parameters consistently; their
            // default handling of JSON arrays differs.
            return jsonKeys.has(key) ? `$${values.length}::text::jsonb` : `$${values.length}`;
          }).join(", ")})`).join(", ");
          try {
            const saved = await target.unsafe(`INSERT INTO ${table} (${keys.map(quote).join(", ")}) VALUES ${placeholders}
              ON CONFLICT (${conflictKeys.map(quote).join(", ")}) ${conflict} RETURNING ${quote(conflictKeys[0])}`, values);
            if (pass === 0) totalRows += saved.length;
          } catch (error: any) {
            // Never skip rows, erase relationships, or claim a partial transfer succeeded.
            // Avoid surfacing database detail containing account data or credentials.
            throw new Error(`Cloud sync failed in ${config.name} (database code ${error.code || "unknown"}${error.constraint_name || error.constraint ? `, constraint ${error.constraint_name || error.constraint}` : ""}). No transfer was committed. Check schema and conflicting records.`);
          }
        }
      }
    }
    if (config.isSerial && rows.length) {
      await target.unsafe(`SELECT setval(pg_get_serial_sequence($1, 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 1), nextval(pg_get_serial_sequence($1, 'id'))), true)`, [config.name]);
    }
    checkActive();
    onProgress?.({ step: config.name, current: index + 1, total: tables.length,
      percentage: Math.min(99, Math.round((index + 1) / tables.length * 100)),
      message: `${direction === "push" ? "Uploaded" : "Imported"} ${rows.length} ${config.label}; awaiting commit` });
  }
  checkActive();
  return { totalRows, syncedTables: tables.length };
}
