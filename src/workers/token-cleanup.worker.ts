/**
 * Limpieza periódica de refresh tokens, resets, verificaciones e invitaciones obsoletas.
 * Ejecutar: pnpm worker:cleanup
 */
import { env } from "../config/env";
import { runTokenCleanup } from "../jobs/run-token-cleanup";
import { getLogger } from "../shared/logger";

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

await tick();
const timer = setInterval(tick, intervalMs);

const shutdown = () => {
  clearInterval(timer);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
