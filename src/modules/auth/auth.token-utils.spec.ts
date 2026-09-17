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
});
