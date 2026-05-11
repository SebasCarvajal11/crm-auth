/**
 * Worker BullMQ — proceso aparte: `npm run worker:email`
 * Requiere REDIS_URL y variables de correo (ver `env.ts`).
 */
import { Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";
import { processTransactionalEmailJob } from "../queues/email.processor";

if (!env.REDIS_URL) {
  console.error("❌ worker:email requiere REDIS_URL");
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
    concurrency: 5,
  }
);

worker.on("failed", (job, err) => {
  console.error(`[worker:email] falló job ${job?.id}`, err?.message);
});

worker.on("completed", (job) => {
  console.log(`[worker:email] enviado ${job.id}`);
});

console.log(`📧 Worker de correo escuchando cola "${EMAIL_QUEUE_NAME}"`);

const shutdown = async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
