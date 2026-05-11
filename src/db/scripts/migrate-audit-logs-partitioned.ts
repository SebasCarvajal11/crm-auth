/**
 * Migración única: convierte `schema_auth.audit_logs` (tabla normal) en tabla
 * particionada por mes (RANGE `created_at`). Hacer backup antes en producción.
 *
 * Uso: npx tsx src/db/scripts/migrate-audit-logs-partitioned.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import { env } from "../../config/env";
import {
  assertSafePartitionName,
  enumerateUtcMonths,
  sliceForUtcMonth,
  utcMonthStart,
  type MonthSlice,
} from "./audit-partition-utils";

async function relKind(
  client: Pick<Pool, "query">,
  schema: string,
  table: string
): Promise<string | null> {
  const r = await client.query<{ relkind: string }>(
    `SELECT c.relkind
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, table]
  );
  return r.rows[0]?.relkind ?? null;
}

async function main() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const kind = await relKind(client, "schema_auth", "audit_logs");
    if (!kind) {
      console.error(
        "No existe schema_auth.audit_logs. Genera el esquema (p. ej. drizzle-kit push) antes."
      );
      process.exitCode = 1;
      return;
    }
    if (kind === "p") {
      console.log("audit_logs ya es tabla particionada (padre). No hay nada que hacer.");
      return;
    }

    await client.query("BEGIN");

    await client.query(
      `ALTER TABLE schema_auth.audit_logs RENAME TO audit_logs_legacy`
    );

    await client.query(`
      CREATE TABLE schema_auth.audit_logs (
        id BIGSERIAL NOT NULL,
        user_id UUID,
        action VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        details JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at)
    `);

    const bounds = await client.query<{ min: Date | null; max: Date | null }>(
      `SELECT MIN(created_at) AS min, MAX(created_at) AS max FROM schema_auth.audit_logs_legacy`
    );
    const row = bounds.rows[0];

    const now = new Date();
    let slices: MonthSlice[];
    if (!row?.min || !row?.max) {
      slices = [
        sliceForUtcMonth(utcMonthStart(now.getUTCFullYear(), now.getUTCMonth())),
        sliceForUtcMonth(utcMonthStart(now.getUTCFullYear(), now.getUTCMonth() + 1)),
        sliceForUtcMonth(utcMonthStart(now.getUTCFullYear(), now.getUTCMonth() + 2)),
      ];
    } else {
      const minD = new Date(row.min);
      const maxD = new Date(row.max);
      slices = enumerateUtcMonths(minD, maxD);
      const futureEnd = utcMonthStart(maxD.getUTCFullYear(), maxD.getUTCMonth() + 3);
      const futureStart = utcMonthStart(maxD.getUTCFullYear(), maxD.getUTCMonth() + 1);
      slices.push(...enumerateUtcMonths(futureStart, futureEnd));
    }

    const seen = new Set<string>();
    const uniqueSlices = slices.filter((s) => {
      if (seen.has(s.partitionName)) return false;
      seen.add(s.partitionName);
      return true;
    });

    for (const s of uniqueSlices) {
      assertSafePartitionName(s.partitionName);
      await client.query(`
        CREATE TABLE schema_auth.${s.partitionName}
        PARTITION OF schema_auth.audit_logs
        FOR VALUES FROM ('${s.fromInclusive}'::timestamp)
        TO ('${s.toExclusive}'::timestamp)
      `);
    }

    await client.query(`
      INSERT INTO schema_auth.audit_logs (id, user_id, action, ip_address, user_agent, details, created_at)
      SELECT id, user_id, action, ip_address, user_agent, details, created_at
      FROM schema_auth.audit_logs_legacy
    `);

    await client.query(`DROP TABLE schema_auth.audit_logs_legacy`);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('schema_auth.audit_logs', 'id'),
        COALESCE((SELECT MAX(id) FROM schema_auth.audit_logs), 1),
        true
      )
    `);

    await client.query("COMMIT");
    console.log("✓ Migración audit_logs → particionada por mes completada.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Migración fallida (ROLLBACK aplicado):", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
