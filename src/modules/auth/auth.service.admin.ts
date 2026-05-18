import type {
  AdminUserListRow,
  UserPublicProfileRow,
  UsersRepository,
} from "../users/users.repository";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../shared/middlewares/error-handler.middleware";

export const createAdminUserMethods = (repo: UsersRepository) => ({
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

  getUsersBySubjects: async (subjects: string[]) => {
    const rows = await repo.findBySubjects(subjects);
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
    adminSubject: string,
    adminUserId: string,
    targetSubject: string,
    isActive: boolean,
    ip: string,
    userAgent: string
  ) => {
    if (!isActive && adminSubject === targetSubject) {
      throw new ForbiddenError("No puedes desactivar tu propia cuenta");
    }

    const target = await repo.findBySubjectIncludingDeleted(targetSubject);
    if (!target) throw new NotFoundError("Usuario no encontrado");

    if (target.deletedAt && isActive) {
      throw new BadRequestError("La cuenta está archivada; restáurala antes de activarla.");
    }

    await repo.updateUserById(target.id, { isActive });
    await repo.createAuditLog(adminUserId, "admin_user_status_updated", ip, userAgent, {
      target_subject: targetSubject,
      is_active: isActive,
    });

    if (!isActive) {
      await repo.revokeAllRefreshTokensForUser(target.id);
    }
  },

  adminSetForcePasswordChangeBySubject: async (
    adminUserId: string,
    targetSubject: string,
    forcePasswordChange: boolean,
    ip: string,
    userAgent: string
  ) => {
    const target = await repo.findBySubjectIncludingDeleted(targetSubject);
    if (!target) throw new NotFoundError("Usuario no encontrado");

    await repo.updateUserById(target.id, { forcePasswordChange });
    await repo.createAuditLog(adminUserId, "admin_force_password_change_set", ip, userAgent, {
      target_subject: targetSubject,
      force_password_change: forcePasswordChange,
    });
  },

  adminSoftDeleteBySubject: async (
    adminSubject: string,
    adminUserId: string,
    targetSubject: string,
    ip: string,
    userAgent: string
  ) => {
    if (adminSubject === targetSubject) {
      throw new ForbiddenError("No puedes archivar tu propia cuenta");
    }

    const target = await repo.findBySubjectIncludingDeleted(targetSubject);
    if (!target) throw new NotFoundError("Usuario no encontrado");
    if (target.deletedAt) throw new ConflictError("La cuenta ya está archivada");

    await repo.updateUserById(target.id, {
      deletedAt: new Date(),
      isActive: false,
    });
    await repo.revokeAllRefreshTokensForUser(target.id);
    await repo.createAuditLog(adminUserId, "user_soft_deleted", ip, userAgent, {
      target_subject: targetSubject,
    });
  },

  adminRestoreUserBySubject: async (
    adminUserId: string,
    targetSubject: string,
    ip: string,
    userAgent: string
  ) => {
    const target = await repo.findBySubjectIncludingDeleted(targetSubject);
    if (!target) throw new NotFoundError("Usuario no encontrado");
    if (!target.deletedAt) throw new ConflictError("La cuenta no está archivada");

    await repo.updateUserById(target.id, { deletedAt: null, isActive: true });
    await repo.createAuditLog(adminUserId, "user_restored", ip, userAgent, {
      target_subject: targetSubject,
    });
  },
});
