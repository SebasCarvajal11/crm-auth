import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "../users.repository";
import { identityOutbox } from "../../../db/schema";
import {
  toAuthIdentityEvent,
  type AuthIdentityEventType,
  type AuthIdentityProjection,
} from "../../auth/ports/identity-event-publisher.port";

const RETRYABLE_STATUSES = ["pending", "failed"] as const;

function nextAvailableAt(attempts: number): Date {
  const delaySeconds = Math.min(300, 2 ** Math.max(0, attempts - 1) * 5);
  return new Date(Date.now() + delaySeconds * 1000);
}

function compactError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 1000);
  return String(error).slice(0, 1000);
}

export const createIdentityOutboxRepository = (conn: DbOrTx) => ({
  createIdentityOutboxEvent: async (
    type: AuthIdentityEventType,
    user: AuthIdentityProjection
  ) => {
    const event = toAuthIdentityEvent(type, user);
    await conn.insert(identityOutbox).values({
      eventType: event.type,
      aggregateId: event.userSub,
      payload: event,
    });
  },

  listPendingIdentityOutboxEvents: async (limit: number, now = new Date()) => {
    return conn
      .select()
      .from(identityOutbox)
      .where(
        and(
          inArray(identityOutbox.status, [...RETRYABLE_STATUSES]),
          lte(identityOutbox.availableAt, now)
        )
      )
      .orderBy(asc(identityOutbox.createdAt))
      .limit(limit);
  },

  markIdentityOutboxPublished: async (id: string) => {
    await conn
      .update(identityOutbox)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(identityOutbox.id, id));
  },

  markIdentityOutboxFailed: async (id: string, error: unknown) => {
    const [row] = await conn
      .update(identityOutbox)
      .set({
        status: "failed",
        attempts: sql`${identityOutbox.attempts} + 1`,
        updatedAt: new Date(),
        lastError: compactError(error),
      })
      .where(eq(identityOutbox.id, id))
      .returning({ attempts: identityOutbox.attempts });

    await conn
      .update(identityOutbox)
      .set({
        availableAt: nextAvailableAt(row?.attempts ?? 1),
        updatedAt: new Date(),
      })
      .where(eq(identityOutbox.id, id));
  },
});
