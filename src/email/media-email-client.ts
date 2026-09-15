import { env } from "../config/env";
import { getLogger } from "../shared/logger";
import type { TransactionalEmailJob } from "./transactional-email.types";

const logger = getLogger();

export async function dispatchTransactionalEmailToMedia(
  job: TransactionalEmailJob,
  traceId?: string
): Promise<{ success: boolean; messageId: string }> {
  const mediaUrl = (env.MEDIA_SERVICE_URL || "http://crm-media:3002").replace(/\/$/, "");
  const endpoint = `${mediaUrl}/api/v1/emails/send`;

  const payload = {
    to: job.to,
    template: {
      name: job.type,
      variables: {
        token: job.token,
        to: job.to,
        appPublicUrl: env.APP_PUBLIC_URL,
      },
    },
    sync: false,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(traceId ? { "x-trace-id": traceId } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(
      { topic: "media:email-client", status: response.status, body: errorBody },
      "Error al despachar correo a crm-media"
    );
    throw new Error(`crm-media respondió status ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as { success: boolean; messageId: string };
  return data;
}