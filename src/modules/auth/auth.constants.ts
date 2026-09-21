import { env } from "../../config/env";

/** Constantes compartidas del dominio auth (TTL, bcrypt), ahora parametrizadas mediante variables de entorno. */
export const BCRYPT_ROUNDS = env.BCRYPT_ROUNDS;
export const ACCESS_TOKEN_TTL_SECONDS = env.ACCESS_TOKEN_TTL_SECONDS;
export const REFRESH_TOKEN_TTL_MS = env.REFRESH_TOKEN_TTL_MS;
export const PASSWORD_RESET_TTL_MS = env.PASSWORD_RESET_TTL_MS;
export const EMAIL_VERIFY_TTL_MS = env.EMAIL_VERIFY_TTL_MS;
/** Hash dummy precalculado para igualar la latencia de hashing y prevenir timing attacks de enumeración. */
export const DUMMY_BCRYPT_HASH = "$2b$12$e8Uv7t19M57D4.1oD7zMdeK5tq1y2qgN68L79q/0.yX1g5mN70.52";
