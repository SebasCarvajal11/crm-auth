/**
 * Reinicia el estado minimo de auth para que `pnpm test` (Hurl) sea repetible.
 * Conserva un admin conocido y elimina el resto de usuarios/datos efimeros.
 */
import "dotenv/config";
import { hash } from "bcrypt";
import { eq, ne } from "drizzle-orm";
import { db } from "../db/connection";
import {
  emailVerifications,
  invitations,
  passwordResets,
  refreshTokens,
  users,
} from "../db/schema";
import { getRedisConnection } from "../shared/redis";

const ADMIN_EMAIL = "admin@cima.dev";
const ADMIN_PASSWORD = "Admin123!";

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
  await ensureAdmin();

  await db.delete(invitations);
  await db.delete(passwordResets);
  await db.delete(emailVerifications);

  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
  if (!admin) {
    throw new Error("No se pudo garantizar el admin base de pruebas.");
  }

  await db.delete(refreshTokens).where(ne(refreshTokens.userId, admin.id));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, admin.id));
  await db.delete(users).where(ne(users.email, ADMIN_EMAIL));

  const redis = getRedisConnection();
  if (redis) {
    const keys = await redis.keys("ratelimit:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[reset-test-users]", err);
  process.exit(1);
});
