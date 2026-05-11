import type { AuthService } from "./auth.service";
import { createSessionControllerHandlers } from "./auth.controller.session";
import { createInvitesAdminControllerHandlers } from "./auth.controller.invites-admin";
import { createPasswordProfileControllerHandlers } from "./auth.controller.password-profile";

export const createAuthController = (authService: AuthService) => ({
  ...createSessionControllerHandlers(authService),
  ...createInvitesAdminControllerHandlers(authService),
  ...createPasswordProfileControllerHandlers(authService),
});
