import { env } from "../config/env";
import { runTokenCleanup } from "../jobs/run-token-cleanup";
import { getLogger } from "../shared/logger";
import { startWorkerHealthcheck } from "../shared/worker-health";
import { pool } from "../db/connection";
import { getRedisConnection } from "../shared/redis";

const logger = getLogger();

const intervalMs = env.TOKEN_CLEANUP_INTERVAL_MS;

async function tick() {
  try {
    const counts = await runTokenCleanup();
    const total =
      counts.refreshTokens +
      counts.passwordResets +
      counts.emailVerifications +
      counts.invitations;
    if (total > 0) {
      logger.info({ topic: "worker:cleanup", counts }, "filas eliminadas");
    }
  } catch (err) {
    logger.error({ err, topic: "worker:cleanup" }, "error");
  }
}

logger.info(
  { topic: "worker:cleanup", intervalMs, retentionDays: env.TOKEN_CLEANUP_RETENTION_DAYS },
  "started",
);

// Start worker healthcheck (monitoring both DB and Redis)
const healthcheck = startWorkerHealthcheck("token-cleanup-worker", {
  pool,
  redis: getRedisConnection(),
});

await tick();
const timer = setInterval(tick, intervalMs);

const shutdown = () => {
  healthcheck.stop();
  clearInterval(timer);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
