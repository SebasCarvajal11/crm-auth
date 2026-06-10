import { Hono } from "hono";
import { type AuthServices } from "./auth.service";
import { createAuthController } from "./auth.controller";
import { jsonValidator, paramValidator } from "./validated-json";
import {
  LoginRequestSchema,
  InviteClientRequestSchema,
  InviteAdminSchema,
  AcceptInviteRequestSchema,
  RegisterWorkerSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  VerifyEmailSchema,
} from "./auth.schemas";
import {
  authMiddleware,
  requireRole,
  type AppEnv,
} from "../../shared/middlewares/auth.middleware";
import { ipRateLimit } from "../../shared/middlewares/rate-limit.middleware";
import { z } from "zod";
import { env } from "../../config/env";

const RefreshFamilyParamSchema = z.object({
  familyId: z.string().uuid(),
});

export const createAuthRoutes = (services: AuthServices) => {
  const authController = createAuthController(services);
  const authRoutes = new Hono<AppEnv>();

  // ---------------------------------------------------------------------------
  // Autenticación
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/login",
    ipRateLimit({ maxAttempts: env.RATE_LIMIT_LOGIN_MAX, windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS }),
    jsonValidator(LoginRequestSchema),
    authController.login
  );

  authRoutes.post("/refresh", authController.refresh);

  authRoutes.post("/logout", authMiddleware, authController.logout);

  authRoutes.post(
    "/change-password",
    authMiddleware,
    jsonValidator(ChangePasswordSchema),
    authController.changePassword
  );

  authRoutes.get("/sessions", authMiddleware, authController.listSessions);

  authRoutes.delete(
    "/sessions/:familyId",
    authMiddleware,
    paramValidator(RefreshFamilyParamSchema),
    authController.revokeSession
  );

  authRoutes.post(
    "/request-email-verification",
    authMiddleware,
    authController.requestEmailVerification
  );

  authRoutes.post(
    "/verify-email",
    ipRateLimit({ maxAttempts: env.RATE_LIMIT_VERIFY_EMAIL_MAX, windowMs: env.RATE_LIMIT_VERIFY_EMAIL_WINDOW_MS }),
    jsonValidator(VerifyEmailSchema),
    authController.verifyEmail
  );

  // ---------------------------------------------------------------------------
  // Usuarios Internos (Admin)
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/register-worker",
    authMiddleware,
    requireRole("admin"),
    jsonValidator(RegisterWorkerSchema),
    authController.registerWorker
  );

  authRoutes.post(
    "/invite-admin",
    authMiddleware,
    requireRole("admin"),
    jsonValidator(InviteAdminSchema),
    authController.inviteAdmin
  );

  // ---------------------------------------------------------------------------
  // Invitaciones de Cliente (Admin)
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/invite-client",
    authMiddleware,
    requireRole("admin"),
    jsonValidator(InviteClientRequestSchema),
    authController.inviteClient
  );

  authRoutes.get("/accept-invite/:token", authController.getInvitationData);

  authRoutes.post(
    "/accept-invite",
    jsonValidator(AcceptInviteRequestSchema),
    authController.acceptInvite
  );

  // ---------------------------------------------------------------------------
  // Recuperación de Contraseña
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/forgot-password",
    ipRateLimit({ maxAttempts: env.RATE_LIMIT_FORGOT_PASSWORD_MAX, windowMs: env.RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS }),
    jsonValidator(ForgotPasswordSchema),
    authController.forgotPassword
  );

  authRoutes.post(
    "/reset-password",
    jsonValidator(ResetPasswordSchema),
    authController.resetPassword
  );

  // ---------------------------------------------------------------------------
  // Identidad (solo lectura; perfil en mod-users)
  // ---------------------------------------------------------------------------

  authRoutes.get("/me", authMiddleware, authController.me);
  /** Versión plana para BFF aggregation (sin wrapper `data`). */
  authRoutes.get("/me/flat", authMiddleware, authController.meFlat);

  return authRoutes;
};
