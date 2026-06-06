import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import type { WorkerRegistrationRepository } from "./ports/auth-repositories.port";
import type { RegisterWorkerRequest } from "./auth.schemas";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import { env } from "../../config/env";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS } from "./auth.constants";
import { getLogger } from "../../shared/logger";

const logger = getLogger();

const mayExposeTempPasswordInResponse = () =>
  env.NODE_ENV === "test" && env.EXPOSE_TEMP_PASSWORDS;

export const createWorkerRegistrationService = (
  repo: WorkerRegistrationRepository,
  mail: EmailJobPublisher
) => ({
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

    const rawToken = randomBytes(32).toString("hex");

    await repo.createInvitation({
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      role: "worker",
      profession: data.profession,
      token: rawToken,
      createdBy: adminUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await repo.createAuditLog(adminUserId, "worker_registered", ip, userAgent, {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      profession: data.profession,
    });

    mail
      .enqueue({
        type: "client_invite",
        to: data.email,
        token: rawToken,
      })
      .catch((err) => logger.error({ err, topic: "mail enqueue worker invite" }, "enqueue failed"));

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
      secret_password: string;
    },
    adminUserId: string,
    ip: string,
    userAgent: string
  ) => {
    if (!env.ADMIN_INVITE_SECRET) {
      throw new BadRequestError(
        "La funcionalidad de invitación de administradores no está configurada"
      );
    }
    if (data.secret_password !== env.ADMIN_INVITE_SECRET) {
      throw new UnauthorizedError("Contraseña secreta inválida para invitar administradores");
    }

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

    const rawToken = randomBytes(32).toString("hex");

    await repo.createInvitation({
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      role: "admin",
      token: rawToken,
      createdBy: adminUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await repo.createAuditLog(adminUserId, "admin_invited", ip, userAgent, {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
    });

    mail
      .enqueue({
        type: "client_invite",
        to: data.email,
        token: rawToken,
      })
      .catch((err) => logger.error({ err, topic: "mail enqueue admin invite" }, "enqueue failed"));

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
