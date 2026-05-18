/**
 * Limpieza periódica de refresh tokens, resets, verificaciones e invitaciones obsoletas.
 * Ejecutar: pnpm worker:cleanup
 */
import { env } from "../config/env";
import { runTokenCleanup } from "../jobs/run-token-cleanup";

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
      console.log("[worker:cleanup] filas eliminadas:", counts);
    }
  } catch (err) {
    console.error("[worker:cleanup] error:", err);
  }
}

console.log(
  `[worker:cleanup] intervalo ${intervalMs}ms, retención ${env.TOKEN_CLEANUP_RETENTION_DAYS} días`,
);

await tick();
const timer = setInterval(tick, intervalMs);

const shutdown = () => {
  clearInterval(timer);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
