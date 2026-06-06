import { compare } from "bcrypt";
import type { LoginSessionRepository } from "./ports/auth-repositories.port";
import type { LoginRequest } from "./auth.schemas";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../shared/middlewares/error-handler.middleware";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from "./auth.constants";
import {
  buildAccessToken,
  generateOpaqueRefreshToken,
  hashRefreshToken,
  issueTokenPair,
} from "./auth.token-utils";

export const createLoginSessionService = (repo: LoginSessionRepository) => ({
  login: async (data: LoginRequest, ip: string, userAgent: string) => {
    const user = await repo.findByEmail(data.email);

    if (!user) {
      await repo.transaction(async (txRepo) => {
        await txRepo.createAuditLog(null, "login_failed", ip, userAgent, {
          reason: "invalid_credentials_or_inactive",
        });
      });
      throw new UnauthorizedError("Credenciales inválidas");
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await repo.transaction(async (txRepo) => {
        await txRepo.clearExpiredAccountLock(user.id);
      });
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await repo.transaction(async (txRepo) => {
        await txRepo.createAuditLog(user.id, "login_failed", ip, userAgent, {
          reason: "account_locked",
        });
      });
      throw new UnauthorizedError(
        "Cuenta temporalmente bloqueada por intentos fallidos. Intenta más tarde."
      );
    }

    if (!user.isActive) {
      await repo.transaction(async (txRepo) => {
        await txRepo.createAuditLog(user.id, "login_failed", ip, userAgent, {
          reason: "invalid_credentials_or_inactive",
        });
      });
      throw new UnauthorizedError("Credenciales inválidas");
    }

    const isValidPassword = await compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      let lockedUntil: Date | null = null;
      await repo.transaction(async (txRepo) => {
        const result = await txRepo.recordFailedLoginAttempt(
          user.id,
          env.LOGIN_LOCKOUT_MAX_ATTEMPTS,
          env.LOGIN_LOCKOUT_DURATION_MS
        );
        lockedUntil = result.lockedUntil;
        await txRepo.createAuditLog(user.id, "login_failed", ip, userAgent, {
          reason: "wrong_password",
          ...(lockedUntil ? { locked_until: lockedUntil.toISOString() } : {}),
        });
      });
      throw new UnauthorizedError("Credenciales inválidas");
    }

    const authResult = await repo.transaction(async (txRepo) => {
      await txRepo.markSuccessfulLogin(user.id);

      const { accessToken, rawRefreshToken } = await issueTokenPair(
        txRepo,
        user.id,
        user.subject,
        user.role,
        user.email,
        userAgent,
        user.forcePasswordChange
      );

      await txRepo.createAuditLog(user.id, "login_success", ip, userAgent);

      return {
        access_token: accessToken,
        refresh_token: rawRefreshToken,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: {
          id: user.subject,
          role: user.role,
          force_password_change: user.forcePasswordChange,
        },
      };
    });

    return authResult;
  },

  refreshSession: async (plainRefreshToken: string, ip: string, userAgent: string) => {
    const tokenHash = hashRefreshToken(plainRefreshToken);
    const tokenRecord = await repo.findRefreshToken(tokenHash);

    if (!tokenRecord) throw new UnauthorizedError("Token de refresco inválido");

    if (tokenRecord.isRevoked) {
      await repo.transaction(async (txRepo) => {
        await txRepo.revokeTokenFamily(tokenRecord.family);
        await txRepo.createAuditLog(
          tokenRecord.userId,
          "token_reuse_detected",
          ip,
          userAgent,
          { family: tokenRecord.family }
        );
      });
      throw new UnauthorizedError("Sesión comprometida. Vuelve a iniciar sesión.");
    }

    if (tokenRecord.expiresAt < new Date()) {
      await repo.transaction(async (txRepo) => {
        await txRepo.revokeToken(tokenRecord.id);
      });
      throw new UnauthorizedError("Token de refresco expirado");
    }

    const result = await repo.transaction(async (txRepo) => {
      await txRepo.revokeToken(tokenRecord.id);

      const user = await txRepo.findById(tokenRecord.userId);
      if (!user || !user.isActive) throw new UnauthorizedError("Usuario no disponible");

      const newAccessToken = buildAccessToken(
        user.subject,
        user.id,
        user.role,
        user.email,
        user.forcePasswordChange
      );

      const newRawRefreshToken = generateOpaqueRefreshToken();
      const newRefreshTokenHash = hashRefreshToken(newRawRefreshToken);

      await txRepo.saveRefreshToken({
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        family: tokenRecord.family,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        deviceInfo: userAgent,
      });

      return { access_token: newAccessToken, refresh_token: newRawRefreshToken };
    });

    return result;
  },

  logout: async (
    plainRefreshToken: string,
    userId: string,
    ip: string,
    userAgent: string
  ) => {
    await repo.transaction(async (txRepo) => {
      const tokenHash = hashRefreshToken(plainRefreshToken);
      const tokenRecord = await txRepo.findRefreshToken(tokenHash);
      if (tokenRecord) {
        await txRepo.revokeTokenFamily(tokenRecord.family);
      }
      await txRepo.createAuditLog(userId, "logout", ip, userAgent);
    });
  },
});
