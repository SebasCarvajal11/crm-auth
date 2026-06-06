import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  requireRole,
  type AppEnv,
} from "../../shared/middlewares/auth.middleware";
import { type AdminUserService } from "../auth/auth.service";
import { createUsersAdminController } from "./users.controller";
import {
  AdminListUsersQuerySchema,
  AdminPatchUserFlagsSchema,
  AdminPatchUserStatusSchema,
  AdminUserSubjectParamSchema,
  SearchUsersQuerySchema,
} from "./users.schemas";

export const createUsersAdminRoutes = (adminUserService: AdminUserService) => {
  const controller = createUsersAdminController(adminUserService);
  const usersAdminRoutes = new Hono<AppEnv>();

  usersAdminRoutes.get(
    "/search",
    authMiddleware,
    requireRole("admin", "worker"),
    zValidator("query", SearchUsersQuerySchema),
    controller.search,
  );

  usersAdminRoutes.get(
    "/",
    authMiddleware,
    requireRole("admin"),
    zValidator("query", AdminListUsersQuerySchema),
    controller.list,
  );

  usersAdminRoutes.patch(
    "/:subject/status",
    authMiddleware,
    requireRole("admin"),
    zValidator("param", AdminUserSubjectParamSchema),
    zValidator("json", AdminPatchUserStatusSchema),
    controller.patchStatus,
  );

  usersAdminRoutes.patch(
    "/:subject/flags",
    authMiddleware,
    requireRole("admin"),
    zValidator("param", AdminUserSubjectParamSchema),
    zValidator("json", AdminPatchUserFlagsSchema),
    controller.patchFlags,
  );

  usersAdminRoutes.post(
    "/:subject/restore",
    authMiddleware,
    requireRole("admin"),
    zValidator("param", AdminUserSubjectParamSchema),
    controller.restore,
  );

  usersAdminRoutes.delete(
    "/:subject",
    authMiddleware,
    requireRole("admin"),
    zValidator("param", AdminUserSubjectParamSchema),
    controller.softDelete,
  );

  return usersAdminRoutes;
};
