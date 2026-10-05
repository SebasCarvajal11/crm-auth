import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    server: "src/server.ts",
    "workers/email-outbox.worker": "src/workers/email-outbox.worker.ts",
    "workers/identity-outbox.worker": "src/workers/identity-outbox.worker.ts",
    "workers/token-cleanup.worker": "src/workers/token-cleanup.worker.ts",
  },
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  noExternal: ["@sebascarvajal11/cima-contracts"],
});
