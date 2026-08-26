import { and, eq, lt, or } from "drizzle-orm";
import type { DbOrTx } from "../users.repository";
import {
  emailVerifications,
  invitations,
  passwordResets,
  refreshTokens,
  emailOutbox,
} from "../../../db/schema";

export type TokenCleanupCounts = {
  refreshTokens: number;
  passwordResets: number;
  emailVerifications: number;
  invitations: number;
  emailOutbox: number;
};

export const createTokenCleanupRepository = (conn: DbOrTx) => ({
  /**
   * Elimina tokens expirados y registros usados/revocados más antiguos que `retentionDays`.
   */
  purgeStaleAuthArtifacts: async (retentionDays: number): Promise<TokenCleanupCounts> => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const removedRefresh = await conn
      .delete(refreshTokens)
      .where(
        or(
          lt(refreshTokens.expiresAt, now),
          and(
            eq(refreshTokens.isRevoked, true),
            lt(refreshTokens.createdAt, staleBefore),
          ),
        ),
      )
      .returning({ id: refreshTokens.id });

    const removedPasswordResets = await conn
      .delete(passwordResets)
      .where(
        or(
          lt(passwordResets.expiresAt, now),
          and(
            eq(passwordResets.isUsed, true),
            lt(passwordResets.createdAt, staleBefore),
          ),
        ),
      )
      .returning({ id: passwordResets.id });

    const removedEmailVerifications = await conn
      .delete(emailVerifications)
      .where(
        or(
          lt(emailVerifications.expiresAt, now),
          and(
            eq(emailVerifications.isUsed, true),
            lt(emailVerifications.createdAt, staleBefore),
          ),
        ),
      )
      .returning({ id: emailVerifications.id });

    const removedInvitations = await conn
      .delete(invitations)
      .where(
        or(
          lt(invitations.expiresAt, now),
          and(eq(invitations.isUsed, true), lt(invitations.expiresAt, staleBefore)),
        ),
      )
      .returning({ id: invitations.id });

    const removedEmailOutbox = await conn
      .delete(emailOutbox)
      .where(and(eq(emailOutbox.status, "published"), lt(emailOutbox.publishedAt, staleBefore)))
      .returning({ id: emailOutbox.id });

    return {
      refreshTokens: removedRefresh.length,
      passwordResets: removedPasswordResets.length,
      emailVerifications: removedEmailVerifications.length,
      invitations: removedInvitations.length,
      emailOutbox: removedEmailOutbox.length,
    };
  },
});
