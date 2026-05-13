import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import type { UsersRepository } from "../users/users.repository";
import type { InviteClientRequest, AcceptInviteRequest } from "./auth.schemas";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import { env } from "../../config/env";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS } from "./auth.constants";
import { issueTokenPair } from "./auth.token-utils";

export const createInvitationMethods = (
  repo: UsersRepository,
  mail: EmailJobPublisher
) => ({
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

    const rawToken = randomBytes(32).toString("hex");

    await repo.createInvitation({
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      clientKind: data.client_kind,
      companyName: data.company_name ?? null,
      token: rawToken,
      createdBy: adminUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await repo.createAuditLog(adminUserId, "invitation_created", ip, userAgent, {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      client_kind: data.client_kind,
      company_name: data.company_name ?? null,
    });

    mail
      .enqueue({
        type: "client_invite",
        to: data.email,
        token: rawToken,
      })
      .catch((err) => console.error("[mail enqueue invite]", err));

    return env.NODE_ENV !== "production" ? { token: rawToken } : {};
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
    };
  },

  acceptInvitation: async (data: AcceptInviteRequest, ip: string, userAgent: string) => {
    const invitation = await repo.findInvitationByToken(data.token);
    if (!invitation) throw new NotFoundError("Invitación no encontrada");
    if (invitation.isUsed) throw new ConflictError("Esta invitación ya fue utilizada");
    if (invitation.expiresAt < new Date())
      throw new UnauthorizedError("La invitación ha expirado");

    const dup = await repo.findByEmailIncludingDeleted(invitation.email);
    if (dup && !dup.deletedAt) {
      throw new ConflictError("Ya existe una cuenta con este correo");
    }
    if (dup?.deletedAt) {
      throw new ConflictError(
        "Existe una cuenta archivada con este correo. Restáurala desde administración."
      );
    }

    const passwordHash = await hash(data.password, BCRYPT_ROUNDS);

    const user = await repo.createUser({
      email: invitation.email,
      passwordHash,
      role: "client",
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      clientKind: invitation.clientKind,
      companyName: invitation.companyName,
      emailVerifiedAt: new Date(),
    });

    await repo.markInvitationAsUsed(invitation.id);

    await repo.markSuccessfulLogin(user.id);

    const { accessToken, rawRefreshToken } = await issueTokenPair(
      repo,
      user.id,
      user.subject,
      user.role,
      user.email,
      userAgent,
      false
    );

    await repo.createAuditLog(user.id, "invitation_accepted", ip, userAgent, {
      invitation_id: invitation.id,
    });

    return {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      user: {
        id: user.subject,
        role: user.role,
        force_password_change: false,
      },
    };
  },
});
