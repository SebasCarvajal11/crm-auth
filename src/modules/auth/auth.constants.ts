import { env } from "../../config/env";

/** Constantes compartidas del dominio auth (TTL, bcrypt), ahora parametrizadas mediante variables de entorno. */
export const BCRYPT_ROUNDS = env.BCRYPT_ROUNDS;
export const ACCESS_TOKEN_TTL_SECONDS = env.ACCESS_TOKEN_TTL_SECONDS;
export const REFRESH_TOKEN_TTL_MS = env.REFRESH_TOKEN_TTL_MS;
export const PASSWORD_RESET_TTL_MS = env.PASSWORD_RESET_TTL_MS;
export const EMAIL_VERIFY_TTL_MS = env.EMAIL_VERIFY_TTL_MS;
