import type { Context } from "hono";

/**
 * Obtiene el cuerpo JSON ya validado por `zValidator("json", Schema)` en la cadena de la ruta.
 *
 * Hono no propaga el literal `"json"` al tipo `Context` cuando el handler vive fuera del mismo archivo
 * que registra `zValidator`; el único `as never` queda acotado aquí. El tipo `S` debe coincidir con el
 * schema Zod de esa ruta (los mismos `*Request` que recibe `createAuthService`).
 */
export function validatedJson<S>(c: Context): S {
  return c.req.valid("json" as never) as S;
}

/** Query string validada por `zValidator("query", …)`. */
export function validatedQuery<S>(c: Context): S {
  return c.req.valid("query" as never) as S;
}
