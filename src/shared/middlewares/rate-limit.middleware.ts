import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./auth.middleware";
import { TooManyRequestsError } from "./error-handler.middleware";

interface IpRecord {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, IpRecord>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, record] of attempts) {
    if (record.resetAt <= now) {
      attempts.delete(ip);
    }
  }
}

/**
 * Rate limiter en memoria por IP.
 * Protege endpoints sensibles (login, forgot-password) contra fuerza bruta
 * independientemente del rate limiting de KrakenD.
 */
export function ipRateLimit(opts: { maxAttempts: number; windowMs: number }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const now = Date.now();

    cleanupExpired(now);

    const record = attempts.get(ip);
    if (record && record.resetAt > now) {
      if (record.count >= opts.maxAttempts) {
        throw new TooManyRequestsError(
          "Demasiados intentos desde esta IP. Intenta más tarde."
        );
      }
      record.count++;
    } else {
      attempts.set(ip, { count: 1, resetAt: now + opts.windowMs });
    }

    await next();
  });
}
