import { eq } from "drizzle-orm";
import { db } from "../../../db/connection";
import { passwordResets } from "../../../db/schema";
import type { NewPasswordReset } from "../users.types";

export const passwordResetsRepository = {
  createPasswordReset: async (data: NewPasswordReset) => {
    const [reset] = await db.insert(passwordResets).values(data).returning();
    return reset;
  },

  findPasswordResetByToken: async (token: string) => {
    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token))
      .limit(1);
    return reset ?? null;
  },

  markPasswordResetAsUsed: async (id: string) => {
    await db
      .update(passwordResets)
      .set({ isUsed: true })
      .where(eq(passwordResets.id, id));
  },
};
