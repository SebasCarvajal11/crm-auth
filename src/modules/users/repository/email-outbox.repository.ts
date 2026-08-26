import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "../users.repository";
import { emailOutbox } from "../../../db/schema";

const RETRYABLE_STATUSES = ["pending", "failed"] as const;

const nextAvailableAt = (attempts: number): Date =>
  new Date(Date.now() + Math.min(300, 2 ** Math.max(0, attempts - 1) * 5) * 1000);

const compactError = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

export const createEmailOutboxRepository = (conn: DbOrTx) => ({
  createEmailOutboxEvent: async (payload: { ciphertext: string }) => {
    await conn.insert(emailOutbox).values({ payload });
  },

  listPendingEmailOutboxEvents: async (limit: number, now = new Date()) =>
    conn
      .select()
      .from(emailOutbox)
      .where(and(inArray(emailOutbox.status, [...RETRYABLE_STATUSES]), lte(emailOutbox.availableAt, now)))
      .orderBy(asc(emailOutbox.createdAt))
      .limit(limit),

  markEmailOutboxPublished: async (id: string) => {
    await conn.update(emailOutbox).set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
      lastError: null,
    }).where(eq(emailOutbox.id, id));
  },

  markEmailOutboxFailed: async (id: string, error: unknown) => {
    const [row] = await conn.update(emailOutbox).set({
      status: "failed",
      attempts: sql`${emailOutbox.attempts} + 1`,
      updatedAt: new Date(),
      lastError: compactError(error),
    }).where(eq(emailOutbox.id, id)).returning({ attempts: emailOutbox.attempts });

    await conn.update(emailOutbox).set({
      availableAt: nextAvailableAt(row?.attempts ?? 1),
      updatedAt: new Date(),
    }).where(eq(emailOutbox.id, id));
  },
});
