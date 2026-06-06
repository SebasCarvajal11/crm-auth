import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AuthServices } from "./auth.service";
import { createAuthController } from "./auth.controller";
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
    ipRateLimit({ maxAttempts: 20, windowMs: 15 * 60 * 1000 }),
    zValidator("json", LoginRequestSchema),
    authController.login
  );

  authRoutes.post("/refresh", authController.refresh);

  authRoutes.post("/logout", authMiddleware, authController.logout);

  authRoutes.post(
    "/change-password",
    authMiddleware,
    zValidator("json", ChangePasswordSchema),
    authController.changePassword
  );

  authRoutes.get("/sessions", authMiddleware, authController.listSessions);

  authRoutes.delete(
    "/sessions/:familyId",
    authMiddleware,
    zValidator("param", RefreshFamilyParamSchema),
    authController.revokeSession
  );

  authRoutes.post(
    "/request-email-verification",
    authMiddleware,
    authController.requestEmailVerification
  );

  authRoutes.post(
    "/verify-email",
    ipRateLimit({ maxAttempts: 10, windowMs: 60 * 60 * 1000 }),
    zValidator("json", VerifyEmailSchema),
    authController.verifyEmail
  );

  // ---------------------------------------------------------------------------
  // Usuarios Internos (Admin)
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/register-worker",
    authMiddleware,
    requireRole("admin"),
    zValidator("json", RegisterWorkerSchema),
    authController.registerWorker
  );

  authRoutes.post(
    "/invite-admin",
    authMiddleware,
    requireRole("admin"),
    zValidator("json", InviteAdminSchema),
    authController.inviteAdmin
  );

  // ---------------------------------------------------------------------------
  // Invitaciones de Cliente (Admin)
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/invite-client",
    authMiddleware,
    requireRole("admin"),
    zValidator("json", InviteClientRequestSchema),
    authController.inviteClient
  );

  authRoutes.get("/accept-invite/:token", authController.getInvitationData);

  authRoutes.post(
    "/accept-invite",
    zValidator("json", AcceptInviteRequestSchema),
    authController.acceptInvite
  );

  // ---------------------------------------------------------------------------
  // Recuperación de Contraseña
  // ---------------------------------------------------------------------------

  authRoutes.post(
    "/forgot-password",
    ipRateLimit({ maxAttempts: 5, windowMs: 60 * 60 * 1000 }),
    zValidator("json", ForgotPasswordSchema),
    authController.forgotPassword
  );

  authRoutes.post(
    "/reset-password",
    zValidator("json", ResetPasswordSchema),
    authController.resetPassword
  );

  // ---------------------------------------------------------------------------
  // Identidad (solo lectura; perfil en mod-users)
  // ---------------------------------------------------------------------------

  authRoutes.get("/me", authMiddleware, authController.me);
  /** Versión plana para BFF aggregation (sin wrapper `data`). */
  authRoutes.get("/me/flat", authMiddleware, authController.meFlat);

  authRoutes.get("/bootstrap-identities", async (c) => {
    const trustSecret = c.req.header("X-Gateway-Trust");
    if (!trustSecret || trustSecret !== env.GATEWAY_TRUST_SECRET) {
      return c.json({ error: "Acceso no autorizado" }, 401);
    }
    const list = await services.adminUserService.listActiveUsersForBootstrap();
    return c.json({ data: list });
  });

  return authRoutes;
};
