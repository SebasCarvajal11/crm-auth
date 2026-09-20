import type { DbOrTx } from "../users.repository";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { users } from "../../../db/schema";
import type { NewUser, UserPatch } from "../users.types";
import { UserEntity } from "../domain/user.entity";

export const createUsersWriteRepository = (conn: DbOrTx) => ({
  createUser: async (userData: NewUser) => {
    const entity = UserEntity.create(userData);
    const [user] = await conn.insert(users).values(entity.toPersistence()).returning();
    return user;
  },

  updateUserById: async (id: string, data: UserPatch) => {
    const [existing] = await conn
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!existing) return null;

    const entity = UserEntity.fromPersistence(existing);
    const updatedEntity = entity.update(data);

    const [user] = await conn
      .update(users)
      .set(updatedEntity.toPersistence())
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  },

  markSuccessfulLogin: async (userId: string) => {
    await conn
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  },

  clearExpiredAccountLock: async (userId: string) => {
    await conn
      .update(users)
      .set({
        lockedUntil: null,
        failedLoginAttempts: 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, userId),
          isNotNull(users.lockedUntil),
          lte(users.lockedUntil, new Date())
        )
      );
  },

  recordFailedLoginAttempt: async (
    userId: string,
    maxAttempts: number,
    lockoutMs: number
  ) => {
    const [current] = await conn
      .select({ n: users.failedLoginAttempts })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const next = (current?.n ?? 0) + 1;
    const lockedUntil =
      next >= maxAttempts ? new Date(Date.now() + lockoutMs) : undefined;
    await conn
      .update(users)
      .set({
        failedLoginAttempts: next,
        ...(lockedUntil !== undefined ? { lockedUntil } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return { attempts: next, lockedUntil: lockedUntil ?? null };
  },
});

