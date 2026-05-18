import { Queue } from "bullmq";
import { getRedisConnection } from "../shared/redis";
import { sendTransactionalEmail } from "../email/mailer";
import type {
  EmailJobPublisher,
  TransactionalEmailJob,
} from "../email/transactional-email.types";

const QUEUE_NAME = "mod-auth-email";

let emailQueue: Queue<TransactionalEmailJob> | undefined;

/** Cola BullMQ (comparte Redis con rate limit y el worker). */
export const getEmailQueue = (): Queue<TransactionalEmailJob> | undefined => {
  const conn = getRedisConnection();
  if (!conn) return undefined;
  if (!emailQueue) {
    emailQueue = new Queue<TransactionalEmailJob>(QUEUE_NAME, {
      connection: conn,
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

/**
 * Encola en Redis si hay `REDIS_URL`; si no, envía en segundo plano sin bloquear la HTTP
 * (sin persistencia ni reintentos distribuidos).
 */
export function createEmailJobPublisher(): EmailJobPublisher {
  return {
    enqueue: async (job: TransactionalEmailJob) => {
      const queue = getEmailQueue();
      try {
        if (queue) {
          await queue.add("send", job);
          return;
        }
        void sendTransactionalEmail(job).catch((err) => {
          console.error("[email direct]", err);
        });
      } catch (err) {
        console.error("[email enqueue]", err);
        void sendTransactionalEmail(job).catch((e) => console.error("[email fallback]", e));
      }
    },
  };
}
