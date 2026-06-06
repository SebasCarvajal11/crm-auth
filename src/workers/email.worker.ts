/**
 * Worker BullMQ — proceso aparte: `pnpm worker:email`
 * Requiere REDIS_URL y variables de correo (ver `env.ts`).
 */
import { Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";
import { processTransactionalEmailJob } from "../queues/email.processor";
import { getLogger } from "../shared/logger";

const logger = getLogger();

if (!env.REDIS_URL) {
  logger.error({ topic: "worker:email" }, "REDIS_URL is required");
  process.exit(1);
}

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  EMAIL_QUEUE_NAME,
  processTransactionalEmailJob,
  {
    connection,
    prefix: "auth",
    concurrency: 5,
  }
);

worker.on("failed", (job, err) => {
  logger.error({ err, topic: "worker:email", jobId: job?.id }, "job failed");
});

worker.on("completed", (job) => {
  logger.info({ topic: "worker:email", jobId: job.id }, "enviado");
});

logger.info({ topic: "worker:email", queue: EMAIL_QUEUE_NAME }, "escuchando cola");

const shutdown = async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
