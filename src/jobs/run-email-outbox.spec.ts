import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  repo: { listPendingEmailOutboxEvents: vi.fn(), markEmailOutboxPublished: vi.fn(),
    markEmailOutboxFailed: vi.fn(), markEmailOutboxExpired: vi.fn() },
  dispatch: vi.fn(),
}));
vi.mock("../config/env", () => ({ env: { PASSWORD_RESET_TTL_MS: 3600000, EMAIL_VERIFY_TTL_MS: 172800000 } }));
vi.mock("../modules/users/users.repository", () => ({ createUsersRepository: () => mocks.repo }));
vi.mock("../email/email-outbox-crypto", () => ({ decryptEmailJob: (payload: unknown) => payload }));
vi.mock("../email/media-email-client", () => ({ dispatchTransactionalEmailToMedia: mocks.dispatch }));
import { runEmailOutbox } from "./run-email-outbox";
const event = () => ({ id: "stable-id", createdAt: new Date(), payload: { type: "password_reset", to: "test@hurl.test", token: "opaque" } });
beforeEach(() => vi.resetAllMocks());
describe("email outbox delivery", () => {
  it("marks published only after Media acknowledges the stable event", async () => {
    const row = event(); mocks.repo.listPendingEmailOutboxEvents.mockResolvedValue([row]);
    expect(await runEmailOutbox()).toMatchObject({ published: 1, failed: 0 });
    expect(mocks.dispatch).toHaveBeenCalledWith(row.payload, row);
    expect(mocks.repo.markEmailOutboxPublished).toHaveBeenCalledWith(row.id);
  });
  it("keeps failed delivery recoverable without marking it published", async () => {
    mocks.repo.listPendingEmailOutboxEvents.mockResolvedValue([event()]);
    mocks.dispatch.mockRejectedValue(new Error("Unavailable"));
    expect(await runEmailOutbox()).toMatchObject({ published: 0, failed: 1 });
    expect(mocks.repo.markEmailOutboxPublished).not.toHaveBeenCalled();
    expect(mocks.repo.markEmailOutboxFailed).toHaveBeenCalled();
  });
  it("does not send expired action links", async () => {
    const row = { ...event(), createdAt: new Date(Date.now() - 7200000) };
    mocks.repo.listPendingEmailOutboxEvents.mockResolvedValue([row]);
    await runEmailOutbox();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.repo.markEmailOutboxExpired).toHaveBeenCalledWith(row.id);
  });
});
