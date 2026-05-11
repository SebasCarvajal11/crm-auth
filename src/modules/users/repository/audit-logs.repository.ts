import { db } from "../../../db/connection";
import { auditLogs } from "../../../db/schema";
import type { AuditDetails } from "../users.types";

export const auditLogsRepository = {
  createAuditLog: async (
    userId: string | null,
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: AuditDetails
  ) => {
    await db.insert(auditLogs).values({
      userId,
      action,
      ipAddress,
      userAgent,
      details: details ?? null,
    });
  },
};
