#!/usr/bin/env node
const autocannon = require("autocannon");

const BASE_URL = process.env.TARGET_URL || process.env.SERVER_URL || "http://localhost:4000";
const CONNECTIONS = parseInt(process.env.CONNECTIONS || "100", 10);
const DURATION = parseInt(process.env.DURATION || "30", 10);

const testEndpoints = [
  { path: "/api/health", method: "GET", name: "Health Check" },
  { path: "/api/members?page=1&limit=20", method: "GET", name: "Members List (Paginated)" },
  { path: "/api/events?page=1&limit=20", method: "GET", name: "Events List (Paginated)" },
  { path: "/api/roles", method: "GET", name: "Roles Metadata" },
  { path: "/api/ministries", method: "GET", name: "Ministries Metadata" }
];

async function runBenchmarkForEndpoint(endpoint) {
  console.log(`\n===============================================================`);
  console.log(`🚀 Benchmarking: ${endpoint.name}`);
  console.log(`   URL: ${BASE_URL}${endpoint.path}`);
  console.log(`   Connections: ${CONNECTIONS} concurrent | Duration: ${DURATION}s`);
  console.log(`===============================================================`);

  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `${BASE_URL}${endpoint.path}`,
        method: endpoint.method,
        connections: CONNECTIONS,
        duration: DURATION,
        pipelining: 1,
        headers: {
          "Accept": "application/json",
          "x-no-compression": "true" // benchmark pure throughput
        }
      },
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      }
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log(`===============================================================`);
  console.log(`🔥 HIGH-CONCURRENCY STRESS & LOAD TEST (~100 Concurrent Users)`);
  console.log(`   Target Server: ${BASE_URL}`);
  console.log(`   Thresholds: p95 latency < 300ms, 0 non-2xx errors`);
  console.log(`===============================================================`);

  const resultsSummary = [];
  let allPassed = true;

  for (const ep of testEndpoints) {
    try {
      const res = await runBenchmarkForEndpoint(ep);
      const p95 = res.latency.p95 || res.latency.p97_5 || 0;
      const p99 = res.latency.p99 || 0;
      const reqSec = res.requests.average || 0;
      const errors = (res.errors || 0) + (res.non2xx || 0) + (res.timeouts || 0);
      const passed = p95 <= 300 && errors === 0;

      if (!passed) {
        allPassed = false;
      }

      resultsSummary.push({
        Endpoint: ep.name,
        "Req/Sec": Math.round(reqSec),
        "p50 (ms)": res.latency.p50,
        "p95 (ms)": p95,
        "p99 (ms)": p99,
        "Errors/Timeouts": errors,
        "Status": passed ? "✅ PASS" : "❌ FAIL (p95 > 300ms or errors > 0)"
      });
    } catch (err) {
      console.error(`❌ Benchmark error on ${ep.name}:`, err.message);
      allPassed = false;
      resultsSummary.push({
        Endpoint: ep.name,
        "Req/Sec": 0,
        "p50 (ms)": "N/A",
        "p95 (ms)": "N/A",
        "p99 (ms)": "N/A",
        "Errors/Timeouts": "Connection Error",
        "Status": "❌ FAIL"
      });
    }
  }

  console.log(`\n\n===============================================================`);
  console.log(`📊 FINAL LOAD TEST BENCHMARK RESULTS`);
  console.log(`===============================================================`);
  console.table(resultsSummary);

  if (allPassed) {
    console.log(`\n🎉 SUCCESS: All top endpoints met concurrency target (p95 < 300ms, 0 errors)!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ WARNING: One or more endpoints failed to meet the target thresholds.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal load test runner error:", err);
  process.exit(1);
});
