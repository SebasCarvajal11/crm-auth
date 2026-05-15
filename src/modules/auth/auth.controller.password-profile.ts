import type { Context } from "hono";
import { env } from "../../config/env";
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
        message: "Si el correo esta registrado, recibiras un enlace de recuperacion.",
        ...(env.NODE_ENV === 'test' && result ? { data: { token: result.token } } : {}),
      },
      200
    );
  },

  resetPassword: async (c: Context) => {
    const data = validatedJson<ResetPasswordRequest>(c);
    await authService.resetPassword(data.token, data.password, getIp(c), getUa(c));

    return c.json({ message: "Contrasena actualizada correctamente" }, 200);
  },

  me: async (c: Context<AppEnv>) => {
    const { userId } = c.get("user");
    const data = await authService.getMe(userId);

    return c.json({ data }, 200);
  },

  /** Version plana de /me - para uso exclusivo del BFF aggregation (sin wrapper `data`). */
  meFlat: async (c: Context<AppEnv>) => {
    const { userId } = c.get("user");
    const data = await authService.getMe(userId);

    return c.json(data, 200);
  },
});
