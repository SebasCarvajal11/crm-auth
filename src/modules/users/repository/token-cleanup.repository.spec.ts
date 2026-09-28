import { describe, expect, it, vi } from "vitest";
import { createTokenCleanupRepository } from "./token-cleanup.repository";

describe("token-cleanup.repository", () => {
  it("purges stale auth artifacts including published identity outbox events (ADR-010)", async () => {
    const mockReturning = vi.fn().mockImplementation(() => {
      return Promise.resolve([{ id: "item-1" }, { id: "item-2" }]);
    });

    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

    const mockConn: any = {
      delete: mockDelete,
    };

    const repo = createTokenCleanupRepository(mockConn);
    const result = await repo.purgeStaleAuthArtifacts(30);

    expect(result).toEqual({
      refreshTokens: 2,
      passwordResets: 2,
      emailVerifications: 2,
      invitations: 2,
      emailOutbox: 2,
      identityOutbox: 2,
    });

    expect(mockDelete).toHaveBeenCalledTimes(6);
  });
});
