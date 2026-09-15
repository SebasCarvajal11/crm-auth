import { createHash, createPublicKey, createVerify, generateKeyPairSync, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
const keys = vi.hoisted(() => ({ privateKey: "", publicKey: "" }));
vi.mock("../config/env", () => ({ env: {
  get JWT_PRIVATE_KEY() { return keys.privateKey; }, JWT_KID: "test-key",
  EMAIL_SERVICE_ISSUER: "crm-auth", MEDIA_SERVICE_URL: "http://media.example.test",
  MEDIA_EMAIL_TIMEOUT_MS: 1000, PASSWORD_RESET_TTL_MS: 3600000, EMAIL_VERIFY_TTL_MS: 172800000,
} }));
import { dispatchTransactionalEmailToMedia } from "./media-email-client";
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
keys.privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
keys.publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
afterEach(() => vi.unstubAllGlobals());
describe("Media producer client", () => {
  it("signs the exact command body and preserves its id on retries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValue(new Response(JSON.stringify({ success: true, messageId: "queued-id", status: "queued" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const event = { id: randomUUID(), createdAt: new Date() };
    await dispatchTransactionalEmailToMedia({ type: "admin_invite", to: "test@hurl.test", token: "opaque" }, event);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, options] = fetchMock.mock.calls[1];
    const request = JSON.parse(options.body);
    expect(request.id).toBe(event.id);
    expect(request.template.name).toBe("admin_invite");
    expect(options.body).toBe(fetchMock.mock.calls[0][1].body);
    const jwt = options.headers.Authorization.slice(7).split(".");
    const claims = JSON.parse(Buffer.from(jwt[1], "base64url").toString());
    expect(claims.bodyHash).toBe(createHash("sha256").update(options.body).digest("hex"));
    expect(claims.aud).toBe("crm-media:email");
    const verifier = createVerify("RSA-SHA256"); verifier.update(jwt[0] + "." + jwt[1]);
    expect(verifier.verify(createPublicKey(keys.publicKey), Buffer.from(jwt[2], "base64url"))).toBe(true);
  });
  it("rejects false success receipts and does not retry authorization failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("private upstream response", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(dispatchTransactionalEmailToMedia({ type: "password_reset", to: "test@hurl.test", token: "opaque" }, { id: randomUUID(), createdAt: new Date() })).rejects.toThrow("HTTP 401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
