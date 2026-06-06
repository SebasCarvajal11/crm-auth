import { serve } from "@hono/node-server";
import { env } from "./config/env";
import { pool } from "./db/connection";
import { ensureAuditLogPartitions } from "./db/scripts/ensure-audit-log-partitions";
import { getLogger } from "./shared/logger";

const logger = getLogger();

await ensureAuditLogPartitions(pool).catch((err) =>
  logger.error({ err, topic: "audit_logs" }, "ensure partitions failed")
);

const { createApp } = await import("./app");
const app = createApp();

let serverRef: ReturnType<typeof serve> | null = null;
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal, topic: "shutdown" }, "cerrando HTTP y recursos");

  if (serverRef) {
    await new Promise<void>((resolve, reject) => {
      serverRef!.close((err) => (err ? reject(err) : resolve()));
    }).catch((err) => logger.error({ err, topic: "shutdown" }, "server.close failed"));
    serverRef = null;
  }

  await pool.end().catch((err) => logger.error({ err, topic: "shutdown" }, "pool.end failed"));
  logger.info({ topic: "shutdown" }, "Listo");
};

const exitAfterShutdown = (signal: string) => {
  void shutdown(signal).finally(() => process.exit(0));
};

process.once("SIGINT", () => exitAfterShutdown("SIGINT"));
process.once("SIGTERM", () => exitAfterShutdown("SIGTERM"));

serverRef = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    logger.info({ port: info.port, env: env.NODE_ENV }, "server started");
  }
);
