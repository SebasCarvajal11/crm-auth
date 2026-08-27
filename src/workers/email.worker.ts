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
import { startWorkerHealthcheck } from "../shared/worker-health";

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
    connection: connection as any,
    prefix: "auth",
    concurrency: 5,
  }
);

// Start worker healthcheck (monitoring Redis connection only, no direct pool here)
const healthcheck = startWorkerHealthcheck("email-worker", { redis: connection });

worker.on("failed", (job, err) => {
  logger.error({ err, topic: "worker:email", jobId: job?.id }, "job failed");
});

// BullMQ reporta aquí errores de conexión y de ciclo de vida que no pertenecen
// a un trabajo concreto. Sin este listener un worker puede parecer levantado
// mientras no puede consumir la cola.
worker.on("error", (err) => {
  logger.error({ err, topic: "worker:email" }, "worker error");
});

worker.on("completed", (job) => {
  logger.info({ topic: "worker:email", jobId: job.id }, "enviado");
});

logger.info({ topic: "worker:email", queue: EMAIL_QUEUE_NAME }, "escuchando cola");

const shutdown = async () => {
  healthcheck.stop();
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
