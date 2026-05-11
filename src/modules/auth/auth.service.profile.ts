import type { UsersRepository } from "../users/users.repository";
import { NotFoundError } from "../../shared/middlewares/error-handler.middleware";

/** Solo lectura de identidad; perfil UI/CRM en mod-users. */
export const createIdentityReadMethods = (repo: UsersRepository) => ({
  getMe: async (userId: string) => {
    const user = await repo.findById(userId);
    if (!user) throw new NotFoundError("Usuario no encontrado");

    return {
      id: user.subject,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      force_password_change: user.forcePasswordChange,
      last_login_at: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt,
    };
  },
});
