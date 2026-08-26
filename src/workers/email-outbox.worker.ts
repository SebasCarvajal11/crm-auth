import { env } from "../config/env";
import { runEmailOutbox } from "../jobs/run-email-outbox";
import { getLogger } from "../shared/logger";
import { initRedis, getRedisConnection } from "../shared/redis";
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
    const result = await runEmailOutbox(env.IDENTITY_OUTBOX_BATCH_SIZE);
    if (result.processed > 0) logger.info({ topic: "worker:email-outbox", result }, "lote procesado");
  } catch (err) {
    logger.error({ err, topic: "worker:email-outbox" }, "error");
  } finally {
    ticking = false;
  }
};

await tick();
const timer = setInterval(tick, env.IDENTITY_OUTBOX_INTERVAL_MS);
const shutdown = () => { healthcheck.stop(); clearInterval(timer); process.exit(0); };
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
