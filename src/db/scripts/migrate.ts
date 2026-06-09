import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { pgConnectionConfig } from "../pg-config";
import { env } from "../../config/env";
import { getLogger } from "../../shared/logger";

const logger = getLogger();

async function main() {
  logger.info("[db-migrate] Iniciando migraciones de crm-auth...");
  const pool = new pg.Pool(pgConnectionConfig);
  const db = drizzle(pool);

  try {
    await migrate(db, {
      migrationsFolder: "./drizzle",
      migrationsSchema: env.DB_SCHEMA,
    });
    logger.info("[db-migrate] Migraciones de crm-auth completadas con exito");
  } catch (err) {
    logger.error({ err }, "[db-migrate] Error ejecutando migraciones de crm-auth");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  logger.error({ err }, "[db-migrate] Error critico en main");
  process.exit(1);
});
