import type { Job } from "bullmq";
import { sendTransactionalEmail } from "../email/mailer";
import type { TransactionalEmailJob } from "../email/transactional-email.types";
import { traceStorage } from "../shared/logger";

export const processTransactionalEmailJob = async (
  job: Job<TransactionalEmailJob>
): Promise<void> => {
  const traceId = (job.data as any).traceId;
  const action = async () => {
    await sendTransactionalEmail(job.data);
  };

  if (traceId) {
    await traceStorage.run(traceId, action);
  } else {
    await action();
  }
};
