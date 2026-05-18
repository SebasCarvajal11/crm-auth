import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./auth.middleware";
import { TooManyRequestsError } from "./error-handler.middleware";
import { getRedisConnection } from "../redis";

interface RateRecord {
  count: number;
  resetAt: number;
}

const memoryAttempts = new Map<string, RateRecord>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, record] of memoryAttempts) {
    if (record.resetAt <= now) {
      memoryAttempts.delete(key);
    }
  }
}

function checkMemoryLimit(
  bucketKey: string,
  now: number,
  opts: { maxAttempts: number; windowMs: number },
): void {
  cleanupExpired(now);
  const record = memoryAttempts.get(bucketKey);
  if (record && record.resetAt > now) {
    if (record.count >= opts.maxAttempts) {
      throw new TooManyRequestsError(
        "Demasiados intentos desde esta IP. Intenta más tarde.",
      );
    }
    record.count++;
  } else {
    memoryAttempts.set(bucketKey, { count: 1, resetAt: now + opts.windowMs });
  }
}

async function checkRedisLimit(
  bucketKey: string,
  opts: { maxAttempts: number; windowMs: number },
): Promise<boolean> {
  const redis = getRedisConnection();
  if (!redis) return false;

  const key = `ratelimit:${bucketKey}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, opts.windowMs);
    }
    if (count > opts.maxAttempts) {
      throw new TooManyRequestsError(
        "Demasiados intentos desde esta IP. Intenta más tarde.",
      );
    }
    return true;
  } catch (err) {
    if (err instanceof TooManyRequestsError) throw err;
    console.error("[rate-limit] Redis no disponible, usando memoria local:", err);
    return false;
  }
}

/**
 * Rate limit por IP y ruta. Con `REDIS_URL`, el conteo es global entre instancias.
 */
export function ipRateLimit(opts: { maxAttempts: number; windowMs: number }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const bucketKey = `${c.req.path}:${ip}`;
    const now = Date.now();

    const usedRedis = await checkRedisLimit(bucketKey, opts);
    if (!usedRedis) {
      checkMemoryLimit(bucketKey, now, opts);
    }

    await next();
  });
}
