import type { Context } from "hono";
import type { AuthService } from "./auth.service";
import type { ForgotPasswordRequest, ResetPasswordRequest } from "./auth.schemas";
import { validatedJson } from "./validated-json";
import type { AppEnv } from "../../shared/middlewares/auth.middleware";
import { getIp, getUa } from "./auth.controller.helpers";

export const createPasswordProfileControllerHandlers = (authService: AuthService) => ({
  forgotPassword: async (c: Context) => {
    const { email } = validatedJson<ForgotPasswordRequest>(c);
    const result = await authService.forgotPassword(email, getIp(c), getUa(c));

    return c.json(
      {
        message: "Si el correo está registrado, recibirás un enlace de recuperación.",
        ...(result ? { data: { token: result.token } } : {}),
      },
      200
    );
  },

  resetPassword: async (c: Context) => {
    const data = validatedJson<ResetPasswordRequest>(c);
    await authService.resetPassword(data.token, data.password, getIp(c), getUa(c));

    return c.json({ message: "Contraseña actualizada correctamente" }, 200);
  },

  me: async (c: Context<AppEnv>) => {
    const { userId } = c.get("user");
    const data = await authService.getMe(userId);

    return c.json({ data }, 200);
  },

  /** Versión plana de /me — para uso exclusivo del BFF aggregation (sin wrapper `data`). */
  meFlat: async (c: Context<AppEnv>) => {
    const { userId } = c.get("user");
    const data = await authService.getMe(userId);

    return c.json(data, 200);
  },
});
