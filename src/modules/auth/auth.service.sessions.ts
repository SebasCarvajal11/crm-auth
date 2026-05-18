import type { ActiveSessionFamilyRow, UsersRepository } from "../users/users.repository";
import { NotFoundError } from "../../shared/middlewares/error-handler.middleware";
import { hashRefreshToken } from "./auth.token-utils";

export const createSessionListingMethods = (repo: UsersRepository) => ({
  listMySessions: async (userId: string, plainRefreshCookie: string | undefined) => {
    const rows = await repo.listActiveSessionFamilies(userId);
    let currentFamily: string | null = null;
    if (plainRefreshCookie) {
      const tokenRecord = await repo.findRefreshToken(hashRefreshToken(plainRefreshCookie));
      if (
        tokenRecord &&
        !tokenRecord.isRevoked &&
        tokenRecord.expiresAt > new Date() &&
        tokenRecord.userId === userId
      ) {
        currentFamily = tokenRecord.family;
      }
    }

    return rows.map((r: ActiveSessionFamilyRow) => ({
      family: r.family,
      device_label: r.deviceInfo ?? "Dispositivo desconocido",
      expires_at: r.expiresAt.toISOString(),
      last_activity_at: r.createdAt.toISOString(),
      is_current: r.family === currentFamily,
    }));
  },

  revokeMySession: async (
    userId: string,
    familyId: string,
    plainRefreshCookie: string | undefined,
    ip: string,
    userAgent: string
  ) => {
    const rows = await repo.listActiveSessionFamilies(userId);
    if (!rows.some((r: ActiveSessionFamilyRow) => r.family === familyId)) {
      throw new NotFoundError("Sesión no encontrada o ya cerrada");
    }

    let wasCurrentSession = false;
    if (plainRefreshCookie) {
      const tokenRecord = await repo.findRefreshToken(hashRefreshToken(plainRefreshCookie));
      if (
        tokenRecord &&
        !tokenRecord.isRevoked &&
        tokenRecord.expiresAt > new Date() &&
        tokenRecord.userId === userId &&
        tokenRecord.family === familyId
      ) {
        wasCurrentSession = true;
      }
    }

    await repo.revokeRefreshTokensForUserFamily(userId, familyId);
    await repo.createAuditLog(userId, "session_revoked_by_user", ip, userAgent, {
      family: familyId,
    });

    return { wasCurrentSession };
  },
});
