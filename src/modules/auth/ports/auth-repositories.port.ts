import type { UsersRepository } from "../../users/users.repository";
import type { IdentityEventWriter } from "./identity-event-publisher.port";

type TransactionalRepository<TxRepository> = {
  transaction<T>(cb: (txRepo: TxRepository) => Promise<T>): Promise<T>;
};

export type RefreshTokenWriter = Pick<UsersRepository, "saveRefreshToken">;

export type LoginSessionTransactionRepository = Pick<
  UsersRepository,
  | "createAuditLog"
  | "clearExpiredAccountLock"
  | "recordFailedLoginAttempt"
  | "markSuccessfulLogin"
  | "revokeTokenFamily"
  | "revokeToken"
  | "findById"
  | "findRefreshToken"
  | "saveRefreshToken"
>;

export type LoginSessionRepository = Pick<
  UsersRepository,
  "findByEmail" | "findRefreshToken"
> &
  TransactionalRepository<LoginSessionTransactionRepository>;

export type InvitationTransactionRepository = Pick<
  UsersRepository,
  | "findInvitationByToken"
  | "findByEmailIncludingDeleted"
  | "createUser"
  | "markInvitationAsUsed"
  | "markSuccessfulLogin"
  | "createAuditLog"
  | "saveRefreshToken"
> &
  IdentityEventWriter;

export type InvitationRepository = Pick<
  UsersRepository,
  | "findByEmailIncludingDeleted"
  | "findPendingInvitationByEmail"
  | "createInvitation"
  | "createAuditLog"
  | "findInvitationByToken"
> &
  TransactionalRepository<InvitationTransactionRepository>;

export type WorkerRegistrationRepository = Pick<
  UsersRepository,
  | "findByEmailIncludingDeleted"
  | "findPendingInvitationByEmail"
  | "createInvitation"
  | "createAuditLog"
>;

export type PasswordTransactionRepository = Pick<
  UsersRepository,
  | "createAuditLog"
  | "findPasswordResetByToken"
  | "findById"
  | "updateUserById"
  | "revokeAllRefreshTokensForUser"
  | "markPasswordResetAsUsed"
  | "invalidateUnusedPasswordResetsForUser"
  | "invalidateUnusedEmailVerificationsForUser"
  | "createPasswordReset"
>;

export type PasswordRepository = Pick<
  UsersRepository,
  | "findByEmail"
  | "findLatestPasswordResetForUser"
  | "countPasswordResetsForUserSince"
> &
  TransactionalRepository<PasswordTransactionRepository>;

export type SessionListingRepository = Pick<
  UsersRepository,
  | "listActiveSessionFamilies"
  | "findRefreshToken"
  | "revokeRefreshTokensForUserFamily"
  | "createAuditLog"
>;

export type EmailVerificationTransactionRepository = Pick<
  UsersRepository,
  | "findById"
  | "createAuditLog"
  | "createEmailVerification"
  | "findEmailVerificationByToken"
  | "updateUserById"
  | "markEmailVerificationAsUsed"
>;

export type EmailVerificationRepository =
  TransactionalRepository<EmailVerificationTransactionRepository>;

export type AdminUserRepository = Pick<
  UsersRepository,
  | "searchActiveByEmailAndRole"
  | "listUsersPaginated"
  | "findBySubjectIncludingDeleted"
  | "updateUserById"
  | "createAuditLog"
  | "revokeAllRefreshTokensForUser"
> &
  TransactionalRepository<
    Pick<
      UsersRepository,
      | "findBySubjectIncludingDeleted"
      | "updateUserById"
      | "createAuditLog"
      | "revokeAllRefreshTokensForUser"
    > &
      IdentityEventWriter
  >;

export type ProfileRepository = Pick<UsersRepository, "findIdentityMeById">;
