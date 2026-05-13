import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  requireRole,
  type AppEnv,
} from "../../shared/middlewares/auth.middleware";
import { authService } from "../auth/auth.routes";
import { createUsersAdminController } from "./users.controller";
import {
  AdminListUsersQuerySchema,
  AdminPatchUserFlagsSchema,
  AdminPatchUserStatusSchema,
  AdminUserSubjectParamSchema,
  BySubjectsQuerySchema,
  SearchUsersQuerySchema,
} from "./users.schemas";

const controller = createUsersAdminController(authService);

export const usersAdminRoutes = new Hono<AppEnv>();

/** Búsqueda ligera de usuarios por email — accesible a admin y worker (no cliente). */
usersAdminRoutes.get(
  "/search",
  authMiddleware,
  requireRole("admin", "worker"),
  zValidator("query", SearchUsersQuerySchema),
  controller.search
);

/** Busca usuarios por lista de subjects (UUIDs) — para enriquecimiento batch. */
usersAdminRoutes.get(
  "/by-subjects",
  authMiddleware,
  requireRole("admin", "worker"),
  zValidator("query", BySubjectsQuerySchema),
  controller.bySubjects
);

usersAdminRoutes.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  zValidator("query", AdminListUsersQuerySchema),
  controller.list
);

usersAdminRoutes.patch(
  "/:subject/status",
  authMiddleware,
  requireRole("admin"),
  zValidator("param", AdminUserSubjectParamSchema),
  zValidator("json", AdminPatchUserStatusSchema),
  controller.patchStatus
);

usersAdminRoutes.patch(
  "/:subject/flags",
  authMiddleware,
  requireRole("admin"),
  zValidator("param", AdminUserSubjectParamSchema),
  zValidator("json", AdminPatchUserFlagsSchema),
  controller.patchFlags
);

usersAdminRoutes.post(
  "/:subject/restore",
  authMiddleware,
  requireRole("admin"),
  zValidator("param", AdminUserSubjectParamSchema),
  controller.restore
);

usersAdminRoutes.delete(
  "/:subject",
  authMiddleware,
  requireRole("admin"),
  zValidator("param", AdminUserSubjectParamSchema),
  controller.softDelete
);
