import { env } from "../config/env";
import { runIdentityOutbox } from "../jobs/run-identity-outbox";
import { runEmailOutbox } from "../jobs/run-email-outbox";
import { runTokenCleanup } from "../jobs/run-token-cleanup";
import { getLogger } from "../shared/logger";
import {
  startReplayRequestListener,
  stopReplayRequestListener,
} from "../shared/replay-request-listener";
import { startWorkerHealthcheck } from "../shared/worker-health";
import { pool } from "../db/connection";
import {
  initRedis,
  getRedisConnection,
  closeRedisConnections,
} from "../shared/redis";
import { serviceMetrics } from "../app";

const logger = getLogger();

interface AuthWorkerState {
  identityTimer?: NodeJS.Timeout;
  emailTimer?: NodeJS.Timeout;
  cleanupTimer?: NodeJS.Timeout;
  healthcheck?: ReturnType<typeof startWorkerHealthcheck>;
  isIdentityTicking: boolean;
  isEmailTicking: boolean;
  isCleanupTicking: boolean;
  isShuttingDown: boolean;
}

const state: AuthWorkerState = {
  isIdentityTicking: false,
  isEmailTicking: false,
  isCleanupTicking: false,
  isShuttingDown: false,
};

async function tickIdentityOutbox(): Promise<void> {
  if (state.isIdentityTicking || state.isShuttingDown) return;
  state.isIdentityTicking = true;
  try {
    const result = await runIdentityOutbox({
      batchSize: env.IDENTITY_OUTBOX_BATCH_SIZE,
    });
    if (result.processed > 0) {
      logger.info({ topic: "worker:identity-outbox", result }, "lote procesado");
    }
    serviceMetrics.outboxDepthGauge.set(
      { worker: "identity-outbox" },
      result.pending ?? 0,
    );
  } catch (err) {
    logger.error({ err, topic: "worker:identity-outbox" }, "error");
  } finally {
    state.isIdentityTicking = false;
  }
}

async function tickEmailOutbox(): Promise<void> {
  if (state.isEmailTicking || state.isShuttingDown) return;
  state.isEmailTicking = true;
  try {
    const result = await runEmailOutbox(env.EMAIL_OUTBOX_BATCH_SIZE);
    if (result.processed > 0) {
      logger.info({ topic: "worker:email-outbox", result }, "lote procesado");
    }
  } catch (err) {
    logger.error({ err, topic: "worker:email-outbox" }, "error");
  } finally {
    state.isEmailTicking = false;
  }
}

async function tickTokenCleanup(): Promise<void> {
  if (state.isCleanupTicking || state.isShuttingDown) return;
  state.isCleanupTicking = true;
  try {
    const counts = await runTokenCleanup();
    const total =
      counts.refreshTokens +
      counts.passwordResets +
      counts.emailVerifications +
      counts.invitations +
      counts.emailOutbox;
    if (total > 0) {
      logger.info({ topic: "worker:cleanup", counts }, "filas eliminadas");
    }
  } catch (err) {
    logger.error({ err, topic: "worker:cleanup" }, "error");
  } finally {
    state.isCleanupTicking = false;
  }
}

export async function startAuthWorker(): Promise<void> {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL es requerida para el auth worker consolidado");
  }

  initRedis(env.REDIS_URL);

  state.healthcheck = startWorkerHealthcheck("auth-worker", {
    pool,
    redis: getRedisConnection(),
  });

  await startReplayRequestListener();

  logger.info(
    {
      topic: "worker:auth",
      identityInterval: env.IDENTITY_OUTBOX_INTERVAL_MS,
      emailInterval: env.EMAIL_OUTBOX_INTERVAL_MS,
      cleanupInterval: env.TOKEN_CLEANUP_INTERVAL_MS,
    },
    "Auth worker consolidado iniciado",
  );

  await tickIdentityOutbox();
  await tickEmailOutbox();
  await tickTokenCleanup();

  state.identityTimer = setInterval(
    tickIdentityOutbox,
    env.IDENTITY_OUTBOX_INTERVAL_MS,
  );
  state.emailTimer = setInterval(
    tickEmailOutbox,
    env.EMAIL_OUTBOX_INTERVAL_MS,
  );
  state.cleanupTimer = setInterval(
    tickTokenCleanup,
    env.TOKEN_CLEANUP_INTERVAL_MS,
  );
}

export async function stopAuthWorker(): Promise<void> {
  state.isShuttingDown = true;

  if (state.identityTimer) clearInterval(state.identityTimer);
  if (state.emailTimer) clearInterval(state.emailTimer);
  if (state.cleanupTimer) clearInterval(state.cleanupTimer);

  const deadline = Date.now() + 5000;
  while (
    (state.isIdentityTicking || state.isEmailTicking || state.isCleanupTicking) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await stopReplayRequestListener().catch(() => undefined);

  if (state.healthcheck) {
    state.healthcheck.stop();
  }

  await closeRedisConnections();
  await pool.end().catch(() => undefined);
  logger.info({ topic: "worker:auth" }, "Auth worker consolidado detenido");
}

const isDirectRun =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    process.argv[1].includes("auth.worker"));

if (isDirectRun) {
  const shutdown = async () => {
    await stopAuthWorker();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  await startAuthWorker();
}
