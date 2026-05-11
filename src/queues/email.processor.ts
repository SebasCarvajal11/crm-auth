import type { Job } from "bullmq";
import { sendTransactionalEmail } from "../email/mailer";
import type { TransactionalEmailJob } from "../email/transactional-email.types";

export const processTransactionalEmailJob = async (
  job: Job<TransactionalEmailJob>
): Promise<void> => {
  await sendTransactionalEmail(job.data);
};
