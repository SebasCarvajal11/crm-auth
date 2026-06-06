import { getRedisConnection } from "./redis";
import { env } from "../config/env";
import { getLogger } from "./logger";
import {
  authIdentityEventSchema,
  type AuthIdentityEvent,
} from "@sebascarvajal11/cima-contracts/auth-identity-events";
import {
  toAuthIdentityEvent,
  type AuthIdentityProjection,
} from "../modules/auth/ports/identity-event-publisher.port";

const logger = getLogger();

export function publishUserRegistered(user: AuthIdentityProjection): Promise<void> {
  return publishAuthEvent(toAuthIdentityEvent("user.registered", user));
}

export function publishUserUpdated(user: AuthIdentityProjection): Promise<void> {
  return publishAuthEvent(toAuthIdentityEvent("user.updated", user));
}

export function publishUserDeleted(user: AuthIdentityProjection): Promise<void> {
  return publishAuthEvent(toAuthIdentityEvent("user.deleted", user));
}

export async function publishAuthEvent(
  event: AuthIdentityEvent,
  options: { requireRedis?: boolean } = {}
): Promise<void> {
  const parsed = authIdentityEventSchema.safeParse(event);
  if (!parsed.success) {
    logger.error({
      topic: "event-publisher",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    }, "Auth identity event invalido");
    throw new Error("Auth identity event no cumple el contrato compartido");
  }

  const redis = getRedisConnection();
  if (!redis) {
    logger.warn({ topic: "event-publisher" }, "Redis no disponible; omitiendo publicacion de auth event");
    if (options.requireRedis) {
      throw new Error("Redis no disponible para publicar auth event");
    }
    return;
  }

  try {
    await redis.xadd(
      env.AUTH_EVENTS_STREAM_KEY,
      "MAXLEN",
      "~",
      env.AUTH_EVENTS_STREAM_MAXLEN,
      "*",
      "payload",
      JSON.stringify(parsed.data)
    );
  } catch (err) {
    logger.error({ err, topic: "event-publisher" }, "Fallo al publicar auth event");
    if (options.requireRedis) {
      throw err;
    }
  }
}
