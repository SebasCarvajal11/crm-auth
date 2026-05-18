import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import type { UsersRepository } from "../users/users.repository";
import type { RegisterWorkerRequest } from "./auth.schemas";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import { env } from "../../config/env";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS } from "./auth.constants";

const mayExposeTempPasswordInResponse = () =>
  env.NODE_ENV === "test" && env.EXPOSE_TEMP_PASSWORDS;

export const createWorkerRegistrationMethods = (
  repo: UsersRepository,
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

    const tempPassword = randomBytes(8).toString("hex");
    const passwordHash = await hash(tempPassword, BCRYPT_ROUNDS);

    const user = await repo.transaction(async (txRepo) => {
      const created = await txRepo.createUser({
        email: data.email,
        passwordHash,
        role: "worker",
        firstName: data.first_name,
        lastName: data.last_name,
        profession: data.profession,
        emailVerifiedAt: new Date(),
        forcePasswordChange: true,
      });

      await txRepo.createAuditLog(adminUserId, "worker_registered", ip, userAgent, {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        profession: data.profession,
      });

      return created;
    });

    mail
      .enqueue({
        type: "worker_welcome",
        to: data.email,
        tempPassword,
      })
      .catch((err) => console.error("[mail enqueue worker]", err));

    return {
      user: {
        id: user.subject,
        email: user.email,
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
        profession: user.profession,
        force_password_change: true,
      },
      ...(mayExposeTempPasswordInResponse() ? { temp_password: tempPassword } : {}),
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

    const tempPassword = randomBytes(8).toString("hex");
    const passwordHash = await hash(tempPassword, BCRYPT_ROUNDS);

    const user = await repo.transaction(async (txRepo) => {
      const created = await txRepo.createUser({
        email: data.email,
        passwordHash,
        role: "admin",
        firstName: data.first_name,
        lastName: data.last_name,
        emailVerifiedAt: new Date(),
        forcePasswordChange: true,
      });

      await txRepo.createAuditLog(adminUserId, "admin_invited", ip, userAgent, {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
      });

      return created;
    });

    mail
      .enqueue({
        type: "worker_welcome",
        to: data.email,
        tempPassword,
      })
      .catch((err) => console.error("[mail enqueue admin]", err));

    return {
      user: {
        id: user.subject,
        email: user.email,
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
        profession: user.profession,
        force_password_change: true,
      },
      ...(mayExposeTempPasswordInResponse() ? { temp_password: tempPassword } : {}),
    };
  },
});
