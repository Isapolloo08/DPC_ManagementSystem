import type { RequestHandler } from "express";
import { db } from "../db/schema";

export function parsePagination(query: Record<string, unknown>, defaultSize = 30) {
  const enabled = query.page !== undefined || query.limit !== undefined;
  for (const key of ["page", "limit"]) if (query[key] !== undefined && typeof query[key] !== "string" && typeof query[key] !== "number") throw new Error("Invalid pagination value.");
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultSize : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Page must be 1–100000 and rows per page must be 1–100.");
  }
  return { enabled, page, limit };
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const validatePagination: RequestHandler = (req, res, next) => {
  try { parsePagination(req.query); next(); }
  catch (error) { res.status(400).json({ error: (error as Error).message }); }
};

/** SQL is owned by callers; all request values remain bound parameters. */
export async function queryPage<T>(sql: string, params: unknown[], query: Record<string, unknown>) {
  const { page: requestedPage, limit } = parsePagination(query);
  const row = await db.get<{ total: string }>(`SELECT COUNT(*) AS total FROM (${sql}) page_source`, params);
  const total = Number(row?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const data = await db.all<T>(`${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
  return { data, pagination: { page, limit, total, totalPages } };
}
