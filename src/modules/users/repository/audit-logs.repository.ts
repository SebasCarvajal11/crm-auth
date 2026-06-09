import type { DbOrTx } from "../users.repository";
import { auditLogs } from "../../../db/schema";
import type { AuditDetails } from "../users.types";
import { traceStorage } from "../../../shared/logger";

export interface CreateAuditLogParams {
  actorSub: string | null;
  actorEmail?: string | null;
  actorRole?: "admin" | "worker" | "client" | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  ipAddress: string;
  userAgent: string;
  correlationId?: string | null;
  details?: AuditDetails | null;
}

export const createAuditLogsRepository = (conn: DbOrTx) => ({
  createAuditLog: async (
    first: string | null | CreateAuditLogParams,
    action?: string,
    ipAddress?: string,
    userAgent?: string,
    details?: AuditDetails
  ): Promise<void> => {
    let params: CreateAuditLogParams;
    if (first && typeof first === "object" && "action" in first) {
      params = first as CreateAuditLogParams;
    } else {
      params = {
        actorSub: first,
        action: action!,
        ipAddress: ipAddress!,
        userAgent: userAgent!,
        details: details ?? null,
      };
    }

    const store = traceStorage.getStore();
    const correlationId = params.correlationId ?? store?.correlationId ?? null;

    // Default resourceType/Id based on action if not provided
    const resourceType = params.resourceType ?? "user";
    const resourceId = params.resourceId ?? params.actorSub ?? null;

    // Insert locally in PostgreSQL
    await conn.insert(auditLogs).values({
      actorSub: params.actorSub,
      actorEmail: params.actorEmail ?? null,
      actorRole: params.actorRole ?? null,
      action: params.action,
      resourceType,
      resourceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      correlationId,
      details: params.details ?? null,
    });

    // Publish to Redis Stream if it is a sensitive action
    const sensitiveActions = [
      "login_success",
      "logout",
      "invitation_created",
      "invitation_accepted",
      "worker_registered",
      "admin_invited",
      "password_reset_completed",
      "password_changed_known_old",
      "user_soft_deleted",
      "user_restored",
    ];

    if (sensitiveActions.includes(params.action)) {
      try {
        const { publishAuditEvent } = await import("../../../shared/event-publisher");
        await publishAuditEvent({
          actorSub: params.actorSub,
          actorEmail: params.actorEmail ?? null,
          actorRole: params.actorRole ?? null,
          action: params.action,
          resourceType,
          resourceId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          correlationId,
          details: params.details ?? null,
        }, { requireRedis: false });
      } catch (err) {
        // Warning log only; do not fail transaction
        const { getLogger } = await import("../../../shared/logger");
        getLogger().warn({ err, action: params.action }, "No se pudo publicar evento de auditoria");
      }
    }
  },
});
