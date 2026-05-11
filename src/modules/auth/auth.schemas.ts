import { z } from "zod";

export const RoleEnum = z.enum(["admin", "worker", "client"]);

export const LoginRequestSchema = z.object({
  email: z
    .string()
    .email({ message: "Correo no válido" })
    .max(255, { message: "El correo es demasiado largo" }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
});

/** Solo email; el perfil comercial/fiscal será mod-users / mod-crm. */
export const InviteClientRequestSchema = z.object({
  email: z.string().email().max(255),
});

const passwordSchema = z
  .string()
  .min(8)
  .regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    "Mínimo 8 caracteres, una mayúscula, un número y un carácter especial."
  );

export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const RegisterWorkerSchema = z.object({
  email: z.string().email().max(255),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const ChangePasswordSchema = z
  .object({
    old_password: z.string().min(1),
    new_password: passwordSchema,
  })
  .refine((d) => d.old_password !== d.new_password, {
    message: "La nueva contraseña debe ser distinta de la actual.",
    path: ["new_password"],
  });

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type InviteClientRequest = z.infer<typeof InviteClientRequestSchema>;
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
export type RegisterWorkerRequest = z.infer<typeof RegisterWorkerSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailSchema>;
