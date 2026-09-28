import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  repo: {
    listUsersPaginated: vi.fn(),
    transaction: vi.fn(),
  },
  tx: {
    createIdentityOutboxEventsBatch: vi.fn(),
  },
}));

vi.mock("../modules/users/users.repository", () => ({
  createUsersRepository: () => mocks.repo,
}));

vi.mock("../config/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { triggerIdentityReplay } from "./replay-request-listener";

describe("replay-request-listener - triggerIdentityReplay (ADR-010)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repo.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb(mocks.tx);
    });
  });

  it("handles empty user list gracefully", async () => {
    mocks.repo.listUsersPaginated.mockResolvedValue({ rows: [] });

    await triggerIdentityReplay();

    expect(mocks.repo.listUsersPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 500,
      includeDeleted: false,
    });
    expect(mocks.tx.createIdentityOutboxEventsBatch).not.toHaveBeenCalled();
  });

  it("paginates and inserts events in batches of 500", async () => {
    const makeUser = (i: number) => ({
      subject: `sub-${i}`,
      email: `user${i}@example.com`,
      role: "client" as const,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      clientKind: null,
      companyName: null,
      profession: null,
    });

    const batch1 = Array.from({ length: 500 }, (_, i) => makeUser(i));
    const batch2 = Array.from({ length: 250 }, (_, i) => makeUser(500 + i));

    mocks.repo.listUsersPaginated
      .mockResolvedValueOnce({ rows: batch1 })
      .mockResolvedValueOnce({ rows: batch2 });

    await triggerIdentityReplay();

    expect(mocks.repo.listUsersPaginated).toHaveBeenCalledTimes(2);
    expect(mocks.repo.listUsersPaginated).toHaveBeenNthCalledWith(1, {
      page: 1,
      limit: 500,
      includeDeleted: false,
    });
    expect(mocks.repo.listUsersPaginated).toHaveBeenNthCalledWith(2, {
      page: 2,
      limit: 500,
      includeDeleted: false,
    });

    expect(mocks.tx.createIdentityOutboxEventsBatch).toHaveBeenCalledTimes(2);
    expect(mocks.tx.createIdentityOutboxEventsBatch).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ type: "user.registered", user: expect.objectContaining({ subject: "sub-0" }) }),
      ])
    );
    expect(mocks.tx.createIdentityOutboxEventsBatch).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ type: "user.registered", user: expect.objectContaining({ subject: "sub-500" }) }),
      ])
    );
  });
});
