import { RequestHandler } from "express";

export const requestTimeout: RequestHandler = (req, res, next) => {
  const isTransfer = req.method === "POST" && (/^\/api\/cloud-sync\/(push|pull)\/?$/.test(req.path)||/^\/api\/(invitation-sync|planned-visit-sync)\/pull\/?$/.test(req.path));
  // Cloud and submission transfers enforce their own operation deadlines.
  // A socket timeout must not send a failure while a write is still committing.
  const timeoutMs = isTransfer ? 0 : req.path.startsWith("/api/cloud-sync/") || req.path.startsWith("/api/planned-visit-sync/") ? 60000 : 15000;
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) res.status(504).json({ error: `Gateway Timeout: Request exceeded ${timeoutMs / 1000} seconds limit` });
  });
  next();
};
