import type { TransactionalEmailJob } from "./transactional-email.types";
import { dispatchTransactionalEmailToMedia } from "./media-email-client";

export const sendTransactionalEmail = async (
  job: TransactionalEmailJob,
  traceId?: string
): Promise<void> => {
  await dispatchTransactionalEmailToMedia(job, traceId);
};