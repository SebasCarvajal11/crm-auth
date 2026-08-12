/**
 * Prepara identidades aisladas para que `pnpm test` (Hurl) sea repetible.
 * Solo elimina registros del dominio reservado `hurl.test`; nunca toca datos de desarrollo.
 */
import "dotenv/config";
import { hash } from "bcrypt";
import { like } from "drizzle-orm";
import { db } from "../db/connection";
import {
  invitations,
  users,
} from "../db/schema";

const ADMIN_EMAIL = "auth-admin@hurl.test";
const ADMIN_PASSWORD = "Admin123!";
const TEST_EMAIL_PATTERN = "%@hurl.test";

async function ensureAdmin() {
  const passwordHash = await hash(ADMIN_PASSWORD, 12);

  await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      firstName: "Admin",
      lastName: "CIMA",
      emailVerifiedAt: new Date(),
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordChange: false,
      deletedAt: null,
      lastLoginAt: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash,
        role: "admin",
        firstName: "Admin",
        lastName: "CIMA",
        emailVerifiedAt: new Date(),
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        forcePasswordChange: false,
        deletedAt: null,
        lastLoginAt: null,
        updatedAt: new Date(),
      },
    });
}

async function main() {
  await db.transaction(async (tx) => {
    await tx.delete(invitations).where(like(invitations.email, TEST_EMAIL_PATTERN));
    await tx.delete(users).where(like(users.email, TEST_EMAIL_PATTERN));
  });

  await ensureAdmin();

  process.exit(0);
}

main().catch((err) => {
  console.error("[reset-test-users]", err);
  process.exit(1);
});
