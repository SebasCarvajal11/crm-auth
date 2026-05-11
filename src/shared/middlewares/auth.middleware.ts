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

/**
 * KrakenD ya validó el JWT e inyectó claims; si `TRUST_GATEWAY_JWT_HEADERS` y `X-Gateway-Trust`
 * coinciden con `GATEWAY_TRUST_SECRET`, evitamos una segunda verificación RS256 en mod-auth.
 */
function payloadFromTrustedGateway(c: {
  req: { header: (name: string) => string | undefined };
}): JwtPayload | null {
  if (!env.TRUST_GATEWAY_JWT_HEADERS || !env.GATEWAY_TRUST_SECRET) {
    return null;
  }
  if (c.req.header("X-Gateway-Trust") !== env.GATEWAY_TRUST_SECRET) {
    return null;
  }

  const sub = c.req.header("X-User-Sub")?.trim();
  const userId = c.req.header("X-User-Id")?.trim();
  const roleRaw = c.req.header("X-User-Role")?.trim();
  const email = c.req.header("X-User-Email")?.trim();
  const expHeader = c.req.header("X-Token-Exp")?.trim();

  if (!sub || !userId || !roleRaw || !email) {
    return null;
  }
  if (!isRole(roleRaw)) {
    return null;
  }

  let exp = expHeader ? Number.parseInt(expHeader, 10) : Number.NaN;
  if (!Number.isFinite(exp)) {
    exp = Math.floor(Date.now() / 1000) + 900;
  }

  const forceRaw = c.req.header("X-User-Force-Pwd")?.trim().toLowerCase();

  return {
    sub,
    userId,
    role: roleRaw,
    email,
    exp,
    ...(forceRaw === "true" ? { force_password_change: true } : {}),
  };
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const trusted = payloadFromTrustedGateway(c);
  if (trusted) {
    c.set("user", trusted);
    await next();
    return;
  }

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
