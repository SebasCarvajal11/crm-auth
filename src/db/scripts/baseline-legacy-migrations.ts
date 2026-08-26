import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { PoolClient } from "pg";
import { pool } from "../connection";

type JournalEntry = {
  tag: string;
  when: number;
};

type MigrationJournal = {
  entries: JournalEntry[];
};

const schema = "schema_auth";
const migrationTable = `${schema}.__drizzle_migrations`;
const baselineThrough = "0003_workable_scarecrow";
const requiredRelations = [
  "audit_logs",
  "email_verifications",
  "identity_outbox",
  "invitations",
  "password_resets",
  "refresh_tokens",
  "schema_version",
  "users",
] as const;

function readJournal(): MigrationJournal {
  const journalPath = resolve(process.cwd(), "drizzle/meta/_journal.json");
  return JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;
}

function migrationHash(tag: string): string {
  const sqlPath = resolve(process.cwd(), "drizzle", `${tag}.sql`);
  return createHash("sha256").update(readFileSync(sqlPath, "utf8")).digest("hex");
}

async function hasLegacySchema(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ relation: string }>(
    `
      SELECT relation
      FROM unnest($1::text[]) AS relation
      WHERE to_regclass(relation) IS NULL
    `,
    [requiredRelations.map((relation) => `${schema}.${relation}`)],
  );

  return result.rows.length === 0;
}

async function baselineLegacyMigrations() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${schema}:drizzle-migration-baseline`,
    ]);

    if (!(await hasLegacySchema(client))) {
      await client.query("ROLLBACK");
      console.log("No se detectó un esquema legado completo; Drizzle aplicará la historia íntegra.");
      return;
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationTable} (
        id serial PRIMARY KEY NOT NULL,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const existing = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${migrationTable}`,
    );
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      await client.query("COMMIT");
      console.log("El historial de migraciones ya está inicializado.");
      return;
    }

    const entries = readJournal().entries;
    const boundary = entries.findIndex(({ tag }) => tag === baselineThrough);
    if (boundary < 0) {
      throw new Error(`No se encontró la migración de baseline ${baselineThrough}`);
    }

    for (const entry of entries.slice(0, boundary + 1)) {
      await client.query(
        `INSERT INTO ${migrationTable} (hash, created_at) VALUES ($1, $2)`,
        [migrationHash(entry.tag), entry.when],
      );
    }

    await client.query("COMMIT");
    console.log(`Baseline legado completado hasta ${baselineThrough}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

baselineLegacyMigrations()
  .catch((error) => {
    console.error("No se pudo inicializar el baseline de migraciones:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
