import { Queue } from "bullmq";
import { getRedisConnection } from "../shared/redis";
import type { TransactionalEmailJob } from "../email/transactional-email.types";

const QUEUE_NAME = "mod-auth-email";

let emailQueue: Queue<TransactionalEmailJob> | undefined;

/** Cola BullMQ (comparte Redis con rate limit y el worker). */
export const getEmailQueue = (): Queue<TransactionalEmailJob> | undefined => {
  const conn = getRedisConnection();
  if (!conn) return undefined;
  if (!emailQueue) {
    emailQueue = new Queue<TransactionalEmailJob>(QUEUE_NAME, {
      connection: conn as any,
      prefix: "auth",
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 4000 },
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return emailQueue;
};

export const EMAIL_QUEUE_NAME = QUEUE_NAME;
