import { randomBytes } from "crypto";
import type { UsersRepository } from "../users/users.repository";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from "../../shared/middlewares/error-handler.middleware";
import { EMAIL_VERIFY_TTL_MS } from "./auth.constants";

export const createEmailVerificationMethods = (
  repo: UsersRepository,
  mail: EmailJobPublisher
) => ({
  requestEmailVerification: async (
    userId: string,
    ip: string,
    userAgent: string
  ) => {
    const user = await repo.findById(userId);
    if (!user) throw new NotFoundError("Usuario no encontrado");

    if (user.emailVerifiedAt) {
      await repo.createAuditLog(userId, "email_verification_skipped_already_verified", ip, userAgent);
      return { sent: false as const };
    }

    const rawToken = randomBytes(32).toString("hex");
    await repo.createEmailVerification({
      userId: user.id,
      token: rawToken,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
    });

    mail
      .enqueue({ type: "email_verify", to: user.email, token: rawToken })
      .catch((err) => console.error("[mail enqueue verify]", err));

    await repo.createAuditLog(userId, "email_verification_requested", ip, userAgent);
    return { sent: true as const };
  },

  verifyEmailWithToken: async (token: string, ip: string, userAgent: string) => {
    const rec = await repo.findEmailVerificationByToken(token);
    if (!rec) throw new NotFoundError("Token de verificación inválido");
    if (rec.isUsed) throw new ConflictError("Este enlace ya fue utilizado");
    if (rec.expiresAt < new Date()) throw new UnauthorizedError("El enlace de verificación expiró");

    const account = await repo.findById(rec.userId);
    if (!account) throw new NotFoundError("Usuario no disponible");

    await repo.updateUserById(rec.userId, { emailVerifiedAt: new Date() });
    await repo.markEmailVerificationAsUsed(rec.id);
    await repo.createAuditLog(rec.userId, "email_verified", ip, userAgent);
  },
});
