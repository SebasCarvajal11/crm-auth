import { z } from "zod";

export const RoleEnum = z.enum(["admin", "worker", "client"]);

const ClientKindEnum = z.enum(["natural", "juridical"]);
const nameField = z.string().trim().min(1).max(120);
const professionField = z.string().trim().min(1).max(160);

export const LoginRequestSchema = z.object({
  email: z
    .string()
    .email({ message: "Correo no valido" })
    .max(255, { message: "El correo es demasiado largo" }),
  password: z
    .string()
    .min(8, { message: "La contrasena debe tener al menos 8 caracteres" }),
});

export const InviteClientRequestSchema = z
  .object({
    email: z.string().email().max(255),
    first_name: nameField,
    last_name: nameField,
    client_kind: ClientKindEnum,
    company_name: z.string().trim().max(160).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.client_kind === "juridical" && !data.company_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company_name"],
        message: "company_name es requerido para cliente juridico",
      });
    }
    if (data.client_kind === "natural" && data.company_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company_name"],
        message: "company_name solo aplica para cliente juridico",
      });
    }
  });

const passwordSchema = z
  .string()
  .min(8)
  .regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    "Minimo 8 caracteres, una mayuscula, un numero y un caracter especial."
  );

export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const RegisterWorkerSchema = z.object({
  email: z.string().email().max(255),
  first_name: nameField,
  last_name: nameField,
  profession: professionField,
});

export const InviteAdminSchema = z.object({
  email: z.string().email().max(255),
  first_name: nameField,
  last_name: nameField,
  secret_password: z.string().min(1, "La contraseña secreta es requerida"),
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
    message: "La nueva contrasena debe ser distinta de la actual.",
    path: ["new_password"],
  });

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type InviteClientRequest = z.infer<typeof InviteClientRequestSchema>;
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
export type RegisterWorkerRequest = z.infer<typeof RegisterWorkerSchema>;
export type InviteAdminRequest = z.infer<typeof InviteAdminSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailSchema>;
