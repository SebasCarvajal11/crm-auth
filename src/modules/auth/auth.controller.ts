import type { AuthServices } from "./auth.service";
import { createSessionControllerHandlers } from "./auth.controller.session";
import { createInvitesAdminControllerHandlers } from "./auth.controller.invites-admin";
import { createPasswordProfileControllerHandlers } from "./auth.controller.password-profile";

export const createAuthController = (services: AuthServices) => ({
  ...createSessionControllerHandlers(
    services.loginSessionService,
    services.passwordService,
    services.sessionListingService,
    services.emailVerificationService
  ),
  ...createInvitesAdminControllerHandlers(
    services.invitationService,
    services.workerRegistrationService
  ),
  ...createPasswordProfileControllerHandlers(
    services.passwordService,
    services.profileService
  ),
});

