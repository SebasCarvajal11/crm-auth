import type { DbOrTx } from "../users.repository";
import { eq, and, gt } from "drizzle-orm";
import { invitations } from "../../../db/schema";
import type { NewInvitation } from "../users.types";

export const createInvitationsRepository = (conn: DbOrTx) => ({
  createInvitation: async (data: NewInvitation) => {
    const [invitation] = await conn.insert(invitations).values(data).returning();
    return invitation;
  },

  findInvitationByToken: async (token: string) => {
    const [invitation] = await conn
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);
    return invitation ?? null;
  },

  findPendingInvitationByEmail: async (email: string) => {
    const [invitation] = await conn
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.isUsed, false),
          gt(invitations.expiresAt, new Date())
        )
      )
      .limit(1);
    return invitation ?? null;
  },

  markInvitationAsUsed: async (id: string) => {
    await conn
      .update(invitations)
      .set({ isUsed: true, acceptedAt: new Date() })
      .where(eq(invitations.id, id));
  },
});
