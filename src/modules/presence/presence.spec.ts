import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it, vi } from "vitest";

const keys = await vi.hoisted(async () => {
  const { generateKeyPairSync } = await import("node:crypto");
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKey: pair.publicKey.export({ format: "pem", type: "spki" }).toString() };
});
vi.mock("../../config/env", () => ({ env: { JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey, JWT_ISS: "cima-crm", NODE_ENV: "test" } }));

import { createPresenceRoutes } from "./presence.routes";
import { createPresenceService } from "./presence.service";
import { PresenceQuerySchema } from "./presence.schemas";
import { PRESENCE_POLICY } from "./presence.policy";
import { onError } from "../../shared/middlewares/error-handler.middleware";
import type { PresenceRepository } from "./presence.port";

const userId = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const repository: PresenceRepository = {
    observe: vi.fn().mockResolvedValue(true), canView: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ as_of: new Date().toISOString(), groups: [] }),
  };
  const app = new Hono();
  app.route("/presence", createPresenceRoutes(createPresenceService(repository)));
  app.onError(onError);
  return { app, repository };
}
async function authorization(role = "admin") {
  const token = await sign({ sub: userId, userId, role, email: "test@hurl.test", iss: "cima-crm", exp: Math.floor(Date.now() / 1000) + 60 }, keys.privateKey, "RS256");
  return { Authorization: `Bearer ${token}` };
}

describe("presence HTTP authorization and input boundaries", () => {
  it("rejects missing or invalid JWTs before querying the repository", async () => {
    const { app, repository } = fixture();
    for (const headers of [new Headers(), new Headers({ Authorization: "Bearer invalid" })]) {
      expect((await app.request("/presence", { headers })).status).toBe(401);
    }
    expect(repository.canView).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });
  it.each(["worker", "client"])("denies %s access without consuming presence data", async (role) => {
    const { app, repository } = fixture();
    expect((await app.request("/presence", { headers: await authorization(role) })).status).toBe(403);
    expect(repository.canView).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });
  it("rechecks the current administrator role and account state", async () => {
    const { app, repository } = fixture();
    vi.mocked(repository.canView).mockResolvedValue(false);
    expect((await app.request("/presence", { headers: await authorization() })).status).toBe(403);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it("returns no-store snapshots with centralized polling policy", async () => {
    const { app, repository } = fixture();
    const response = await app.request("/presence?q=Ana%20Maria&client_page=2", { headers: await authorization() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).data).toMatchObject({ online_for_seconds: PRESENCE_POLICY.onlineSeconds, refresh_after_seconds: PRESENCE_POLICY.refreshSeconds });
    expect(repository.list).toHaveBeenCalledWith({ q: "Ana Maria", worker_page: 1, client_page: 2, admin_page: 1 }, userId);
  });
  it.each(["worker_page=0", "client_page=-1", "admin_page=10001", "worker_page=1.5", `q=${"x".repeat(121)}`])("validates query %s before reading data", async (query) => {
    const { app, repository } = fixture();
    expect((await app.request(`/presence?${query}`, { headers: await authorization() })).status).toBe(400);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it.each(["worker", "client", "admin"])("accepts only the authenticated %s identity for self-observation", async (role) => {
    const { app, repository } = fixture();
    const response = await app.request("/presence/heartbeat", { method: "POST", headers: { ...await authorization(role), "Content-Type": "application/json" }, body: JSON.stringify({ userId: "spoofed-user" }) });
    expect(response.status).toBe(200);
    expect(repository.observe).toHaveBeenCalledWith(userId);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it("rejects observation after all sessions have expired or been revoked", async () => {
    const { app, repository } = fixture();
    vi.mocked(repository.observe).mockResolvedValue(false);
    expect((await app.request("/presence/heartbeat", { method: "POST", headers: await authorization() })).status).toBe(401);
  });
  it("normalizes empty search and requires integer pages", () => {
    expect(PresenceQuerySchema.parse({ q: "  " })).toEqual({ q: "", worker_page: 1, client_page: 1, admin_page: 1 });
  });
});
