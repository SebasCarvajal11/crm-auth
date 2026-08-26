import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Pool, type PoolClient } from "pg";

type JournalEntry = { tag: string; when: number };
type MigrationJournal = { entries: JournalEntry[] };

const schema = "schema_auth";
const migrationTable = `${schema}.__drizzle_migrations`;
const initialMigration = "0000_reflective_steve_rogers";
const identityOutboxMigration = "0001_identity_outbox";
const invitationMigration = "0002_medical_lila_cheney";
const auditMigration = "0003_workable_scarecrow";
const initialRelations = ["audit_logs", "email_verifications", "invitations", "password_resets", "refresh_tokens", "users"] as const;

function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL es requerida para inicializar el baseline de migraciones");
  if (process.env.DB_SCHEMA !== schema) throw new Error(`DB_SCHEMA debe ser ${schema} para inicializar el baseline de migraciones`);
  return { connectionString, options: `-c search_path=${schema}` };
}

function readJournal(): MigrationJournal {
  return JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as MigrationJournal;
}

function migrationHash(tag: string): string {
  return createHash("sha256").update(readFileSync(resolve(process.cwd(), "drizzle", `${tag}.sql`), "utf8")).digest("hex");
}

async function relationExists(client: PoolClient, relation: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [`${schema}.${relation}`]);
  return result.rows[0]?.exists === true;
}

async function columnExists(client: PoolClient, table: string, column: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3) AS exists",
    [schema, table, column],
  );
  return result.rows[0]?.exists === true;
}

/** Infers only a contiguous prefix, never skipping DDL in a partially upgraded legacy schema. */
async function inferLegacyPrefix(client: PoolClient): Promise<string[]> {
  if (!(await Promise.all(initialRelations.map((relation) => relationExists(client, relation)))).every(Boolean)) return [];

  const prefix = [initialMigration];
  const identityOutboxExists = await relationExists(client, "identity_outbox");
  const invitationRoleExists = await columnExists(client, "invitations", "role");
  const invitationProfessionExists = await columnExists(client, "invitations", "profession");
  if (invitationRoleExists !== invitationProfessionExists) {
    throw new Error("El esquema legado tiene una migración de invitaciones incompleta; requiere revisión manual");
  }
  if (!identityOutboxExists && invitationRoleExists) {
    throw new Error("El esquema legado no representa un prefijo de migraciones válido; requiere revisión manual");
  }
  if (!identityOutboxExists) return prefix;

  prefix.push(identityOutboxMigration);
  if (!invitationRoleExists) return prefix;

  prefix.push(invitationMigration);
  const auditSignals = await Promise.all([
    relationExists(client, "schema_version"),
    columnExists(client, "audit_logs", "actor_sub"),
    columnExists(client, "audit_logs", "actor_email"),
    columnExists(client, "audit_logs", "actor_role"),
    columnExists(client, "audit_logs", "resource_type"),
    columnExists(client, "audit_logs", "resource_id"),
    columnExists(client, "audit_logs", "correlation_id"),
  ]);
  if (auditSignals.every(Boolean)) prefix.push(auditMigration);
  else if (auditSignals.some(Boolean)) throw new Error("El esquema legado tiene una migración de auditoría incompleta; requiere revisión manual");
  return prefix;
}

async function baselineLegacyMigrations() {
  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${schema}:drizzle-migration-baseline`]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${migrationTable} (id serial PRIMARY KEY NOT NULL, hash text NOT NULL, created_at bigint)`);
    const existing = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${migrationTable}`);
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      await client.query("COMMIT");
      console.log("El historial de migraciones ya está inicializado.");
      return;
    }

    const prefix = await inferLegacyPrefix(client);
    if (prefix.length === 0) {
      await client.query("COMMIT");
      console.log("No se detectó un esquema legado compatible; Drizzle aplicará la historia íntegra.");
      return;
    }
    const journalByTag = new Map(readJournal().entries.map((entry) => [entry.tag, entry]));
    for (const tag of prefix) {
      const entry = journalByTag.get(tag);
      if (!entry) throw new Error(`No se encontró la migración de baseline ${tag}`);
      await client.query(`INSERT INTO ${migrationTable} (hash, created_at) VALUES ($1, $2)`, [migrationHash(tag), entry.when]);
    }
    await client.query("COMMIT");
    console.log(`Baseline legado completado hasta ${prefix.at(-1)}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

baselineLegacyMigrations().catch((error) => {
  console.error("No se pudo inicializar el baseline de migraciones:", error);
  process.exitCode = 1;
});
