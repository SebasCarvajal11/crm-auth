import { z } from "zod";
import { RoleEnum } from "../auth/auth.schemas";

export const AdminListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: RoleEnum.optional(),
  /** Si es true, incluye usuarios con soft-delete (`deleted_at`). */
  include_deleted: z.coerce.boolean().optional().default(false),
});

export const AdminPatchUserStatusSchema = z.object({
  is_active: z.boolean(),
});

export const AdminUserSubjectParamSchema = z.object({
  subject: z.string().uuid(),
});

/** Políticas editables por soporte (sin pasar por cambio de contraseña del usuario). */
export const AdminPatchUserFlagsSchema = z.object({
  force_password_change: z.boolean(),
});

export const SearchUsersQuerySchema = z.object({
  q:    z.string().min(1).max(100),
  role: RoleEnum.default("client"),
});

export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuerySchema>;
export type AdminPatchUserStatusBody = z.infer<typeof AdminPatchUserStatusSchema>;
export type AdminPatchUserFlagsBody = z.infer<typeof AdminPatchUserFlagsSchema>;
export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;
