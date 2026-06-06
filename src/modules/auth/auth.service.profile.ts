import type { ProfileRepository } from "./ports/auth-repositories.port";
import { NotFoundError } from "../../shared/middlewares/error-handler.middleware";

/** Solo lectura de identidad; perfil UI/CRM en mod-users. */
export const createProfileService = (repo: ProfileRepository) => ({
  getMe: async (userId: string) => {
    const user = await repo.findIdentityMeById(userId);
    if (!user) throw new NotFoundError("Usuario no encontrado");

    return {
      id: user.subject,
      email: user.email,
      role: user.role,
      first_name: user.firstName,
      last_name: user.lastName,
      client_kind: user.clientKind,
      company_name: user.companyName,
      profession: user.profession,
      emailVerifiedAt: user.emailVerifiedAt,
      force_password_change: user.forcePasswordChange,
    };
  },
});
