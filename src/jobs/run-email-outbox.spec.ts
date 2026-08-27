import { describe, expect, it } from "vitest";
import { createEmailJobId } from "./run-email-outbox";

describe("createEmailJobId", () => {
  it("generates a deterministic BullMQ-compatible identifier", () => {
    const job = { type: "password-reset", token: "opaque-test-token" };

    const first = createEmailJobId(job);

    expect(first).toBe(createEmailJobId(job));
    expect(first).toMatch(/^email-password-reset-[a-f0-9]{64}$/);
    expect(first).not.toContain(":");
    expect(first).not.toMatch(/^\d+$/);
  });
});
