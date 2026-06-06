import type { Context } from "hono";
import type { AdminUserService } from "../auth/auth.service";
import type { AppEnv } from "../../shared/middlewares/auth.middleware";
import { validatedJson, validatedQuery } from "../auth/validated-json";
import type {
  AdminListUsersQuery,
  AdminPatchUserFlagsBody,
  AdminPatchUserStatusBody,
  SearchUsersQuery,
} from "./users.schemas";

const getIp = (c: Context) =>
  c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";

const getUa = (c: Context) => c.req.header("user-agent") ?? "unknown";

export const createUsersAdminController = (adminUserService: AdminUserService) => ({
  search: async (c: Context<AppEnv>) => {
    const q = validatedQuery<SearchUsersQuery>(c);
    const results = await adminUserService.searchUsersByEmail(q.q, q.role);
    return c.json({ data: results }, 200);
  },

  list: async (c: Context<AppEnv>) => {
    const q = validatedQuery<AdminListUsersQuery>(c);
    const result = await adminUserService.adminListUsers(
      q.page,
      q.limit,
      q.role,
      q.include_deleted,
      q.q,
    );

    return c.json({ data: result }, 200);
  },

  patchStatus: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const body = validatedJson<AdminPatchUserStatusBody>(c);
    const user = c.get("user");

    await adminUserService.adminSetUserActiveBySubject(
      user.sub,
      user.userId,
      subject,
      body.is_active,
      getIp(c),
      getUa(c),
    );

    return c.json({ message: "Usuario actualizado correctamente" }, 200);
  },

  patchFlags: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const body = validatedJson<AdminPatchUserFlagsBody>(c);
    const user = c.get("user");

    await adminUserService.adminSetForcePasswordChangeBySubject(
      user.userId,
      subject,
      body.force_password_change,
      getIp(c),
      getUa(c),
    );

    return c.json({ message: "Politicas del usuario actualizadas correctamente" }, 200);
  },

  softDelete: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const user = c.get("user");

    await adminUserService.adminSoftDeleteBySubject(
      user.sub,
      user.userId,
      subject,
      getIp(c),
      getUa(c),
    );

    return c.json({ message: "Usuario archivado correctamente" }, 200);
  },

  restore: async (c: Context<AppEnv>) => {
    const subject = c.req.param("subject") ?? "";
    const user = c.get("user");

    await adminUserService.adminRestoreUserBySubject(
      user.userId,
      subject,
      getIp(c),
      getUa(c),
    );

    return c.json({ message: "Usuario restaurado correctamente" }, 200);
  },
});
