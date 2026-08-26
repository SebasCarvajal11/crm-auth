import type { DbOrTx } from "../users.repository";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { passwordResets } from "../../../db/schema";
import type { NewPasswordReset } from "../users.types";
import { hashActionToken } from "../../auth/action-token";

export const createPasswordResetsRepository = (conn: DbOrTx) => ({
  createPasswordReset: async (data: NewPasswordReset) => {
    const [reset] = await conn.insert(passwordResets).values(data).returning();
    return reset;
  },

  findPasswordResetByToken: async (token: string) => {
    const tokenHash = hashActionToken(token);
    const [reset] = await conn
      .select()
      .from(passwordResets)
      // Keep the raw-token fallback only for links issued before this change.
      .where(eq(passwordResets.token, tokenHash))
      .limit(1);
    if (reset) return reset;

    const [legacyReset] = await conn
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token))
      .limit(1);
    return legacyReset ?? null;
  },

  findLatestPasswordResetForUser: async (userId: string) => {
    const [reset] = await conn
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.userId, userId))
      .orderBy(desc(passwordResets.createdAt))
      .limit(1);
    return reset ?? null;
  },

  countPasswordResetsForUserSince: async (userId: string, since: Date) => {
    const [row] = await conn
      .select({ total: count() })
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.userId, userId),
          gte(passwordResets.createdAt, since)
        )
      );
    return Number(row?.total ?? 0);
  },

  markPasswordResetAsUsed: async (id: string) => {
    await conn
      .update(passwordResets)
      .set({ isUsed: true })
      .where(eq(passwordResets.id, id));
  },

  invalidateUnusedPasswordResetsForUser: async (userId: string) => {
    await conn
      .update(passwordResets)
      .set({ isUsed: true })
      .where(and(eq(passwordResets.userId, userId), eq(passwordResets.isUsed, false)));
  },
});
