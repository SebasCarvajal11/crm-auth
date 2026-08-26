import { hash } from "bcrypt";
import type { InvitationRepository } from "./ports/auth-repositories.port";
import type { InviteClientRequest, AcceptInviteRequest } from "./auth.schemas";
import { env } from "../../config/env";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS } from "./auth.constants";
import { issueTokenPair } from "./auth.token-utils";
import { getLogger } from "../../shared/logger";
import { createActionToken, hashActionToken } from "./action-token";
import { encryptEmailJob } from "../../email/email-outbox-crypto";

const logger = getLogger();

export const createInvitationService = (repo: InvitationRepository) => ({
  inviteClient: async (
    data: InviteClientRequest,
    adminUserId: string,
    ip: string,
    userAgent: string
  ) => {
    const dup = await repo.findByEmailIncludingDeleted(data.email);
    if (dup && !dup.deletedAt) {
      throw new ConflictError("Ya existe un usuario con ese correo");
    }
    if (dup?.deletedAt) {
      throw new ConflictError(
        "Existe una cuenta archivada con ese correo; restáurala o usa otro correo."
      );
    }

    const pendingInvite = await repo.findPendingInvitationByEmail(data.email);
    if (pendingInvite) {
      throw new ConflictError("Ya existe una invitación pendiente para este correo");
    }

    const rawToken = createActionToken();

    await repo.transaction(async (tx) => {
      await tx.createInvitation({
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        clientKind: data.client_kind,
        companyName: data.company_name ?? null,
        token: hashActionToken(rawToken),
        createdBy: adminUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await tx.createEmailOutboxEvent(
        encryptEmailJob({ type: "client_invite", to: data.email, token: rawToken })
      );
      await tx.createAuditLog(adminUserId, "invitation_created", ip, userAgent, {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        client_kind: data.client_kind,
        company_name: data.company_name ?? null,
      });
    });

    return env.NODE_ENV === "test" ? { token: rawToken } : undefined;
  },

  getInvitationData: async (token: string) => {
    const invitation = await repo.findInvitationByToken(token);
    if (!invitation) throw new NotFoundError("Invitación no encontrada");
    if (invitation.isUsed) throw new ConflictError("Esta invitación ya fue utilizada");
    if (invitation.expiresAt < new Date())
      throw new UnauthorizedError("La invitación ha expirado");

    return {
      email: invitation.email,
      first_name: invitation.firstName,
      last_name: invitation.lastName,
      client_kind: invitation.clientKind,
      company_name: invitation.companyName,
      role: invitation.role,
      profession: invitation.profession,
    };
  },

  acceptInvitation: async (data: AcceptInviteRequest, ip: string, userAgent: string) => {
    const result = await repo.transaction(async (tx) => {
      const invitation = await tx.findInvitationByToken(data.token);
      if (!invitation) throw new NotFoundError("Invitación no encontrada");
      if (invitation.isUsed) throw new ConflictError("Esta invitación ya fue utilizada");
      if (invitation.expiresAt < new Date())
        throw new UnauthorizedError("La invitación ha expirado");

      const dup = await tx.findByEmailIncludingDeleted(invitation.email);
      if (dup && !dup.deletedAt) {
        throw new ConflictError("Ya existe una cuenta con este correo");
      }
      if (dup?.deletedAt) {
        throw new ConflictError(
          "Existe una cuenta archivada con este correo. Restáurala desde administración."
        );
      }

      const passwordHash = await hash(data.password, BCRYPT_ROUNDS);

      const user = await tx.createUser({
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        clientKind: invitation.clientKind,
        companyName: invitation.companyName,
        profession: invitation.profession,
        emailVerifiedAt: new Date(),
      });

      await tx.markInvitationAsUsed(invitation.id);

      await tx.markSuccessfulLogin(user.id);

      const { accessToken, rawRefreshToken } = await issueTokenPair(
        tx,
        user.id,
        user.subject,
        user.role,
        user.email,
        userAgent,
        false
      );

      await tx.createAuditLog(user.id, "invitation_accepted", ip, userAgent, {
        invitation_id: invitation.id,
      });
      await tx.createIdentityOutboxEvent("user.registered", user);

      return {
        response: {
          access_token: accessToken,
          refresh_token: rawRefreshToken,
          user: {
            id: user.subject,
            role: user.role,
            force_password_change: false,
          },
        },
      };
    });

    return result.response;
  },
});
