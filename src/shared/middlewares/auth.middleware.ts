import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { env } from "../../config/env";
import { normalizePem } from "../../config/jwt";
import {
  UnauthorizedError,
  ForbiddenError,
} from "./error-handler.middleware";

export interface JwtPayload {
  sub: string;
  userId: string;
  role: "admin" | "worker" | "client";
  email: string;
  /** Ausente o false = no aplica; true = obligar cambio de contraseña (workers nuevos). */
  force_password_change?: boolean;
  iss?: string;
  iat?: number;
  exp: number;
}

function isRole(r: string): r is JwtPayload["role"] {
  return r === "admin" || r === "worker" || r === "client";
}

export type AppEnv = {
  Variables: {
    user: JwtPayload;
  };
};

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Se requiere un token de autorización");
  }

  const token = authHeader.slice(7);

  try {
    const key = normalizePem(env.JWT_PUBLIC_KEY);
    const payload = (await verify(
      token,
      key,
      env.JWT_ISS ? { alg: "RS256", iss: env.JWT_ISS } : "RS256"
    )) as unknown as JwtPayload;
    c.set("user", payload);
    await next();
  } catch {
    throw new UnauthorizedError("Token inválido o expirado");
  }
});

export const requireRole = (...roles: Array<"admin" | "worker" | "client">) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenError(
        `Acceso restringido a: ${roles.join(", ")}`
      );
    }
    await next();
  });
