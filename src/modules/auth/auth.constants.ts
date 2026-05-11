/** Constantes compartidas del dominio auth (TTL, bcrypt). */
export const BCRYPT_ROUNDS = 12;
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const EMAIL_VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
