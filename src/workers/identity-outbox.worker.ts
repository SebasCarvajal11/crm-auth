import { env } from "../config/env";
import { runIdentityOutbox } from "../jobs/run-identity-outbox";
import { getLogger } from "../shared/logger";
import { startReplayRequestListener, stopReplayRequestListener } from "../shared/replay-request-listener";
import { startWorkerHealthcheck } from "../shared/worker-health";
import { pool } from "../db/connection";
import { getRedisConnection } from "../shared/redis";
import { serviceMetrics } from "../app";

const logger = getLogger();
const intervalMs = env.IDENTITY_OUTBOX_INTERVAL_MS;
const batchSize = env.IDENTITY_OUTBOX_BATCH_SIZE;

let isTicking = false;

async function tick() {
  if (isTicking) return;
  isTicking = true;
  try {
    const result = await runIdentityOutbox({ batchSize });
    if (result.processed > 0) {
      logger.info({ topic: "worker:identity-outbox", result }, "lote procesado");
    }
    // Actualizar gauge de profundidad de outbox (pendientes tras el tick)
    serviceMetrics.outboxDepthGauge.set(
      { worker: "identity-outbox" },
      result.pending ?? 0
    );
  } catch (err) {
    logger.error({ err, topic: "worker:identity-outbox" }, "error");
  } finally {
    isTicking = false;
  }
}

logger.info(
  { topic: "worker:identity-outbox", intervalMs, batchSize },
  "started"
);

// Start worker healthcheck (monitoring both DB and Redis)
const healthcheck = startWorkerHealthcheck("identity-outbox-worker", {
  pool,
  redis: getRedisConnection(),
});

await startReplayRequestListener();
await tick();
const timer = setInterval(tick, intervalMs);

const shutdown = async () => {
  healthcheck.stop();
  clearInterval(timer);
  await stopReplayRequestListener().catch(() => undefined);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
