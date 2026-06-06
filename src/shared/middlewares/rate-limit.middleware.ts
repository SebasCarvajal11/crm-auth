import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./auth.middleware";
import { TooManyRequestsError } from "./error-handler.middleware";
import { getRedisConnection } from "../redis";
import { getLogger } from "../logger";

const logger = getLogger();

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Redis command timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

async function checkRedisLimit(
  bucketKey: string,
  opts: { maxAttempts: number; windowMs: number },
): Promise<void> {
  const redis = getRedisConnection();
  if (redis && redis.status !== "ready") {
    if (redis.status === "connecting" || redis.status === "wait") {
      await new Promise<void>((resolve) => {
        const onReady = () => {
          redis.off("ready", onReady);
          redis.off("error", onError);
          resolve();
        };
        const onError = () => {
          redis.off("ready", onReady);
          redis.off("error", onError);
          resolve();
        };
        redis.on("ready", onReady);
        redis.on("error", onError);
        setTimeout(() => {
          redis.off("ready", onReady);
          redis.off("error", onError);
          resolve();
        }, 1500);
      });
    }
  }

  if (!redis || redis.status !== "ready") {
    logger.error({ topic: "rate-limit", redisStatus: redis?.status ?? "none" }, "CRITICAL: Redis connection is not ready. Fail-closed enforced.");
    throw new TooManyRequestsError("Servicio de rate limiting temporalmente no disponible.");
  }

  const key = `auth:ratelimit:${bucketKey}`;
  try {
    const result = await withTimeout(
      redis.eval(
        `local current = redis.call('incr', KEYS[1])
         if tonumber(current) == 1 then
           redis.call('pexpire', KEYS[1], ARGV[1])
         end
         return current`,
        1,
        key,
        opts.windowMs,
      ) as Promise<unknown>,
      1000,
    );
    const count = typeof result === "number" ? result : Number(result);

    if (count > opts.maxAttempts) {
      throw new TooManyRequestsError(
        "Demasiados intentos desde esta IP. Intenta más tarde.",
      );
    }
  } catch (err) {
    if (err instanceof TooManyRequestsError) throw err;
    logger.error({ err, topic: "rate-limit" }, "CRITICAL: Redis connectivity failure. Fail-closed enforced");
    throw new TooManyRequestsError("Servicio de rate limiting temporalmente no disponible.");
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

    await checkRedisLimit(bucketKey, opts);

    await next();
  });
}

