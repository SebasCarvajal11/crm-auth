import { hash } from "bcrypt";
import type { WorkerRegistrationRepository } from "./ports/auth-repositories.port";
import type { RegisterWorkerRequest } from "./auth.schemas";
import { env } from "../../config/env";
import {
  ConflictError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS } from "./auth.constants";
import { getLogger } from "../../shared/logger";
import { createActionToken, hashActionToken } from "./action-token";
import { encryptEmailJob } from "../../email/email-outbox-crypto";

const logger = getLogger();

export const createWorkerRegistrationService = (repo: WorkerRegistrationRepository) => ({
  registerWorker: async (
    data: RegisterWorkerRequest,
    adminUserId: string,
    ip: string,
    userAgent: string
  ) => {
    const existing = await repo.findByEmailIncludingDeleted(data.email);
    if (existing && !existing.deletedAt) {
      throw new ConflictError("Ya existe un usuario con ese correo");
    }
    if (existing?.deletedAt) {
      throw new ConflictError(
        "Existe una cuenta archivada con ese correo; restáurala desde administración o usa otro correo."
      );
    }

    const pendingInvite = await repo.findPendingInvitationByEmail(data.email);
    if (pendingInvite) {
      throw new ConflictError("Ya existe una invitación pendiente para este correo");
    }

    const rawToken = createActionToken();

    await repo.transaction(async (tx) => {
      await tx.createInvitation({
        email: data.email, firstName: data.first_name, lastName: data.last_name,
        role: "worker", profession: data.profession, token: hashActionToken(rawToken),
        createdBy: adminUserId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await tx.createEmailOutboxEvent(encryptEmailJob({ type: "client_invite", to: data.email, token: rawToken }));
      await tx.createAuditLog(adminUserId, "worker_registered", ip, userAgent, {
        email: data.email, first_name: data.first_name, last_name: data.last_name, profession: data.profession,
      });
    });

    return {
      user: {
        email: data.email,
        role: "worker" as const,
        first_name: data.first_name,
        last_name: data.last_name,
        profession: data.profession,
      },
      ...(env.NODE_ENV === "test" ? { token: rawToken } : {}),
    };
  },

  inviteAdmin: async (
    data: {
      email: string;
      first_name: string;
      last_name: string;
    },
    adminUserId: string,
    ip: string,
    userAgent: string
  ) => {
    const existing = await repo.findByEmailIncludingDeleted(data.email);
    if (existing && !existing.deletedAt) {
      throw new ConflictError("Ya existe un usuario con ese correo");
    }
    if (existing?.deletedAt) {
      throw new ConflictError(
        "Existe una cuenta archivada con ese correo; restáurala desde administración o usa otro correo."
      );
    }

    const pendingInvite = await repo.findPendingInvitationByEmail(data.email);
    if (pendingInvite) {
      throw new ConflictError("Ya existe una invitación pendiente para este correo");
    }

    const rawToken = createActionToken();

    await repo.transaction(async (tx) => {
      await tx.createInvitation({
        email: data.email, firstName: data.first_name, lastName: data.last_name,
        role: "admin", token: hashActionToken(rawToken), createdBy: adminUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await tx.createEmailOutboxEvent(encryptEmailJob({ type: "client_invite", to: data.email, token: rawToken }));
      await tx.createAuditLog(adminUserId, "admin_invited", ip, userAgent, {
        email: data.email, first_name: data.first_name, last_name: data.last_name,
      });
    });

    return {
      user: {
        email: data.email,
        role: "admin" as const,
        first_name: data.first_name,
        last_name: data.last_name,
      },
      ...(env.NODE_ENV === "test" ? { token: rawToken } : {}),
    };
  },
});
