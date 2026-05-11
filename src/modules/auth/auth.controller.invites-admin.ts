import type { Context } from "hono";
import type { AuthService } from "./auth.service";
import type {
  AcceptInviteRequest,
  InviteClientRequest,
  RegisterWorkerRequest,
} from "./auth.schemas";
import { validatedJson } from "./validated-json";
import type { AppEnv } from "../../shared/middlewares/auth.middleware";
import { getIp, getUa, setRefreshCookie } from "./auth.controller.helpers";

export const createInvitesAdminControllerHandlers = (authService: AuthService) => ({
  registerWorker: async (c: Context<AppEnv>) => {
    const data = validatedJson<RegisterWorkerRequest>(c);
    const { userId } = c.get("user");
    const result = await authService.registerWorker(data, userId, getIp(c), getUa(c));

    return c.json({ data: result }, 201);
  },

  inviteClient: async (c: Context<AppEnv>) => {
    const data = validatedJson<InviteClientRequest>(c);
    const { userId } = c.get("user");
    const result = await authService.inviteClient(data, userId, getIp(c), getUa(c));

    const payload: { message: string; data: { token?: string } } = {
      message: "Invitación creada",
      data: {},
    };
    if (result.token) payload.data.token = result.token;

    return c.json(payload, 201);
  },

  getInvitationData: async (c: Context) => {
    const token = c.req.param("token") ?? "";
    const data = await authService.getInvitationData(token);

    return c.json({ data }, 200);
  },

  acceptInvite: async (c: Context) => {
    const data = validatedJson<AcceptInviteRequest>(c);
    const result = await authService.acceptInvitation(data, getIp(c), getUa(c));

    setRefreshCookie(c, result.refresh_token);

    return c.json({ data: { access_token: result.access_token, user: result.user } }, 201);
  },
});
