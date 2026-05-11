import { eq } from "drizzle-orm";
import { db } from "../../../db/connection";
import { invitations } from "../../../db/schema";
import type { NewInvitation } from "../users.types";

export const invitationsRepository = {
  createInvitation: async (data: NewInvitation) => {
    const [invitation] = await db.insert(invitations).values(data).returning();
    return invitation;
  },

  findInvitationByToken: async (token: string) => {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);
    return invitation ?? null;
  },

  markInvitationAsUsed: async (id: string) => {
    await db
      .update(invitations)
      .set({ isUsed: true, acceptedAt: new Date() })
      .where(eq(invitations.id, id));
  },
};
