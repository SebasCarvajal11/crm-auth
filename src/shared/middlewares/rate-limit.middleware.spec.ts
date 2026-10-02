import { describe, it, expect } from "vitest";
import { getTrustedClientIp } from "@sebascarvajal11/cima-contracts/hono-security-middleware";

describe("getTrustedClientIp (Anti IP Spoofing)", () => {
  it("prioritizes x-real-ip over spoofed x-forwarded-for header", () => {
    const headers = new Map<string, string>([
      ["x-forwarded-for", "1.2.3.4, 5.6.7.8"],
      ["x-real-ip", "203.0.113.195"],
    ]);
    const ip = getTrustedClientIp((h) => headers.get(h));
    expect(ip).toBe("203.0.113.195");
  });

  it("extracts the last hop when only x-forwarded-for is present", () => {
    const headers = new Map<string, string>([
      ["x-forwarded-for", "spoofed-client-ip, 198.51.100.42"],
    ]);
    const ip = getTrustedClientIp((h) => headers.get(h));
    expect(ip).toBe("198.51.100.42");
  });

  it("handles cloudflare connecting IP properly", () => {
    const headers = new Map<string, string>([
      ["cf-connecting-ip", "192.0.2.1"],
      ["x-forwarded-for", "spoofed-ip"],
    ]);
    const ip = getTrustedClientIp((h) => headers.get(h));
    expect(ip).toBe("192.0.2.1");
  });

  it("returns unknown when no IP headers are present", () => {
    const headers = new Map<string, string>();
    const ip = getTrustedClientIp((h) => headers.get(h));
    expect(ip).toBe("unknown");
  });
});
