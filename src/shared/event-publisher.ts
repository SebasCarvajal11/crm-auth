import { getRedisConnection } from "./redis";
import { env } from "../config/env";
import { getLogger, traceStorage } from "./logger";
import {
  authIdentityEventSchema,
  type AuthIdentityEvent,
} from "@sebascarvajal11/cima-contracts/auth-identity-events";
import {
  auditEventSchema,
  type AuditEvent,
} from "@sebascarvajal11/cima-contracts/audit-events";
import { STREAM_CONVENTIONS } from "@sebascarvajal11/cima-contracts/stream-conventions";
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
  const store = traceStorage.getStore();
  const eventWithTrace = {
    ...event,
    traceId: event.traceId ?? store?.traceId,
    correlationId: event.correlationId ?? store?.correlationId,
  };

  const parsed = authIdentityEventSchema.safeParse(eventWithTrace);
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
    await redis.hincrby("metrics:events:published", `${parsed.data.type}:v${parsed.data.version ?? 1}`, 1)
      .catch((err) => logger.warn({ err }, "No se pudo incrementar metrica de evento publicado en Redis"));
    logger.info(
      { eventType: parsed.data.type, eventVersion: parsed.data.version ?? 1, topic: "event-metrics" },
      `Métrica de evento publicado: ${parsed.data.type} v${parsed.data.version ?? 1}`
    );
  } catch (err) {
    logger.error({ err, topic: "event-publisher" }, "Fallo al publicar auth event");
    if (options.requireRedis) {
      throw err;
    }
  }
}

export async function publishAuditEvent(
  event: Omit<AuditEvent, "version" | "contractVersion" | "type" | "timestamp" | "traceId"> & {
    timestamp?: string;
  },
  options: { requireRedis?: boolean } = {}
): Promise<void> {
  const store = traceStorage.getStore();
  const fullEvent: AuditEvent = {
    version: 1,
    contractVersion: 1,
    type: "audit.event-published",
    actorSub: event.actorSub,
    actorEmail: event.actorEmail,
    actorRole: event.actorRole,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    correlationId: event.correlationId ?? store?.correlationId,
    details: event.details,
    timestamp: event.timestamp ?? new Date().toISOString(),
    traceId: store?.traceId,
  };

  const parsed = auditEventSchema.safeParse(fullEvent);
  if (!parsed.success) {
    logger.error({
      topic: "event-publisher:audit",
      issues: parsed.error.issues.map((issue: any) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    }, "Audit event invalido");
    throw new Error("Audit event no cumple el contrato compartido");
  }

  const redis = getRedisConnection();
  if (!redis) {
    logger.warn({ topic: "event-publisher:audit" }, "Redis no disponible; omitiendo publicacion de audit event");
    if (options.requireRedis) {
      throw new Error("Redis no disponible para publicar audit event");
    }
    return;
  }

  try {
    const streamKey = env.AUDIT_EVENTS_STREAM_KEY ?? STREAM_CONVENTIONS.streams.audit.events;
    const maxLen = env.AUDIT_EVENTS_STREAM_MAXLEN ?? 10000;
    await redis.xadd(
      streamKey,
      "MAXLEN",
      "~",
      maxLen,
      "*",
      "payload",
      JSON.stringify(parsed.data)
    );
    await redis.hincrby("metrics:events:published", "audit.event-published:v1", 1)
      .catch((err) => logger.warn({ err }, "No se pudo incrementar metrica de audit event publicado en Redis"));
    logger.info(
      { eventType: "audit.event-published", eventVersion: 1, topic: "event-metrics" },
      "Métrica de evento publicado: audit.event-published v1"
    );
  } catch (err) {
    logger.error({ err, topic: "event-publisher:audit" }, "Fallo al publicar audit event");
    if (options.requireRedis) {
      throw err;
    }
  }
}
