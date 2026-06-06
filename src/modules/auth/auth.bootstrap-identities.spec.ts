import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createAuthRoutes } from "./auth.routes";
import { env } from "../../config/env";

describe("GET /bootstrap-identities", () => {
  it("should return 401 if X-Gateway-Trust header is missing", async () => {
    const mockServices = {
      adminUserService: {
        listActiveUsersForBootstrap: async () => [],
      },
    } as any;

    const app = new Hono();
    app.route("/", createAuthRoutes(mockServices));

    const res = await app.request("/bootstrap-identities");
    expect(res.status).toBe(401);
  });

  it("should return 401 if X-Gateway-Trust header is invalid", async () => {
    const mockServices = {
      adminUserService: {
        listActiveUsersForBootstrap: async () => [],
      },
    } as any;

    const app = new Hono();
    app.route("/", createAuthRoutes(mockServices));

    const res = await app.request("/bootstrap-identities", {
      headers: {
        "X-Gateway-Trust": "wrong-secret",
      },
    });
    expect(res.status).toBe(401);
  });

  it("should return 200 and list of users if X-Gateway-Trust is valid", async () => {
    const mockUsers = [
      {
        subject: "019e760d-04b8-717e-b7fe-cc0f368078df",
        email: "admin@cima.dev",
        role: "admin",
        first_name: "Admin",
        last_name: "User",
        client_kind: null,
        company_name: null,
        profession: null,
      },
    ];

    const mockServices = {
      adminUserService: {
        listActiveUsersForBootstrap: async () => mockUsers,
      },
    } as any;

    const app = new Hono();
    app.route("/", createAuthRoutes(mockServices));

    // Ensure there is a secret configured for test environment
    const secret = env.GATEWAY_TRUST_SECRET || "cima-local-gateway-trust-secret-do-not-use-production-2026";

    const res = await app.request("/bootstrap-identities", {
      headers: {
        "X-Gateway-Trust": secret,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toEqual(mockUsers);
  });
});
