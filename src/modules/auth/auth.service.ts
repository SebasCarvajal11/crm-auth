import type { UsersRepository } from "../users/users.repository";
import { createLoginSessionService } from "./auth.service.login-session";
import { createInvitationService } from "./auth.service.invitations";
import { createWorkerRegistrationService } from "./auth.service.worker";
import { createPasswordService } from "./auth.service.password";
import { createSessionListingService } from "./auth.service.sessions";
import { createEmailVerificationService } from "./auth.service.email-verify";
import { createAdminUserService } from "./auth.service.admin";
import { createProfileService } from "./auth.service.profile";

export type LoginSessionService = ReturnType<typeof createLoginSessionService>;
export type InvitationService = ReturnType<typeof createInvitationService>;
export type WorkerRegistrationService = ReturnType<typeof createWorkerRegistrationService>;
export type PasswordService = ReturnType<typeof createPasswordService>;
export type SessionListingService = ReturnType<typeof createSessionListingService>;
export type EmailVerificationService = ReturnType<typeof createEmailVerificationService>;
export type AdminUserService = ReturnType<typeof createAdminUserService>;
export type ProfileService = ReturnType<typeof createProfileService>;

export interface AuthServices {
  loginSessionService: LoginSessionService;
  invitationService: InvitationService;
  workerRegistrationService: WorkerRegistrationService;
  passwordService: PasswordService;
  sessionListingService: SessionListingService;
  emailVerificationService: EmailVerificationService;
  adminUserService: AdminUserService;
  profileService: ProfileService;
}

export const createAuthServices = (repo: UsersRepository): AuthServices => ({
  loginSessionService: createLoginSessionService(repo),
  invitationService: createInvitationService(repo),
  workerRegistrationService: createWorkerRegistrationService(repo),
  passwordService: createPasswordService(repo),
  sessionListingService: createSessionListingService(repo),
  emailVerificationService: createEmailVerificationService(repo),
  adminUserService: createAdminUserService(repo),
  profileService: createProfileService(repo),
});

