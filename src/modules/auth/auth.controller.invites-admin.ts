import type { Context } from "hono";
import { env } from "../../config/env";
import type { InvitationService, WorkerRegistrationService } from "./auth.service";
import type {
  AcceptInviteRequest,
  InviteAdminRequest,
  InviteClientRequest,
  RegisterWorkerRequest,
} from "./auth.schemas";
import { validatedJson } from "./validated-json";
import type { AppEnv } from "../../shared/middlewares/auth.middleware";
import { getIp, getUa, setRefreshCookie } from "./auth.controller.helpers";

export const createInvitesAdminControllerHandlers = (
  invitationService: InvitationService,
  workerRegistrationService: WorkerRegistrationService
) => ({
  registerWorker: async (c: Context<AppEnv>) => {
    const data = validatedJson<RegisterWorkerRequest>(c);
    const { userId } = c.get("user");
    const result = await workerRegistrationService.registerWorker(data, userId, getIp(c), getUa(c));

    return c.json({ data: result }, 201);
  },

  inviteAdmin: async (c: Context<AppEnv>) => {
    const data = validatedJson<InviteAdminRequest>(c);
    const { userId } = c.get("user");
    const result = await workerRegistrationService.inviteAdmin(data, userId, getIp(c), getUa(c));

    return c.json(
      {
        message: env.NODE_ENV === "test" ? "Invitación de administrador creada" : "Invitación de administrador creada y correo encolado",
        data: result,
      },
      201
    );
  },

  inviteClient: async (c: Context<AppEnv>) => {
    const data = validatedJson<InviteClientRequest>(c);
    const { userId } = c.get("user");
    const result = await invitationService.inviteClient(data, userId, getIp(c), getUa(c));

    return c.json(
      {
        message: env.NODE_ENV === 'test' ? 'Invitacion creada' : 'Invitacion creada y correo encolado',
        ...(env.NODE_ENV === 'test' && result ? { data: { token: result.token } } : {}),
      },
      201
    );
  },

  getInvitationData: async (c: Context) => {
    const token = c.req.param("token") ?? "";
    const data = await invitationService.getInvitationData(token);

    return c.json({ data }, 200);
  },

  acceptInvite: async (c: Context) => {
    const data = validatedJson<AcceptInviteRequest>(c);
    const result = await invitationService.acceptInvitation(data, getIp(c), getUa(c));

    setRefreshCookie(c, result.refresh_token);

    return c.json({ data: { access_token: result.access_token, user: result.user } }, 201);
  },
});

