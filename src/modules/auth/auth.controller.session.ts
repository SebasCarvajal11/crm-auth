import type { Context } from "hono";
import type { AuthService } from "./auth.service";
import type {
  ChangePasswordRequest,
  LoginRequest,
  VerifyEmailRequest,
} from "./auth.schemas";
import { validatedJson } from "./validated-json";
import type { AppEnv } from "../../shared/middlewares/auth.middleware";
import { UnauthorizedError } from "../../shared/middlewares/error-handler.middleware";
import {
  deleteRefreshCookie,
  getIp,
  getRefreshCookie,
  getUa,
  setRefreshCookie,
} from "./auth.controller.helpers";

export const createSessionControllerHandlers = (authService: AuthService) => ({
  login: async (c: Context) => {
    const data = validatedJson<LoginRequest>(c);
    const result = await authService.login(data, getIp(c), getUa(c));

    setRefreshCookie(c, result.refresh_token);

    return c.json(
      {
        data: {
          access_token: result.access_token,
          expires_in: result.expires_in,
          user: result.user,
        },
      },
      200
    );
  },

  refresh: async (c: Context) => {
    const rawRefreshToken = getRefreshCookie(c);
    if (!rawRefreshToken) throw new UnauthorizedError("No se encontró el token de refresco");

    const result = await authService.refreshSession(rawRefreshToken, getIp(c), getUa(c));

    setRefreshCookie(c, result.refresh_token);

    return c.json({ data: { access_token: result.access_token } }, 200);
  },

  changePassword: async (c: Context<AppEnv>) => {
    const { old_password, new_password } = validatedJson<ChangePasswordRequest>(c);
    const { userId } = c.get("user");
    await authService.changePassword(userId, old_password, new_password, getIp(c), getUa(c));

    deleteRefreshCookie(c);
    return c.json({ message: "Contraseña actualizada correctamente" }, 200);
  },

  listSessions: async (c: Context<AppEnv>) => {
    const { userId } = c.get("user");
    const plain = getRefreshCookie(c);
    const sessions = await authService.listMySessions(userId, plain);

    return c.json({ data: { sessions } }, 200);
  },

  revokeSession: async (c: Context<AppEnv>) => {
    const familyId = c.req.param("familyId") ?? "";
    const { userId } = c.get("user");
    const plain = getRefreshCookie(c);
    const { wasCurrentSession } = await authService.revokeMySession(
      userId,
      familyId,
      plain,
      getIp(c),
      getUa(c)
    );

    if (wasCurrentSession) {
      deleteRefreshCookie(c);
    }

    return c.json({ message: "Sesión cerrada correctamente" }, 200);
  },

  requestEmailVerification: async (c: Context<AppEnv>) => {
    const { userId } = c.get("user");
    const result = await authService.requestEmailVerification(userId, getIp(c), getUa(c));

    return c.json(
      {
        message: result.sent
          ? "Te enviamos un enlace de verificación (revisa spam)."
          : "Tu correo ya está verificado.",
      },
      200
    );
  },

  verifyEmail: async (c: Context) => {
    const { token } = validatedJson<VerifyEmailRequest>(c);
    await authService.verifyEmailWithToken(token, getIp(c), getUa(c));

    return c.json({ message: "Correo verificado correctamente" }, 200);
  },

  logout: async (c: Context<AppEnv>) => {
    const rawRefreshToken = getRefreshCookie(c);
    const { userId } = c.get("user");

    if (rawRefreshToken) {
      await authService.logout(rawRefreshToken, userId, getIp(c), getUa(c));
    }

    deleteRefreshCookie(c);
    return c.json({ message: "Sesión cerrada correctamente" }, 200);
  },
});
