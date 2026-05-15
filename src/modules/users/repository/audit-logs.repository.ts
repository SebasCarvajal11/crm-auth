import type { DbOrTx } from "../users.repository";
import { auditLogs } from "../../../db/schema";
import type { AuditDetails } from "../users.types";

export const createAuditLogsRepository = (conn: DbOrTx) => ({
  createAuditLog: async (
    userId: string | null,
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: AuditDetails
  ) => {
    await conn.insert(auditLogs).values({
      userId,
      action,
      ipAddress,
      userAgent,
      details: details ?? null,
    });
  },
});
