import { eq } from "drizzle-orm";
import { db } from "../../../db/connection";
import { emailVerifications } from "../../../db/schema";
import type { NewEmailVerification } from "../users.types";

export const emailVerificationsRepository = {
  createEmailVerification: async (data: NewEmailVerification) => {
    const [row] = await db.insert(emailVerifications).values(data).returning();
    return row;
  },

  findEmailVerificationByToken: async (token: string) => {
    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token))
      .limit(1);
    return row ?? null;
  },

  markEmailVerificationAsUsed: async (id: string) => {
    await db
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(eq(emailVerifications.id, id));
  },
};
