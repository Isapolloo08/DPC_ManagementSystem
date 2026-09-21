import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

interface CacheEntry<T = any> {
  data: T;
  etag: string;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();

  /**
   * Get cached item if valid and unexpired
   */
  get<T = any>(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  /**
   * Store item with TTL in seconds and auto-generated ETag
   */
  set<T = any>(key: string, data: T, ttlSeconds: number = 300): CacheEntry<T> {
    const serialized = JSON.stringify(data);
    const etag = `"${crypto.createHash("md5").update(serialized).digest("hex").substring(0, 16)}"`;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const entry: CacheEntry<T> = {
      data,
      etag,
      expiresAt
    };

    this.store.set(key, entry);
    return entry;
  }

  /**
   * Invalidate entries by prefix or exact key
   */
  invalidate(keyOrPrefix: string) {
    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`) || key.startsWith(`${keyOrPrefix}_`)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.store.clear();
  }
}

export const cache = new InMemoryCache();

/**
 * Express Middleware for caching static/reference endpoints with ETag & 304 Not Modified
 */
export function cacheMiddleware(cacheKeyPrefix: string, ttlSeconds: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET / HEAD requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const key = `${cacheKeyPrefix}:${req.originalUrl || req.url}`;
    const cached = cache.get(key);

    if (cached) {
      res.setHeader("ETag", cached.etag);
      res.setHeader("Cache-Control", `public, max-age=${ttlSeconds}`);

      // Check If-None-Match header from client
      const clientEtag = req.headers["if-none-match"];
      if (clientEtag && (clientEtag === cached.etag || clientEtag === `W/${cached.etag}`)) {
        return res.status(304).end();
      }

      return res.json(cached.data);
    }

    // Intercept res.json to populate cache
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entry = cache.set(key, body, ttlSeconds);
        res.setHeader("ETag", entry.etag);
        res.setHeader("Cache-Control", `public, max-age=${ttlSeconds}`);
      }
      return originalJson(body);
    };

    next();
  };
}
