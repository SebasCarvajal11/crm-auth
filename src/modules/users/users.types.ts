import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  refreshTokens,
  invitations,
  passwordResets,
  emailVerifications,
  auditLogs,
} from "../../db/schema";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;

export type Invitation = InferSelectModel<typeof invitations>;
export type NewInvitation = InferInsertModel<typeof invitations>;

export type PasswordReset = InferSelectModel<typeof passwordResets>;
export type NewPasswordReset = InferInsertModel<typeof passwordResets>;

export type EmailVerification = InferSelectModel<typeof emailVerifications>;
export type NewEmailVerification = InferInsertModel<typeof emailVerifications>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type AuditDetails = Record<string, unknown>;

export type UserPatch = {
  passwordHash?: string;
  isActive?: boolean;
  forcePasswordChange?: boolean;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  deletedAt?: Date | null;
};
