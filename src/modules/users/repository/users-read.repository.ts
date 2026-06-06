import type { DbOrTx } from "../users.repository";
import { and, eq, ilike, isNull } from "drizzle-orm";
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
});
