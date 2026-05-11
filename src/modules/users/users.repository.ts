import { usersReadRepository } from "./repository/users-read.repository";
import { usersWriteRepository } from "./repository/users-write.repository";
import { refreshTokensRepository } from "./repository/refresh-tokens.repository";
import { invitationsRepository } from "./repository/invitations.repository";
import { passwordResetsRepository } from "./repository/password-resets.repository";
import { emailVerificationsRepository } from "./repository/email-verifications.repository";
import { auditLogsRepository } from "./repository/audit-logs.repository";

/** Aggregado único: todas las queries Drizzle del módulo users viven bajo `repository/`. */
export const usersRepository = {
  ...usersReadRepository,
  ...usersWriteRepository,
  ...refreshTokensRepository,
  ...invitationsRepository,
  ...passwordResetsRepository,
  ...emailVerificationsRepository,
  ...auditLogsRepository,
};

export type UsersRepository = typeof usersRepository;
