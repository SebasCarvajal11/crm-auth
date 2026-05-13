import { and, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "../../../db/connection";
import { users } from "../../../db/schema";

export const usersReadRepository = {
  findByEmail: async (email: string) => {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  findByEmailIncludingDeleted: async (email: string) => {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  },

  findById: async (id: string) => {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  findBySubject: async (subject: string) => {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.subject, subject), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  findBySubjectIncludingDeleted: async (subject: string) => {
    const [user] = await db.select().from(users).where(eq(users.subject, subject)).limit(1);
    return user ?? null;
  },

  /** Búsqueda ligera de usuarios por email (prefijo) y rol. Máximo 20 resultados activos. */
  searchActiveByEmailAndRole: async (
    q: string,
    role: "admin" | "worker" | "client",
    limit = 15
  ) => {
    return db
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

  /** Busca usuarios activos por lista de subjects (UUIDs). Para enriquecimiento batch. */
  findBySubjects: async (subjects: string[]) => {
    if (!subjects.length) return [];
    return db
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
      .where(and(isNull(users.deletedAt), inArray(users.subject, subjects)));
  },
};
