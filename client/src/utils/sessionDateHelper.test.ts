/**
 * sessionDateHelper.test.ts
 * Unit tests for getSessionDates and schedule calculations.
 */

import { getSessionDates, parseStartTime, getManilaDateTime } from "./sessionDateHelper";

export function runSessionDateHelperTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      passed++;
      results.push(`✓ [PASS] ${testName}`);
    } else {
      failed++;
      results.push(`✗ [FAIL] ${testName} ${details ? `(${details})` : ""}`);
    }
  }

  // Test 1: Thursday schedule called on Saturday (Sep 19, 2026 16:00 UTC+8)
  // Most recent session must be Thursday Sep 17, 2026
  {
    // 2026-09-19T08:00:00Z is 2026-09-19 16:00 in Manila
    const satDate = new Date("2026-09-19T08:00:00Z");
    const sessions = getSessionDates("Thursday", "5:00 PM - 8:00 PM", 8, satDate);

    assert(sessions.length === 8, "Thursday on Saturday: returns 8 sessions", `got ${sessions.length}`);
    assert(sessions[0]?.date === "2026-09-17", "Thursday on Saturday: latest date is 2026-09-17", `got ${sessions[0]?.date}`);
    assert(sessions[0]?.isLatest === true, "Thursday on Saturday: latest session has isLatest=true");
    assert(sessions[1]?.date === "2026-09-10", "Thursday on Saturday: 2nd session is 2026-09-10", `got ${sessions[1]?.date}`);
    assert(sessions[7]?.date === "2026-07-30", "Thursday on Saturday: 8th session is 2026-07-30", `got ${sessions[7]?.date}`);
  }

  // Test 2: Thursday schedule called on Thursday MORNING before start time
  // (e.g. Sep 17, 2026 10:00 AM Manila / 02:00 UTC, meeting starts at 5:00 PM)
  // Since session hasn't started yet, latest session must be Sep 10, 2026
  {
    const thuMorning = new Date("2026-09-17T02:00:00Z"); // 10:00 AM Manila
    const sessions = getSessionDates("Thursday", "5:00 PM - 8:00 PM", 8, thuMorning);

    assert(sessions.length === 8, "Thursday morning before start: returns 8 sessions");
    assert(sessions[0]?.date === "2026-09-10", "Thursday morning before start: latest date is previous Thu (2026-09-10)", `got ${sessions[0]?.date}`);
  }

  // Test 3: Thursday schedule called on Thursday EVENING after start time
  // (e.g. Sep 17, 2026 18:00 Manila / 10:00 UTC, meeting starts at 5:00 PM)
  // Session is underway/passed, so latest session is today Sep 17, 2026
  {
    const thuEvening = new Date("2026-09-17T10:00:00Z"); // 6:00 PM Manila
    const sessions = getSessionDates("Thursday", "5:00 PM - 8:00 PM", 8, thuEvening);

    assert(sessions.length === 8, "Thursday evening after start: returns 8 sessions");
    assert(sessions[0]?.date === "2026-09-17", "Thursday evening after start: latest date is today (2026-09-17)", `got ${sessions[0]?.date}`);
  }

  // Test 4: Group has no schedule set (null / empty string)
  {
    const sessionsNull = getSessionDates(null, null, 8);
    assert(sessionsNull.length === 0, "No schedule set: returns empty array");

    const sessionsEmpty = getSessionDates("", "", 8);
    assert(sessionsEmpty.length === 0, "Empty string schedule: returns empty array");
  }

  // Test 5: parseStartTime edge cases
  {
    const t1 = parseStartTime("5:00 PM - 8:00 PM");
    assert(t1.hour === 17 && t1.minute === 0, "parseStartTime '5:00 PM - 8:00 PM' -> 17:00", `${t1.hour}:${t1.minute}`);

    const t2 = parseStartTime("9:30 AM to 11:30 AM");
    assert(t2.hour === 9 && t2.minute === 30, "parseStartTime '9:30 AM to 11:30 AM' -> 09:30", `${t2.hour}:${t2.minute}`);

    const t3 = parseStartTime("19:00");
    assert(t3.hour === 19 && t3.minute === 0, "parseStartTime '19:00' -> 19:00", `${t3.hour}:${t3.minute}`);
  }

  return { passed, failed, results };
}

// Auto-run if executed directly in node/environment
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const { passed, failed, results } = runSessionDateHelperTests();
  console.log(results.join("\n"));
  console.log(`Summary: ${passed} passed, ${failed} failed`);
}
