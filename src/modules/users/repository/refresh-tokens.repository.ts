import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../../../db/connection";
import { refreshTokens } from "../../../db/schema";

export const refreshTokensRepository = {
  saveRefreshToken: async (
    data: Pick<
      NonNullable<typeof refreshTokens.$inferInsert>,
      "userId" | "tokenHash" | "family" | "expiresAt" | "deviceInfo"
    >
  ) => {
    const [token] = await db.insert(refreshTokens).values(data).returning();
    return token;
  },

  findRefreshToken: async (tokenHash: string) => {
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return token ?? null;
  },

  /** Token más reciente no revocado de una familia (para grace period). */
  findLatestActiveTokenByFamily: async (familyId: string) => {
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.family, familyId),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .orderBy(desc(refreshTokens.createdAt))
      .limit(1);
    return token ?? null;
  },

  revokeToken: async (tokenId: string) => {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, tokenId));
  },

  revokeTokenFamily: async (familyId: string) => {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.family, familyId));
  },

  revokeAllRefreshTokensForUser: async (userId: string) => {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.userId, userId));
  },

  revokeRefreshTokensForUserFamily: async (userId: string, familyId: string) => {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(
        and(eq(refreshTokens.userId, userId), eq(refreshTokens.family, familyId))
      );
  },

  listActiveSessionFamilies: async (userId: string) => {
    return await db
      .selectDistinctOn([refreshTokens.family], {
        family: refreshTokens.family,
        deviceInfo: refreshTokens.deviceInfo,
        expiresAt: refreshTokens.expiresAt,
        createdAt: refreshTokens.createdAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .orderBy(refreshTokens.family, desc(refreshTokens.createdAt));
  },
};
