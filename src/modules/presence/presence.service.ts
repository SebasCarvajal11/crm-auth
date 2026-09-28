import { ForbiddenError, UnauthorizedError } from "../../shared/middlewares/error-handler.middleware";
import type { PresenceRepository } from "./presence.port";
import type { PresenceQuery } from "./presence.schemas";
import { PRESENCE_POLICY } from "./presence.policy";

export const createPresenceService = (repository: PresenceRepository) => ({
  heartbeat: async (userId: string) => {
    if (!await repository.observe(userId)) throw new UnauthorizedError("La cuenta no tiene una sesión activa");
    return { heartbeat_interval_seconds: PRESENCE_POLICY.heartbeatSeconds };
  },
  list: async (userId: string, query: PresenceQuery) => {
    // A previously issued admin JWT cannot override a current suspension or role change.
    if (!await repository.canView(userId)) throw new ForbiddenError("Presencia disponible solo para administradores activos");
    return { ...await repository.list(query, userId),
      online_for_seconds: PRESENCE_POLICY.onlineSeconds,
      refresh_after_seconds: PRESENCE_POLICY.refreshSeconds,
      history_days: PRESENCE_POLICY.historyDays,
    };
  },
});
export type PresenceService = ReturnType<typeof createPresenceService>;
