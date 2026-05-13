import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { usersRepository } from "../users/users.repository";
import { createAuthService } from "./auth.service";
import { createAuthController } from "./auth.controller";
import {
  LoginRequestSchema,
  InviteClientRequestSchema,
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
import { createEmailJobPublisher } from "../../queues/email.queue";
import { z } from "zod";

const RefreshFamilyParamSchema = z.object({
  familyId: z.string().uuid(),
});

// Inyección de Dependencias (authService exportado para rutas admin `/users`)
export const mailPublisher = createEmailJobPublisher();
export const authService = createAuthService(usersRepository, mailPublisher);
const authController = createAuthController(authService);

export const authRoutes = new Hono<AppEnv>();

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
