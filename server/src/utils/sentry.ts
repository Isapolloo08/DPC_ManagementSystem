import * as Sentry from "@sentry/node";
import { Express } from "express";

/**
 * Initialize Sentry error tracking if SENTRY_DSN is configured.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0
  });

  return true;
}

export function setupSentryErrorHandler(app: Express) {
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }
}

export { Sentry };
