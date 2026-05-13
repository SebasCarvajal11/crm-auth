import type { Context } from "hono";
import type { AuthService } from "../auth/auth.service";
import type { AppEnv } from "../../shared/middlewares/auth.middleware";
import { validatedJson, validatedQuery } from "../auth/validated-json";
import type {
  AdminListUsersQuery,
  AdminPatchUserFlagsBody,
  AdminPatchUserStatusBody,
  BySubjectsQuery,
  SearchUsersQuery,
} from "./users.schemas";

const getIp = (c: Context) =>
  c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";

const getUa = (c: Context) => c.req.header("user-agent") ?? "unknown";

export const createUsersAdminController = (authService: AuthService) => ({
  /** Búsqueda rápida de usuarios por email — accesible a admin y worker. */
  search: async (c: Context<AppEnv>) => {
    const q = validatedQuery<SearchUsersQuery>(c);
    const results = await authService.searchUsersByEmail(q.q, q.role);
    return c.json({ data: results }, 200);
  },

  /** Busca usuarios por lista de subjects (UUIDs) — para enriquecimiento batch. */
  bySubjects: async (c: Context<AppEnv>) => {
    const q = validatedQuery<BySubjectsQuery>(c);
    const results = await authService.getUsersBySubjects(q.subjects);
    return c.json({ data: results }, 200);
  },

  list: async (c: Context<AppEnv>) => {
    const q = validatedQuery<AdminListUsersQuery>(c);
    const result = await authService.adminListUsers(
      q.page,
      q.limit,
      q.role,
      q.include_deleted
    );

    return c.json({ data: result }, 200);
  },

  patchStatus: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const body = validatedJson<AdminPatchUserStatusBody>(c);
    const user = c.get("user");

    await authService.adminSetUserActiveBySubject(
      user.sub,
      user.userId,
      subject,
      body.is_active,
      getIp(c),
      getUa(c)
    );

    return c.json({ message: "Usuario actualizado correctamente" }, 200);
  },

  patchFlags: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const body = validatedJson<AdminPatchUserFlagsBody>(c);
    const user = c.get("user");

    await authService.adminSetForcePasswordChangeBySubject(
      user.userId,
      subject,
      body.force_password_change,
      getIp(c),
      getUa(c)
    );

    return c.json({ message: "Políticas del usuario actualizadas correctamente" }, 200);
  },

  softDelete: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const user = c.get("user");

    await authService.adminSoftDeleteBySubject(
      user.sub,
      user.userId,
      subject,
      getIp(c),
      getUa(c)
    );

    return c.json({ message: "Usuario archivado correctamente" }, 200);
  },

  restore: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const user = c.get("user");

    await authService.adminRestoreUserBySubject(
      user.userId,
      subject,
      getIp(c),
      getUa(c)
    );

    return c.json({ message: "Usuario restaurado correctamente" }, 200);
  },
});
