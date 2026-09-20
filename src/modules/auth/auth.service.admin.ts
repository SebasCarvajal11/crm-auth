import type {
  AdminUserListRow,
  UserPublicProfileRow,
} from "../users/users.repository";
import type { AdminUserRepository } from "./ports/auth-repositories.port";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../shared/middlewares/error-handler.middleware";

export interface AdminAuditContext {
  adminUserId: string;
  adminSubject?: string;
  ip: string;
  userAgent: string;
}

export interface SetUserActiveParams {
  targetSubject: string;
  isActive: boolean;
}

export interface SetForcePasswordChangeParams {
  targetSubject: string;
  forcePasswordChange: boolean;
}

export const createAdminUserService = (repo: AdminUserRepository) => ({
  searchUsersByEmail: async (
    q: string,
    role: "admin" | "worker" | "client" = "client"
  ) => {
    const rows = await repo.searchActiveByEmailAndRole(q, role);
    return rows.map((u: UserPublicProfileRow) => ({
      subject: u.subject,
      email: u.email,
      role: u.role,
      first_name: u.firstName,
      last_name: u.lastName,
      client_kind: u.clientKind,
      company_name: u.companyName,
      profession: u.profession,
    }));
  },

  adminListUsers: async (
    page: number,
    limit: number,
    role?: "admin" | "worker" | "client",
    includeDeleted?: boolean,
    q?: string
  ) => {
    const { rows, total } = await repo.listUsersPaginated({
      page,
      limit,
      role,
      includeDeleted: includeDeleted ?? false,
      q,
    });
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return {
      items: rows.map((u: AdminUserListRow) => ({
        id: u.subject,
        email: u.email,
        role: u.role,
        first_name: u.firstName,
        last_name: u.lastName,
        client_kind: u.clientKind,
        company_name: u.companyName,
        profession: u.profession,
        is_active: u.isActive,
        email_verified_at: u.emailVerifiedAt?.toISOString() ?? null,
        last_login_at: u.lastLoginAt?.toISOString() ?? null,
        locked_until: u.lockedUntil?.toISOString() ?? null,
        deleted_at: u.deletedAt?.toISOString() ?? null,
        force_password_change: u.forcePasswordChange,
        created_at: u.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
      total_pages: totalPages,
    };
  },

  adminSetUserActiveBySubject: async (
    ctx: AdminAuditContext,
    params: SetUserActiveParams
  ) => {
    if (!params.isActive && ctx.adminSubject === params.targetSubject) {
      throw new ForbiddenError("No puedes desactivar tu propia cuenta");
    }

    await repo.transaction(async (tx) => {
      const target = await tx.findBySubjectIncludingDeleted(params.targetSubject);
      if (!target) throw new NotFoundError("Usuario no encontrado");

      if (target.deletedAt && params.isActive) {
        throw new BadRequestError("La cuenta esta archivada; restaurala antes de activarla.");
      }

      const updated = await tx.updateUserById(target.id, { isActive: params.isActive });
      if (!updated) throw new NotFoundError("Usuario no encontrado");

      await tx.createAuditLog(ctx.adminUserId, "admin_user_status_updated", ctx.ip, ctx.userAgent, {
        target_subject: params.targetSubject,
        is_active: params.isActive,
      });
      await tx.createIdentityOutboxEvent("user.updated", updated);

      if (!params.isActive) {
        await tx.revokeAllRefreshTokensForUser(target.id);
      }
    });
  },

  adminSetForcePasswordChangeBySubject: async (
    ctx: AdminAuditContext,
    params: SetForcePasswordChangeParams
  ) => {
    const target = await repo.findBySubjectIncludingDeleted(params.targetSubject);
    if (!target) throw new NotFoundError("Usuario no encontrado");

    await repo.updateUserById(target.id, { forcePasswordChange: params.forcePasswordChange });
    await repo.createAuditLog(ctx.adminUserId, "admin_force_password_change_set", ctx.ip, ctx.userAgent, {
      target_subject: params.targetSubject,
      force_password_change: params.forcePasswordChange,
    });
  },

  adminSoftDeleteBySubject: async (
    ctx: AdminAuditContext,
    targetSubject: string
  ) => {
    if (ctx.adminSubject === targetSubject) {
      throw new ForbiddenError("No puedes archivar tu propia cuenta");
    }

    await repo.transaction(async (tx) => {
      const target = await tx.findBySubjectIncludingDeleted(targetSubject);
      if (!target) throw new NotFoundError("Usuario no encontrado");
      if (target.deletedAt) throw new ConflictError("La cuenta ya esta archivada");

      const updated = await tx.updateUserById(target.id, {
        deletedAt: new Date(),
        isActive: false,
      });
      if (!updated) throw new NotFoundError("Usuario no encontrado");

      await tx.revokeAllRefreshTokensForUser(target.id);
      await tx.createAuditLog(ctx.adminUserId, "user_soft_deleted", ctx.ip, ctx.userAgent, {
        target_subject: targetSubject,
      });
      await tx.createIdentityOutboxEvent("user.deleted", updated);
    });
  },

  adminRestoreUserBySubject: async (
    ctx: AdminAuditContext,
    targetSubject: string
  ) => {
    await repo.transaction(async (tx) => {
      const target = await tx.findBySubjectIncludingDeleted(targetSubject);
      if (!target) throw new NotFoundError("Usuario no encontrado");
      if (!target.deletedAt) throw new ConflictError("La cuenta no esta archivada");

      const updated = await tx.updateUserById(target.id, { deletedAt: null, isActive: true });
      if (!updated) throw new NotFoundError("Usuario no encontrado");

      await tx.createAuditLog(ctx.adminUserId, "user_restored", ctx.ip, ctx.userAgent, {
        target_subject: targetSubject,
      });
      await tx.createIdentityOutboxEvent("user.updated", updated);
    });
  },
});
