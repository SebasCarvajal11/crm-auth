/**
 * Idempotente — útil en cron (mensual) si el API no se reinicia con frecuencia.
 * La API también llama `ensureAuditLogPartitions` al arrancar.
 */
import { pool } from "../connection";
import { ensureAuditLogPartitions } from "./ensure-audit-log-partitions";

await ensureAuditLogPartitions(pool);
await pool.end();
