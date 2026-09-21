# PostgreSQL Performance & Concurrency Optimization Guide

This guide details the database monitoring, profiling tools, and query analysis techniques configured for the Church Management System (ChMS) backend to ensure smooth operation under ~100 concurrent users.

---

## 1. Enabling and Using `pg_stat_statements`

`pg_stat_statements` tracks execution statistics of all SQL statements executed by the server. It is essential for identifying slow queries, high buffer reads, and CPU-intensive database operations.

### Enabling the Extension
In your PostgreSQL configuration (`postgresql.conf` or Render / Supabase database settings):
```ini
# Add to shared_preload_libraries
shared_preload_libraries = 'pg_stat_statements'

# Optional tuning
pg_stat_statements.max = 10000
pg_stat_statements.track = all
```

Run in your database console / migration:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### Top 10 Slowest Queries by Total Execution Time
```sql
SELECT 
    round(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    round(mean_exec_time::numeric, 2) AS mean_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS percentage_overall,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

### Top 10 Most Frequent Queries
```sql
SELECT 
    calls,
    round(mean_exec_time::numeric, 2) AS mean_time_ms,
    round(total_exec_time::numeric, 2) AS total_time_ms,
    query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
```

### Resetting Statistics
```sql
SELECT pg_stat_statements_reset();
```

---

## 2. Query Plan Profiling with `EXPLAIN (ANALYZE, BUFFERS)`

When inspecting a query that takes >200ms or when evaluating index usage:

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING, SUMMARY)
SELECT m.id, m.first_name, m.last_name, m.membership_type, m.status, h.name as household_name
FROM members m
LEFT JOIN households h ON m.household_id = h.id
WHERE m.status = 'active'
ORDER BY m.last_name ASC, m.first_name ASC
LIMIT 20 OFFSET 0;
```

### Key Indicators in `EXPLAIN ANALYZE`:
1. **`Index Scan` vs `Seq Scan`**:
   - `Index Scan` / `Bitmap Index Scan`: Uses created composite indexes.
   - `Seq Scan`: Full table scan. If table has >1,000 rows and Seq Scan occurs on filtered columns, add an index.
2. **`Buffers: shared hit=X read=Y`**:
   - `hit`: Data retrieved from RAM (buffer pool).
   - `read`: Data read from disk (I/O latency). High `read` indicates cold cache or missing index.
3. **`Planning Time` vs `Execution Time`**:
   - Execution time should remain < 15ms for primary list queries.

---

## 3. Connection Pool Configuration

The backend uses a shared `pg.Pool` with the following parameters:
- **`max: 15`**: Up to 15 concurrent active connections per server instance (ideal for Render Starter/Standard tiers to prevent connection saturation).
- **`idleTimeoutMillis: 30000`**: Frees idle connections after 30 seconds.
- **`connectionTimeoutMillis: 5000`**: Fails fast if the pool is exhausted rather than hanging incoming HTTP requests.
- **`ssl: { rejectUnauthorized: false }`**: Enabled automatically for Render/Supabase cloud instances.

---

## 4. Pino Structured Logging & Slow Query Alerts

- All incoming HTTP requests log duration (ms), method, path, and status code.
- Queries taking longer than `SLOW_QUERY_THRESHOLD_MS` (default `200ms`) automatically emit a `[WARN]` log containing the query and execution time.
