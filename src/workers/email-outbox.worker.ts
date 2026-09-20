import { env } from "../config/env";
import { runEmailOutbox } from "../jobs/run-email-outbox";
import { getLogger } from "../shared/logger";
import { initRedis, getRedisConnection, closeRedisConnections } from "../shared/redis";
import { pool } from "../db/connection";
import { startWorkerHealthcheck } from "../shared/worker-health";

const logger = getLogger();
if (!env.REDIS_URL) throw new Error("REDIS_URL is required for the email outbox worker");

initRedis(env.REDIS_URL);
const healthcheck = startWorkerHealthcheck("email-outbox-worker", { pool, redis: getRedisConnection() });
let ticking = false;

const tick = async () => {
  if (ticking) return;
  ticking = true;
  try {
    const result = await runEmailOutbox(env.EMAIL_OUTBOX_BATCH_SIZE);
    if (result.processed > 0) logger.info({ topic: "worker:email-outbox", result }, "lote procesado");
  } catch (err) {
    logger.error({ err, topic: "worker:email-outbox" }, "error");
  } finally {
    ticking = false;
  }
};

await tick();
const timer = setInterval(tick, env.EMAIL_OUTBOX_INTERVAL_MS);
const shutdown = async () => {
  clearInterval(timer);
  while (ticking) await new Promise((resolve) => setTimeout(resolve, 100));
  healthcheck.stop();
  await closeRedisConnections();
  await pool.end();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
