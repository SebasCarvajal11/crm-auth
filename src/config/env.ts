import { z } from "zod";
import "dotenv/config";
import { getLogger } from "../shared/logger";
import { STREAM_CONVENTIONS } from "@sebascarvajal11/cima-contracts";

const pemFromEnv = z
  .string()
  .min(1)
  .transform((s) => s.replace(/\\n/g, "\n").trim());

const envBoolean = (defaultValue: boolean) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? String(defaultValue) : String(v).toLowerCase()),
    z.union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
  ).transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  DB_SCHEMA: z.literal("schema_auth"),
  SERVICE_VERSION: z.string().default("1.0.0"),
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
  /** Costo de hashing para bcrypt. */
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  /** TTL del Access Token en segundos (para firmas JWT). */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  /** TTL del Refresh Token en milisegundos (para cookies/sesiones). */
  REFRESH_TOKEN_TTL_MS: z.coerce.number().int().positive().default(604800000),
  /** TTL de códigos de restablecimiento de contraseña en milisegundos. */
  PASSWORD_RESET_TTL_MS: z.coerce.number().int().positive().default(3600000),
  /** TTL de enlaces de verificación de email en milisegundos. */
  EMAIL_VERIFY_TTL_MS: z.coerce.number().int().positive().default(172800000),
  /** Tras N intentos fallidos por cuenta se bloquea temporalmente. */
  LOGIN_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(50).default(15),
  LOGIN_LOCKOUT_DURATION_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1000), // 5 minutos
  /** Minimo de tiempo entre solicitudes de reset por cuenta. */
  PASSWORD_RESET_MIN_INTERVAL_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(15 * 60 * 1000), // 15 minutos
  /** Maximo de solicitudes de reset por cuenta en una ventana de 24h. */
  PASSWORD_RESET_MAX_PER_DAY: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(3),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  SERVICE_NAME: z.string().optional(),
  /**
   * Path del cookie httpOnly de refresh. Debe coincidir con la ruta que usa el navegador
   * (SPA con prefijo /api: /api/auth/refresh). Si llamas a mod-auth en :3000 sin proxy, usa /auth/refresh.
   */
  REFRESH_COOKIE_PATH: z.string().min(1).default("/api/auth/refresh"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MOD_AUTH_CORS: z
    .union([z.literal("true"), z.literal("false")])
    .default("false")
    .transform((v) => v === "true"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  /**
   * Solo para suites automatizadas locales: incluir `temp_password` en register-worker / invite-admin.
   * Requiere además NODE_ENV=test. Nunca activar en entornos accesibles.
   */
  EXPOSE_TEMP_PASSWORDS: envBoolean(false),
  /** URLs en correos (SPA): reset e invitación. */
  APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  MAIL_FROM: z.string().min(3).default("CIMA CRM <noreply@localhost>"),
  MAIL_TRANSPORT: z.enum(["smtp", "log"]).default("log"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_TLS_SERVERNAME: z.string().optional(),
  SMTP_SECURE: envBoolean(false),
  SMTP_REQUIRE_TLS: envBoolean(false),
  ADMIN_INVITE_SECRET: z.string().min(8).optional(),
  /** Días de retención de tokens usados/revocados antes de borrarlos. */
  TOKEN_CLEANUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Intervalo del worker de limpieza (ms). Por defecto 24 h. */
    TOKEN_CLEANUP_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(24 * 60 * 60 * 1000),
    AUTH_EVENTS_STREAM_KEY: z.string().default(STREAM_CONVENTIONS.streams.identity.events),
    AUTH_EVENTS_STREAM_MAXLEN: z.coerce.number().int().min(1000).default(10000),
    AUDIT_EVENTS_STREAM_KEY: z.string().optional(),
    AUDIT_EVENTS_STREAM_MAXLEN: z.coerce.number().int().optional(),
    AUTH_REQUESTS_STREAM_KEY: z.string().default(STREAM_CONVENTIONS.streams.identity.replayRequests),
    AUTH_REQUESTS_CONSUMER_GROUP: z.string().default(STREAM_CONVENTIONS.groups.auth.identityReplayRequests),
    IDENTITY_OUTBOX_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5000),
    IDENTITY_OUTBOX_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_VERIFY_EMAIL_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_VERIFY_EMAIL_WINDOW_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
    RATE_LIMIT_FORGOT_PASSWORD_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  })
  .superRefine((data, ctx) => {

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
      if (!data.SMTP_USER) {
        ctx.addIssue({
          code: "custom",
          message: "SMTP_USER es obligatorio si MAIL_TRANSPORT=smtp",
          path: ["SMTP_USER"],
        });
      }
      if (!data.SMTP_PASS) {
        ctx.addIssue({
          code: "custom",
          message: "SMTP_PASS es obligatorio si MAIL_TRANSPORT=smtp",
          path: ["SMTP_PASS"],
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const logger = getLogger();
  logger.error({ fieldErrors: parsed.error.flatten().fieldErrors }, "Variables de entorno inválidas");
  process.exit(1);
}

export const env = parsed.data;
