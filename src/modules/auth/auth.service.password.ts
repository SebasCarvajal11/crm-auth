import { hash, compare } from "bcrypt";
import type { PasswordRepository } from "./ports/auth-repositories.port";
import { env } from "../../config/env";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS, PASSWORD_RESET_TTL_MS } from "./auth.constants";
import { getLogger } from "../../shared/logger";
import { createActionToken, hashActionToken } from "./action-token";
import { encryptEmailJob } from "../../email/email-outbox-crypto";

const logger = getLogger();

export const createPasswordService = (repo: PasswordRepository) => ({
  forgotPassword: async (email: string, ip: string, userAgent: string) => {
    const user = await repo.findByEmail(email);

    if (!user || !user.isActive) {
      await repo.transaction(async (txRepo) => {
        await txRepo.createAuditLog(null, "password_reset_requested", ip, userAgent, {
          email,
          found: false,
        });
      });
      return;
    }

    if (env.NODE_ENV !== "test") {
      const now = Date.now();
      const latest = await repo.findLatestPasswordResetForUser(user.id);
      const minIntervalMs = env.PASSWORD_RESET_MIN_INTERVAL_MS;
      if (latest?.createdAt) {
        const elapsed = now - latest.createdAt.getTime();
        if (elapsed < minIntervalMs) {
          await repo.transaction(async (txRepo) => {
            await txRepo.createAuditLog(user.id, "password_reset_throttled_interval", ip, userAgent, {
              email,
              min_interval_ms: minIntervalMs,
              elapsed_ms: elapsed,
            });
          });
          return;
        }
      }

      const since = new Date(now - 24 * 60 * 60 * 1000);
      const issuedInLastDay = await repo.countPasswordResetsForUserSince(user.id, since);
      if (issuedInLastDay >= env.PASSWORD_RESET_MAX_PER_DAY) {
        await repo.transaction(async (txRepo) => {
          await txRepo.createAuditLog(user.id, "password_reset_throttled_daily_limit", ip, userAgent, {
            email,
            max_per_day: env.PASSWORD_RESET_MAX_PER_DAY,
            issued_in_last_24h: issuedInLastDay,
          });
        });
        return;
      }
    }

    const rawToken = createActionToken();

    await repo.transaction(async (txRepo) => {
      await txRepo.createPasswordReset({
        userId: user.id,
        token: hashActionToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });

      await txRepo.createEmailOutboxEvent(
        encryptEmailJob({ type: "password_reset", to: user.email, token: rawToken })
      );

      await txRepo.createAuditLog(user.id, "password_reset_requested", ip, userAgent);
    });

    return env.NODE_ENV === "test" ? { token: rawToken } : undefined;
  },

  resetPassword: async (
    token: string,
    newPassword: string,
    ip: string,
    userAgent: string
  ) => {
    await repo.transaction(async (tx) => {
      const resetRecord = await tx.findPasswordResetByToken(token);
      if (!resetRecord) throw new NotFoundError("Token de recuperación inválido");
      if (resetRecord.isUsed) throw new ConflictError("Este token ya fue utilizado");
      if (resetRecord.expiresAt < new Date()) throw new UnauthorizedError("El token ha expirado");

      const userAccount = await tx.findById(resetRecord.userId);
      if (!userAccount) throw new NotFoundError("Usuario no disponible");

      const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);

      await tx.updateUserById(resetRecord.userId, {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        forcePasswordChange: false,
      });
      await tx.revokeAllRefreshTokensForUser(resetRecord.userId);
      await tx.markPasswordResetAsUsed(resetRecord.id);
      await tx.invalidateUnusedPasswordResetsForUser(resetRecord.userId);
      await tx.invalidateUnusedEmailVerificationsForUser(resetRecord.userId);

      await tx.createAuditLog(resetRecord.userId, "password_reset_completed", ip, userAgent);
    });
  },

  changePassword: async (
    userId: string,
    oldPassword: string,
    newPassword: string,
    ip: string,
    userAgent: string
  ) => {
    await repo.transaction(async (tx) => {
      const user = await tx.findById(userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError("Usuario no disponible");
      }

      const valid = await compare(oldPassword, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedError("Contraseña actual incorrecta");
      }

      const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);
      await tx.updateUserById(userId, {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        forcePasswordChange: false,
      });
      await tx.revokeAllRefreshTokensForUser(userId);
      await tx.invalidateUnusedPasswordResetsForUser(userId);
      await tx.invalidateUnusedEmailVerificationsForUser(userId);
      await tx.createAuditLog(userId, "password_changed_known_old", ip, userAgent);
    });
  },
});
