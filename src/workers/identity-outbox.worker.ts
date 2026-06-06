/**
 * Publica eventos de identidad guardados transaccionalmente en schema_auth.identity_outbox.
 * Ejecutar: pnpm worker:identity-outbox
 */
import { env } from "../config/env";
import { runIdentityOutbox } from "../jobs/run-identity-outbox";
import { getLogger } from "../shared/logger";

const logger = getLogger();
const intervalMs = env.IDENTITY_OUTBOX_INTERVAL_MS;
const batchSize = env.IDENTITY_OUTBOX_BATCH_SIZE;

async function tick() {
  try {
    const result = await runIdentityOutbox({ batchSize });
    if (result.processed > 0) {
      logger.info({ topic: "worker:identity-outbox", result }, "lote procesado");
    }
  } catch (err) {
    logger.error({ err, topic: "worker:identity-outbox" }, "error");
  }
}

logger.info(
  { topic: "worker:identity-outbox", intervalMs, batchSize },
  "started"
);

await tick();
const timer = setInterval(tick, intervalMs);

const shutdown = () => {
  clearInterval(timer);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
