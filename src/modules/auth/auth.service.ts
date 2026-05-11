import type { UsersRepository } from "../users/users.repository";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import { createLoginSessionMethods } from "./auth.service.login-session";
import { createInvitationMethods } from "./auth.service.invitations";
import { createWorkerRegistrationMethods } from "./auth.service.worker";
import { createPasswordMethods } from "./auth.service.password";
import { createSessionListingMethods } from "./auth.service.sessions";
import { createEmailVerificationMethods } from "./auth.service.email-verify";
import { createAdminUserMethods } from "./auth.service.admin";
import { createIdentityReadMethods } from "./auth.service.profile";

export const createAuthService = (repo: UsersRepository, mail: EmailJobPublisher) => ({
  ...createLoginSessionMethods(repo),
  ...createInvitationMethods(repo, mail),
  ...createWorkerRegistrationMethods(repo, mail),
  ...createPasswordMethods(repo, mail),
  ...createSessionListingMethods(repo),
  ...createEmailVerificationMethods(repo, mail),
  ...createAdminUserMethods(repo),
  ...createIdentityReadMethods(repo),
});

export type AuthService = ReturnType<typeof createAuthService>;
