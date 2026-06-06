import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const dbSchema = process.env.DB_SCHEMA;
if (dbSchema !== 'schema_auth') {
  throw new Error('DB_SCHEMA debe ser schema_auth para crm-auth');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL es requerida para crm-auth');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  schemaFilter: [dbSchema],
  migrations: {
    schema: dbSchema,
  },
});
