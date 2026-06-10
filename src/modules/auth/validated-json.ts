import type { Context } from "hono";
import { validator } from "hono/validator";
import type { z } from "zod";
import { BadRequestError } from "../../shared/middlewares/error-handler.middleware";

const VALIDATION_MESSAGE = "La validacion de los datos de entrada fallo.";

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

export const jsonValidator = <Schema extends z.ZodType>(schema: Schema) =>
  validator("json", (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestError(VALIDATION_MESSAGE, { issues: formatIssues(parsed.error) });
    }
    return parsed.data;
  });

export const paramValidator = <Schema extends z.ZodType>(schema: Schema) =>
  validator("param", (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestError(VALIDATION_MESSAGE, { issues: formatIssues(parsed.error) });
    }
    return parsed.data;
  });

/**
 * Obtiene el cuerpo JSON ya validado por `jsonValidator(Schema)` en la cadena de la ruta.
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
