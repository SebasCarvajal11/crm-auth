import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import type { UsersRepository } from "../users/users.repository";
import type { RegisterWorkerRequest } from "./auth.schemas";
import type { EmailJobPublisher } from "../../email/transactional-email.types";
import { env } from "../../config/env";
import { ConflictError } from "../../shared/middlewares/error-handler.middleware";
import { BCRYPT_ROUNDS } from "./auth.constants";

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

    const user = await repo.createUser({
      email: data.email,
      passwordHash,
      role: "worker",
      firstName: data.first_name,
      lastName: data.last_name,
      profession: data.profession,
      emailVerifiedAt: new Date(),
      forcePasswordChange: true,
    });

    await repo.createAuditLog(adminUserId, "worker_registered", ip, userAgent, {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      profession: data.profession,
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
      ...(env.NODE_ENV !== "production" ? { temp_password: tempPassword } : {}),
    };
  },
});
