import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runIdentityOutbox: vi.fn(),
  runEmailOutbox: vi.fn(),
  runTokenCleanup: vi.fn(),
  startReplayRequestListener: vi.fn(),
  stopReplayRequestListener: vi.fn(),
  startWorkerHealthcheck: vi.fn(),
  healthcheckStop: vi.fn(),
  initRedis: vi.fn(),
  getRedisConnection: vi.fn(),
  closeRedisConnections: vi.fn(),
  poolEnd: vi.fn(),
}));

vi.mock("../config/env", () => ({
  env: {
    REDIS_URL: "redis://localhost:6379",
    IDENTITY_OUTBOX_INTERVAL_MS: 10000,
    IDENTITY_OUTBOX_BATCH_SIZE: 50,
    EMAIL_OUTBOX_INTERVAL_MS: 5000,
    EMAIL_OUTBOX_BATCH_SIZE: 20,
    TOKEN_CLEANUP_INTERVAL_MS: 60000,
  },
}));

vi.mock("../jobs/run-identity-outbox", () => ({
  runIdentityOutbox: mocks.runIdentityOutbox,
}));

vi.mock("../jobs/run-email-outbox", () => ({
  runEmailOutbox: mocks.runEmailOutbox,
}));

vi.mock("../jobs/run-token-cleanup", () => ({
  runTokenCleanup: mocks.runTokenCleanup,
}));

vi.mock("../shared/replay-request-listener", () => ({
  startReplayRequestListener: mocks.startReplayRequestListener,
  stopReplayRequestListener: mocks.stopReplayRequestListener,
}));

vi.mock("../shared/worker-health", () => ({
  startWorkerHealthcheck: mocks.startWorkerHealthcheck.mockReturnValue({
    stop: mocks.healthcheckStop,
  }),
}));

vi.mock("../db/connection", () => ({
  pool: { end: mocks.poolEnd },
}));

vi.mock("../shared/redis", () => ({
  initRedis: mocks.initRedis,
  getRedisConnection: mocks.getRedisConnection,
  closeRedisConnections: mocks.closeRedisConnections,
}));

vi.mock("../app", () => ({
  serviceMetrics: {
    outboxDepthGauge: { set: vi.fn() },
  },
}));

import { startAuthWorker, stopAuthWorker } from "./auth.worker";

describe("auth.worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runIdentityOutbox.mockResolvedValue({ processed: 2, pending: 0 });
    mocks.runEmailOutbox.mockResolvedValue({ processed: 1 });
    mocks.runTokenCleanup.mockResolvedValue({
      refreshTokens: 1,
      passwordResets: 0,
      emailVerifications: 0,
      invitations: 0,
      emailOutbox: 0,
    });
    mocks.startReplayRequestListener.mockResolvedValue(undefined);
    mocks.stopReplayRequestListener.mockResolvedValue(undefined);
    mocks.closeRedisConnections.mockResolvedValue(undefined);
    mocks.poolEnd.mockResolvedValue(undefined);
  });

  it("inicia concurrentemente outbox, email, cleanup y healthcheck", async () => {
    await startAuthWorker();

    expect(mocks.initRedis).toHaveBeenCalledWith("redis://localhost:6379");
    expect(mocks.startWorkerHealthcheck).toHaveBeenCalledWith(
      "auth-worker",
      expect.any(Object),
    );
    expect(mocks.startReplayRequestListener).toHaveBeenCalled();
    expect(mocks.runIdentityOutbox).toHaveBeenCalledWith({ batchSize: 50 });
    expect(mocks.runEmailOutbox).toHaveBeenCalledWith(20);
    expect(mocks.runTokenCleanup).toHaveBeenCalled();

    await stopAuthWorker();
    expect(mocks.healthcheckStop).toHaveBeenCalled();
    expect(mocks.stopReplayRequestListener).toHaveBeenCalled();
    expect(mocks.closeRedisConnections).toHaveBeenCalled();
    expect(mocks.poolEnd).toHaveBeenCalled();
  });

  it("tolera errores en ciclos de outbox y cleanup sin abortar el worker", async () => {
    mocks.runIdentityOutbox.mockRejectedValueOnce(new Error("DB error"));
    mocks.runEmailOutbox.mockRejectedValueOnce(new Error("Email error"));
    mocks.runTokenCleanup.mockRejectedValueOnce(new Error("Cleanup error"));

    await expect(startAuthWorker()).resolves.not.toThrow();
    await stopAuthWorker();
  });
});
