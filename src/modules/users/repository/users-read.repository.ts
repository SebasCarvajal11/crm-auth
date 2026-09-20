import type { DbOrTx } from "../users.repository";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { users } from "../../../db/schema";

export const createUsersReadRepository = (conn: DbOrTx) => ({
  findByEmail: async (email: string) => {
    const [user] = await conn
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  findByEmailIncludingDeleted: async (email: string) => {
    const [user] = await conn.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  },

  findById: async (id: string) => {
    const [user] = await conn
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  /** Campos expuestos por GET /identity/me (alineado con allow list del gateway). */
  findIdentityMeById: async (id: string) => {
    const [user] = await conn
      .select({
        subject: users.subject,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
        clientKind: users.clientKind,
        companyName: users.companyName,
        profession: users.profession,
        emailVerifiedAt: users.emailVerifiedAt,
        forcePasswordChange: users.forcePasswordChange,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  findBySubject: async (subject: string) => {
    const [user] = await conn
      .select()
      .from(users)
      .where(and(eq(users.subject, subject), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  findBySubjectIncludingDeleted: async (subject: string) => {
    const [user] = await conn.select().from(users).where(eq(users.subject, subject)).limit(1);
    return user ?? null;
  },

  /** Búsqueda ligera de usuarios por email (prefijo) y rol. Máximo 20 resultados activos. */
  searchActiveByEmailAndRole: async (
    q: string,
    role: "admin" | "worker" | "client",
    limit = 15
  ) => {
    return conn
      .select({
        subject: users.subject,
        email:   users.email,
        role:    users.role,
        firstName: users.firstName,
        lastName: users.lastName,
        clientKind: users.clientKind,
        companyName: users.companyName,
        profession: users.profession,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.role, role),
          ilike(users.email, `%${q}%`)
        )
      )
      .orderBy(users.email)
      .limit(limit);
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

