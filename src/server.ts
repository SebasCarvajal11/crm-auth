import { serve } from "@hono/node-server";
import { env } from "./config/env";
import { pool } from "./db/connection";
import { ensureAuditLogPartitions } from "./db/scripts/ensure-audit-log-partitions";

await ensureAuditLogPartitions(pool).catch((err) =>
  console.error("[audit_logs] ensure partitions:", err)
);

const { createApp } = await import("./app");
const app = createApp();

let serverRef: ReturnType<typeof serve> | null = null;
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[shutdown] ${signal}: cerrando HTTP y recursos…`);

  if (serverRef) {
    await new Promise<void>((resolve, reject) => {
      serverRef!.close((err) => (err ? reject(err) : resolve()));
    }).catch((err) => console.error("[shutdown] server.close:", err));
    serverRef = null;
  }

  await pool.end().catch((err) => console.error("[shutdown] pool.end:", err));
  console.log("[shutdown] Listo.");
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
    console.log(`🚀 mod-auth corriendo en http://localhost:${info.port}`);
    console.log(`   Entorno: ${env.NODE_ENV}`);
  }
);
