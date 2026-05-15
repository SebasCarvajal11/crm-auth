import type { DbOrTx } from "../users.repository";
import { and, desc, eq, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { users } from "../../../db/schema";
import type { NewUser, UserPatch } from "../users.types";

export const createUsersWriteRepository = (conn: DbOrTx) => ({
  createUser: async (userData: NewUser) => {
    const [user] = await conn.insert(users).values(userData).returning();
    return user;
  },

  updateUserById: async (id: string, data: UserPatch) => {
    const [user] = await conn
      .update(users)
      .set({ ...data, updatedAt: new Date() })
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

  listUsersPaginated: async (opts: {
    page: number;
    limit: number;
    role?: "admin" | "worker" | "client";
    includeDeleted?: boolean;
    q?: string;
  }) => {
    const offset = (opts.page - 1) * opts.limit;

    const selection = {
      subject: users.subject,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      clientKind: users.clientKind,
      companyName: users.companyName,
      profession: users.profession,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
      deletedAt: users.deletedAt,
      forcePasswordChange: users.forcePasswordChange,
      createdAt: users.createdAt,
    };

    const conditions = [];
    if (!opts.includeDeleted) conditions.push(isNull(users.deletedAt));
    if (opts.role) conditions.push(eq(users.role, opts.role));
    if (opts.q?.trim()) {
      const needle = `%${opts.q.trim()}%`;
      conditions.push(
        or(
          ilike(users.email, needle),
          ilike(users.firstName, needle),
          ilike(users.lastName, needle),
          ilike(users.companyName, needle)
        )
      );
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const countBase = conn.select({ count: sql<number>`cast(count(*) as int)` }).from(users);
    const [countRow] = whereClause
      ? await countBase.where(whereClause)
      : await countBase;

    const rowsBase = conn.select(selection).from(users).orderBy(desc(users.createdAt));
    const rows = whereClause
      ? await rowsBase.where(whereClause).limit(opts.limit).offset(offset)
      : await rowsBase.limit(opts.limit).offset(offset);

    return { rows, total: countRow?.count ?? 0 };
  },
});
