import { hash, compare } from "bcrypt";
import { randomBytes } from "crypto";
import type { UsersRepository } from "../users/users.repository";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import { env } from "../../config/env";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS, PASSWORD_RESET_TTL_MS } from "./auth.constants";

export const createPasswordMethods = (
  repo: UsersRepository,
  mail: EmailJobPublisher
) => ({
  forgotPassword: async (email: string, ip: string, userAgent: string) => {
    const user = await repo.findByEmail(email);

    if (!user || !user.isActive) {
      await repo.createAuditLog(null, "password_reset_requested", ip, userAgent, {
        email,
        found: false,
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
          await repo.createAuditLog(user.id, "password_reset_throttled_interval", ip, userAgent, {
            email,
            min_interval_ms: minIntervalMs,
            elapsed_ms: elapsed,
          });
          return;
        }
      }

      const since = new Date(now - 24 * 60 * 60 * 1000);
      const issuedInLastDay = await repo.countPasswordResetsForUserSince(user.id, since);
      if (issuedInLastDay >= env.PASSWORD_RESET_MAX_PER_DAY) {
        await repo.createAuditLog(user.id, "password_reset_throttled_daily_limit", ip, userAgent, {
          email,
          max_per_day: env.PASSWORD_RESET_MAX_PER_DAY,
          issued_in_last_24h: issuedInLastDay,
        });
        return;
      }
    }

    const rawToken = randomBytes(32).toString("hex");

    await repo.createPasswordReset({
      userId: user.id,
      token: rawToken,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    await repo.createAuditLog(user.id, "password_reset_requested", ip, userAgent);

    mail
      .enqueue({
        type: "password_reset",
        to: user.email,
        token: rawToken,
      })
      .catch((err) => console.error("[mail enqueue forgot]", err));

    return env.NODE_ENV === "test" ? { token: rawToken } : undefined;
  },

  resetPassword: async (
    token: string,
    newPassword: string,
    ip: string,
    userAgent: string
  ) => {
    const resetRecord = await repo.findPasswordResetByToken(token);
    if (!resetRecord) throw new NotFoundError("Token de recuperación inválido");
    if (resetRecord.isUsed) throw new ConflictError("Este token ya fue utilizado");
    if (resetRecord.expiresAt < new Date()) throw new UnauthorizedError("El token ha expirado");

    const userAccount = await repo.findById(resetRecord.userId);
    if (!userAccount) throw new NotFoundError("Usuario no disponible");

    const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);

    await repo.updateUserById(resetRecord.userId, {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordChange: false,
    });
    await repo.revokeAllRefreshTokensForUser(resetRecord.userId);
    await repo.markPasswordResetAsUsed(resetRecord.id);

    await repo.createAuditLog(resetRecord.userId, "password_reset_completed", ip, userAgent);
  },

  changePassword: async (
    userId: string,
    oldPassword: string,
    newPassword: string,
    ip: string,
    userAgent: string
  ) => {
    const user = await repo.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuario no disponible");
    }

    const valid = await compare(oldPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Contraseña actual incorrecta");
    }

    const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);
    await repo.updateUserById(userId, {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordChange: false,
    });
    await repo.revokeAllRefreshTokensForUser(userId);
    await repo.createAuditLog(userId, "password_changed_known_old", ip, userAgent);
  },
});
