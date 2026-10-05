import { describe, it, expect } from "vitest";
import { generateOpaqueRefreshToken, hashRefreshToken } from "./auth.token-utils";

describe("auth.token-utils", () => {
  describe("generateOpaqueRefreshToken", () => {
    it("should generate a 80-character hex string", () => {
      const token = generateOpaqueRefreshToken();
      expect(token).toBeTypeOf("string");
      expect(token).toHaveLength(80); // 40 bytes = 80 hex characters
      expect(token).toMatch(/^[0-9a-f]{80}$/);
    });

    it("should generate unique tokens on consecutive calls", () => {
      const token1 = generateOpaqueRefreshToken();
      const token2 = generateOpaqueRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("hashRefreshToken", () => {
    it("should compute SHA-256 hash in hex format", () => {
      const token = "test-token";
      const hash = hashRefreshToken(token);
      expect(hash).toHaveLength(64); // SHA-256 is 64 hex characters
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      
      // Known SHA-256 for "test-token"
      // echo -n "test-token" | shasum -a 256 => 4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e
      expect(hash).toBe("4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e");
    });
  });

  describe("buildAccessToken", () => {
    it("should issue a JWT with canonical iss 'cima-crm' and valid claims", async () => {
      const { buildAccessToken } = await import("./auth.token-utils");
      const token = await buildAccessToken(
        "user-sub-123",
        "user-id-456",
        "admin",
        "admin@cima.com.co"
      );

      expect(token).toBeTypeOf("string");
      const parts = token.split(".");
      expect(parts).toHaveLength(3);

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      expect(payload.iss).toBe("cima-crm");
      expect(payload.sub).toBe("user-sub-123");
      expect(payload.userId).toBe("user-id-456");
      expect(payload.role).toBe("admin");
      expect(payload.email).toBe("admin@cima.com.co");
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe("issueTokenPair", () => {
    it("should issue token pair with persistent flag and 7-day TTL", async () => {
      const { issueTokenPair } = await import("./auth.token-utils");
      let savedData: any = null;
      const mockRepo = {
        saveRefreshToken: async (data: any) => {
          savedData = data;
          return {} as any;
        },
      };

      const result = await issueTokenPair(mockRepo, {
        userId: "user-1",
        subject: "sub-1",
        role: "admin",
        email: "admin@cima.co",
        userAgent: "TestAgent",
        isPersistent: true,
      });

      expect(result.isPersistent).toBe(true);
      expect(result.accessToken).toBeTypeOf("string");
      expect(result.rawRefreshToken).toHaveLength(80);
      expect(savedData.isPersistent).toBe(true);
      // Persistent should expire around 7 days in the future
      const diffDays = (savedData.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThanOrEqual(7.1);
    });

    it("should issue token pair with non-persistent flag and 24-hour TTL", async () => {
      const { issueTokenPair } = await import("./auth.token-utils");
      let savedData: any = null;
      const mockRepo = {
        saveRefreshToken: async (data: any) => {
          savedData = data;
          return {} as any;
        },
      };

      const result = await issueTokenPair(mockRepo, {
        userId: "user-2",
        subject: "sub-2",
        role: "worker",
        email: "worker@cima.co",
        userAgent: "TestAgent",
        isPersistent: false,
      });

      expect(result.isPersistent).toBe(false);
      expect(savedData.isPersistent).toBe(false);
      // Non-persistent should expire around 1 day (24h) in the future
      const diffHours = (savedData.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23.9);
      expect(diffHours).toBeLessThanOrEqual(24.1);
    });
  });
});
