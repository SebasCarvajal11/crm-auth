/**
 * Borra usuarios y datos de invitación de prueba para que `npm test` (Hurl)
 * sea repetible con emails fijos. Conserva solo admin@cima.dev.
 */
import "dotenv/config";
import { ne } from "drizzle-orm";
import { db } from "../db/connection";
import { invitations, users } from "../db/schema";

const KEEP_EMAIL = "admin@cima.dev";

async function main() {
  await db.delete(invitations);
  await db.delete(users).where(ne(users.email, KEEP_EMAIL));
  process.exit(0);
}

main().catch((err) => {
  console.error("[reset-test-users]", err);
  process.exit(1);
});
