import { z } from "zod";
import "dotenv/config";

const pemFromEnv = z
  .string()
  .min(1)
  .transform((s) => s.replace(/\\n/g, "\n").trim());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  /** PKCS#8 PEM (RSA). Firmar access tokens (RS256). No compartir fuera del servicio. */
  JWT_PRIVATE_KEY: pemFromEnv.refine(
    (pem) => pem.includes("BEGIN PRIVATE KEY"),
    "JWT_PRIVATE_KEY debe ser PKCS#8 PEM (BEGIN PRIVATE KEY)"
  ),
  /** SPKI PEM (RSA). Verificación local + JWKS público para KrakenD / otros MS. */
  JWT_PUBLIC_KEY: pemFromEnv.refine(
    (pem) => pem.includes("BEGIN PUBLIC KEY"),
    "JWT_PUBLIC_KEY debe ser SPKI PEM (BEGIN PUBLIC KEY)"
  ),
  /** Identificador de clave en header JWT y en JWKS (rotación de llaves). */
  JWT_KID: z.string().min(1).default("mod-auth-rsa-1"),
  /** Opcional: issuer claim; el gateway puede exigir coincidencia en producción. */
  JWT_ISS: z.string().min(1).optional(),
  /** Redis opcional: si está definido, la cola de emails BullMQ funciona con reintento distribuido. */
  REDIS_URL: z.string().url().optional(),
  /** Tras N intentos fallidos por cuenta se bloquea temporalmente. */
  LOGIN_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(50).default(8),
  LOGIN_LOCKOUT_DURATION_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60 * 1000),
  PORT: z.coerce.number().default(3000),
  /**
   * Si es true y GATEWAY_TRUST_SECRET coincide con la cabecera `X-Gateway-Trust` que inyecta KrakenD,
   * `authMiddleware` confía en los claims propagados (X-User-*) y omite verificar de nuevo el JWT.
   * Desactivado por defecto (doble verificación RS256: gateway + mod-auth).
   */
  /** Por defecto false si la variable no está definida (desarrollo local). */
  TRUST_GATEWAY_JWT_HEADERS: z.preprocess(
    (v) => (v === "" || v === undefined ? "false" : v),
    z.union([
      z.literal("true"),
      z.literal("false"),
      z.literal("1"),
      z.literal("0"),
    ])
  ).transform((v) => v === "true" || v === "1"),
  /** Secreto compartido con KrakenD (Martian `X-Gateway-Trust`). Obligatorio si TRUST_GATEWAY_JWT_HEADERS. */
  GATEWAY_TRUST_SECRET: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** URLs en correos (SPA): reset e invitación. */
  APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  MAIL_FROM: z.string().min(3).default("CIMA CRM <noreply@localhost>"),
  MAIL_TRANSPORT: z.enum(["smtp", "log"]).default("log"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.TRUST_GATEWAY_JWT_HEADERS && !data.GATEWAY_TRUST_SECRET) {
      ctx.addIssue({
        code: "custom",
        message:
          "GATEWAY_TRUST_SECRET es obligatorio cuando TRUST_GATEWAY_JWT_HEADERS=true (mínimo 32 caracteres)",
        path: ["GATEWAY_TRUST_SECRET"],
      });
    }
    if (data.MAIL_TRANSPORT === "smtp") {
      if (!data.SMTP_HOST) {
        ctx.addIssue({
          code: "custom",
          message: "SMTP_HOST es obligatorio si MAIL_TRANSPORT=smtp",
          path: ["SMTP_HOST"],
        });
      }
      if (data.SMTP_PORT === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "SMTP_PORT es obligatorio si MAIL_TRANSPORT=smtp",
          path: ["SMTP_PORT"],
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
