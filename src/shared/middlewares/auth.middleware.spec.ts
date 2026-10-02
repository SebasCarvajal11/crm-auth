import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { onError } from "./error-handler.middleware";

const mockVerify = vi.fn();
vi.mock("hono/jwt", () => ({
  verify: (...args: unknown[]) => mockVerify(...args),
}));

const mockIsTokenRevoked = vi.fn();
const mockIsUserRevoked = vi.fn();
vi.mock("@sebascarvajal11/cima-contracts/token-blocklist", () => ({
  isTokenRevoked: (token: string) => mockIsTokenRevoked(token),
  isUserRevoked: (userId: string, iat?: number) => mockIsUserRevoked(userId, iat),
}));

import { authMiddleware } from "./auth.middleware";

describe("authMiddleware and Token Blocklist Defenses", () => {
  let app: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTokenRevoked.mockResolvedValue(false);
    mockIsUserRevoked.mockResolvedValue(false);
    app = new Hono();
    app.onError(onError);
    app.use("/protected", authMiddleware);
    app.get("/protected", (c) => c.json({ user: c.get("user") }, 200));
  });

  it("rejects requests missing the Authorization header", async () => {
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("Se requiere un token de autorización");
  });

  it("rejects requests with malformed Authorization header", async () => {
    const res = await app.request("/protected", {
      headers: { Authorization: "Basic abc123xyz" },
    });
    expect(res.status).toBe(401);
  });

  it("allows valid non-revoked token and attaches user payload", async () => {
    mockVerify.mockResolvedValue({
      sub: "usr-1",
      userId: "usr-1",
      email: "user@cima.com",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
    });

    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer valid-token-123" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.userId).toBe("usr-1");
  });

  it("rejects revoked token immediately with 401", async () => {
    mockVerify.mockResolvedValue({
      sub: "usr-1",
      userId: "usr-1",
      email: "user@cima.com",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    mockIsTokenRevoked.mockResolvedValue(true);

    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer revoked-token-xyz" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Token revocado o sesión finalizada");
  });

  it("rejects token when user sessions have been revoked globally", async () => {
    mockVerify.mockResolvedValue({
      sub: "usr-2",
      userId: "usr-2",
      email: "banned@cima.com",
      role: "worker",
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: 1000,
    });
    mockIsUserRevoked.mockResolvedValue(true);

    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer old-user-token" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Sesión revocada para este usuario");
  });
});
