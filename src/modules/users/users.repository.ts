import { db } from "../../db/connection";
import { createUsersReadRepository } from "./repository/users-read.repository";
import { createUsersWriteRepository } from "./repository/users-write.repository";
import { createRefreshTokensRepository } from "./repository/refresh-tokens.repository";
import { createInvitationsRepository } from "./repository/invitations.repository";
import { createPasswordResetsRepository } from "./repository/password-resets.repository";
import { createEmailVerificationsRepository } from "./repository/email-verifications.repository";
import { createAuditLogsRepository } from "./repository/audit-logs.repository";
import { createTokenCleanupRepository } from "./repository/token-cleanup.repository";
import { createIdentityOutboxRepository } from "./repository/identity-outbox.repository";
import { createEmailOutboxRepository } from "./repository/email-outbox.repository";

export type DB = typeof db;
export type TX = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | TX;

export const createUsersRepository = (conn: DbOrTx = db) => {
  const repo = {
    ...createUsersReadRepository(conn),
    ...createUsersWriteRepository(conn),
    ...createRefreshTokensRepository(conn),
    ...createInvitationsRepository(conn),
    ...createPasswordResetsRepository(conn),
    ...createEmailVerificationsRepository(conn),
    ...createAuditLogsRepository(conn),
    ...createTokenCleanupRepository(conn),
    ...createIdentityOutboxRepository(conn),
    ...createEmailOutboxRepository(conn),
  };

  return {
    ...repo,
    transaction: async <T>(cb: (txRepo: typeof repo) => Promise<T>): Promise<T> => {
      return conn.transaction(async (tx: any) => {
        return cb(createUsersRepository(tx));
      });
    },
  };
};

export type UsersRepository = ReturnType<typeof createUsersRepository>;

export type ActiveSessionFamilyRow = Awaited<
  ReturnType<UsersRepository["listActiveSessionFamilies"]>
>[number];

export type UserPublicProfileRow = Awaited<
  ReturnType<UsersRepository["searchActiveByEmailAndRole"]>
>[number];

export type AdminUserListRow = Awaited<
  ReturnType<UsersRepository["listUsersPaginated"]>
>["rows"][number];
