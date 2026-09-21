import pino from "pino";
import pinoHttp from "pino-http";

/**
 * Structured Logger using Pino
 * Optimized for high-throughput and low-overhead logging.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "token", "newPassword", "oldPassword"],
    censor: "[REDACTED]"
  }
});

/**
 * Pino HTTP middleware: automatically logs request/response details
 * including endpoint, method, status code, and execution time in ms.
 */
export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res, responseTime) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${Math.round(responseTime)}ms`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - Error: ${err.message}`;
  }
});

/**
 * Helper to log slow database queries (>200ms)
 */
export function logSlowQuery(query: string, durationMs: number, params?: any[]) {
  const thresholdMs = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 500;
  if (durationMs >= thresholdMs) {
    logger.warn({
      type: "slow_query",
      durationMs: Math.round(durationMs),
      thresholdMs,
      query: query.replace(/\s+/g, " ").trim().substring(0, 500),
      paramCount: params ? params.length : 0
    }, `⚠️ Slow Query Detected (${Math.round(durationMs)}ms >= ${thresholdMs}ms)`);
  }
}
