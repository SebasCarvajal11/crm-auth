import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import * as schema from "../../src/db/schema";
import { createPresenceRepository } from "../../src/modules/presence/presence.repository";
import { PresenceQuerySchema } from "../../src/modules/presence/presence.schemas";

// Explicit opt-in and localhost guard: never infer a production URL from dotenv.
const url = process.env.PRESENCE_TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("PRESENCE_TEST_DATABASE_URL debe apuntar a PostgreSQL local de pruebas");
}
const pool = new Pool({ connectionString: url });
let client: PoolClient;
let repository: ReturnType<typeof createPresenceRepository>;
let requesterId: string;
let workerId: string;
let tag: string;
const query = () => PresenceQuerySchema.parse({ q: tag });

describe("presence repository against PostgreSQL", () => {
  beforeEach(async () => {
    client = await pool.connect();
    await client.query("BEGIN");
    repository = createPresenceRepository(drizzle(client, { schema }));
    tag = `presence-${randomUUID()}`;
    const create = async (role: "admin" | "worker" | "client", n: number, seconds: number, active = true) => {
      const id = randomUUID();
      await client.query(`INSERT INTO schema_auth.users (id, subject, email, password_hash, role, first_name, last_name, company_name, is_active, last_login_at)
        VALUES ($1, $2, $3, 'unused-test-hash', $4, 'Ana María', 'Pérez', $5, $6, timestamp '2026-09-28 12:34:56.123456')`, [id, randomUUID(), `${tag}-${n}@hurl.test`, role, tag, active]);
      await client.query("INSERT INTO schema_auth.user_presence (user_id, last_seen_at) VALUES ($1, now() - $2 * interval '1 second')", [id, seconds]);
      await client.query("INSERT INTO schema_auth.refresh_tokens (id, user_id, token_hash, family, expires_at) VALUES ($1, $2, $3, $4, now() + interval '1 day')", [randomUUID(), id, randomUUID(), randomUUID()]);
      return id;
    };
    requesterId = await create("admin", 100, 0);
    workerId = await create("worker", 0, 0);
    for (let n = 1; n < 14; n++) await create("worker", n, n < 7 ? n : 200 + n);
    await create("client", 50, 1000);
    await create("admin", 60, 0);
    await create("worker", 80, 0, false);
    await create("worker", 81, 8 * 86400);
  });
  afterEach(async () => { await client.query("ROLLBACK"); client.release(); });
  afterAll(async () => { await pool.end(); });

  it.each(["UTC", "America/Bogota", "Asia/Kolkata"])("returns unambiguous ISO timestamps preserving the UTC login instant in %s", async (timezone) => {
    await client.query("SELECT set_config('TimeZone', $1, true)", [timezone]);
    const snapshot = await repository.list(query(), requesterId);
    const datetime = z.iso.datetime({ offset: true });
    expect(datetime.safeParse(snapshot.as_of).success).toBe(true);
    for (const user of snapshot.groups.flatMap((group) => group.users)) {
      expect(datetime.safeParse(user.last_activity_at).success).toBe(true);
      expect(datetime.safeParse(user.last_connection_at).success).toBe(true);
      expect(new Date(user.last_connection_at!).toISOString()).toBe("2026-09-28T12:34:56.123Z");
    }
  });
  it("preserves a missing login timestamp as null", async () => {
    await client.query("UPDATE schema_auth.users SET last_login_at = NULL WHERE id = $1", [workerId]);
    const { rows } = await client.query("SELECT subject FROM schema_auth.users WHERE id = $1", [workerId]);
    const snapshot = await repository.list(query(), requesterId);
    expect(snapshot.groups[0].users.find((user) => user.subject === rows[0].subject)?.last_connection_at).toBeNull();
  });

  it("bounds each profile independently, orders online first and excludes self/inactive/old observations", async () => {
    const snapshot = await repository.list(query(), requesterId);
    expect(Number.isFinite(Date.parse(snapshot.as_of))).toBe(true);
    expect(snapshot.groups.map((group) => group.role)).toEqual(["worker", "client", "admin"]);
    expect(snapshot.groups[0]).toMatchObject({ total: 14, online: 7, page_size: 10, page: 1 });
    expect(snapshot.groups[0].users).toHaveLength(10);
    expect(snapshot.groups[0].users.slice(0, 7).every((user) => user.is_online)).toBe(true);
    expect(snapshot.groups[1]).toMatchObject({ total: 1, online: 0 });
    expect(snapshot.groups[2]).toMatchObject({ total: 1, online: 1 });
    expect(snapshot.groups.flatMap((group) => group.users).some((user) => "password_hash" in user || "family" in user)).toBe(false);
  });
  it("paginates independently and clamps pages when users disappear", async () => {
    const snapshot = await repository.list({ ...query(), worker_page: 999 }, requesterId);
    expect(snapshot.groups[0]).toMatchObject({ page: 2, total: 14 });
    expect(snapshot.groups[0].users).toHaveLength(4);
    expect(snapshot.groups[1].page).toBe(1);
  });
  it("supports full names and literal search without wildcard expansion", async () => {
    const name = await repository.list({ ...query(), q: "Ana María Pérez" }, requesterId);
    expect(name.groups[0].total).toBeGreaterThanOrEqual(14);
    for (const q of ["%", "_", "\\", "' OR true --"]) {
      const result = await repository.list({ ...query(), q: `${tag}${q}` }, requesterId);
      expect(result.groups.every((group) => group.total === 0)).toBe(true);
    }
  });
  it("throttles repeated observations atomically without rejecting valid sessions", async () => {
    const before = await client.query("SELECT last_seen_at FROM schema_auth.user_presence WHERE user_id = $1", [workerId]);
    expect(await repository.observe(workerId)).toBe(true);
    expect(await repository.observe(workerId)).toBe(true);
    const after = await client.query("SELECT last_seen_at FROM schema_auth.user_presence WHERE user_id = $1", [workerId]);
    expect(after.rows[0].last_seen_at).toEqual(before.rows[0].last_seen_at);
    await client.query("UPDATE schema_auth.user_presence SET last_seen_at = now() - interval '1 minute' WHERE user_id = $1", [workerId]);
    expect(await repository.observe(workerId)).toBe(true);
    const updated = await repository.list(query(), requesterId);
    expect(updated.groups[0].users.some((user) => user.is_online)).toBe(true);
  });
  it("expires at the precise cutoff and preserves last activity without requiring cleanup jobs", async () => {
    await client.query("UPDATE schema_auth.user_presence SET last_seen_at = now() - interval '150 seconds' WHERE user_id = $1", [workerId]);
    const snapshot = await repository.list(query(), requesterId);
    expect(snapshot.groups[0].online).toBe(6);
  });
  it("revoking all sessions prevents observation and immediately removes online status", async () => {
    await client.query("UPDATE schema_auth.refresh_tokens SET is_revoked = true WHERE user_id = $1", [workerId]);
    expect(await repository.observe(workerId)).toBe(false);
    expect((await repository.list(query(), requesterId)).groups[0].online).toBe(6);
    expect(await repository.observe(randomUUID())).toBe(false);
  });
  it("rechecks administrator authorization after role changes and suspension", async () => {
    expect(await repository.canView(requesterId)).toBe(true);
    await client.query("UPDATE schema_auth.users SET role = 'worker' WHERE id = $1", [requesterId]);
    expect(await repository.canView(requesterId)).toBe(false);
    await client.query("UPDATE schema_auth.users SET role = 'admin', is_active = false WHERE id = $1", [requesterId]);
    expect(await repository.canView(requesterId)).toBe(false);
  });
});
