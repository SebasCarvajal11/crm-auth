import type { DbOrTx } from "../users.repository";
import { and, eq } from "drizzle-orm";
import { emailVerifications } from "../../../db/schema";
import type { NewEmailVerification } from "../users.types";
import { hashActionToken } from "../../auth/action-token";

export const createEmailVerificationsRepository = (conn: DbOrTx) => ({
  createEmailVerification: async (data: NewEmailVerification) => {
    const [row] = await conn.insert(emailVerifications).values(data).returning();
    return row;
  },

  findEmailVerificationByToken: async (token: string) => {
    const tokenHash = hashActionToken(token);
    const [row] = await conn
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, tokenHash))
      .limit(1);
    if (row) return row;

    const [legacyRow] = await conn
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token))
      .limit(1);
    return legacyRow ?? null;
  },

  markEmailVerificationAsUsed: async (id: string) => {
    await conn
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(eq(emailVerifications.id, id));
  },

  invalidateUnusedEmailVerificationsForUser: async (userId: string) => {
    await conn
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(
        and(eq(emailVerifications.userId, userId), eq(emailVerifications.isUsed, false)),
      );
  },
});
