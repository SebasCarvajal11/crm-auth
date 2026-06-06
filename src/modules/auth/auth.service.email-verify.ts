import { randomBytes } from "crypto";
import type { EmailVerificationRepository } from "./ports/auth-repositories.port";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from "../../shared/middlewares/error-handler.middleware";
import { EMAIL_VERIFY_TTL_MS } from "./auth.constants";
import { getLogger } from "../../shared/logger";

const logger = getLogger();

export const createEmailVerificationService = (
  repo: EmailVerificationRepository,
  mail: EmailJobPublisher
) => ({
  requestEmailVerification: async (
    userId: string,
    ip: string,
    userAgent: string
  ) => {
    return await repo.transaction(async (tx) => {
      const user = await tx.findById(userId);
      if (!user) throw new NotFoundError("Usuario no encontrado");

      if (user.emailVerifiedAt) {
        await tx.createAuditLog(userId, "email_verification_skipped_already_verified", ip, userAgent);
        return { sent: false as const };
      }

      const rawToken = randomBytes(32).toString("hex");
      await tx.createEmailVerification({
        userId: user.id,
        token: rawToken,
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      });

      mail
        .enqueue({ type: "email_verify", to: user.email, token: rawToken })
        .catch((err) => logger.error({ err, topic: "mail enqueue verify" }, "enqueue failed"));

      await tx.createAuditLog(userId, "email_verification_requested", ip, userAgent);
      return { sent: true as const };
    });
  },

  verifyEmailWithToken: async (token: string, ip: string, userAgent: string) => {
    await repo.transaction(async (tx) => {
      const rec = await tx.findEmailVerificationByToken(token);
      if (!rec) throw new NotFoundError("Token de verificación inválido");
      if (rec.isUsed) throw new ConflictError("Este enlace ya fue utilizado");
      if (rec.expiresAt < new Date()) throw new UnauthorizedError("El enlace de verificación expiró");

      const account = await tx.findById(rec.userId);
      if (!account) throw new NotFoundError("Usuario no disponible");

      await tx.updateUserById(rec.userId, { emailVerifiedAt: new Date() });
      await tx.markEmailVerificationAsUsed(rec.id);
      await tx.createAuditLog(rec.userId, "email_verified", ip, userAgent);
    });
  },
});
