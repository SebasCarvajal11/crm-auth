import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createAuthRoutes } from "./modules/auth/auth.routes";
import { createUsersAdminRoutes } from "./modules/users/users.routes";
import { createGatewayRoutes } from "./gateway/gateway.routes";
import { createOpenApiRoutes } from "./openapi/openapi.routes";
import { getJwksDocument } from "./config/jwt";
import { onError } from "./shared/middlewares/error-handler.middleware";
import type { AppEnv } from "./shared/middlewares/auth.middleware";
import { authMiddleware } from "./shared/middlewares/auth.middleware";
import { securityHeadersMiddleware } from "./shared/middlewares/security.middleware";
import { createUsersRepository } from "./modules/users/users.repository";
import { createAuthServices } from "./modules/auth/auth.service";
import { createEmailJobPublisher } from "./queues/email.queue";
import { getRedisConnection } from "./shared/redis";
import { checkPostgres, checkRedis } from "./shared/health";
import { buildHealthResponse } from "@sebascarvajal11/cima-contracts/health";
import {
  createServiceMetrics,
  metricsEndpointHandler,
  httpMetricsMiddleware,
  type ServiceMetrics,
} from "@sebascarvajal11/cima-contracts/metrics";
import { env } from "./config/env";
import { pool } from "./db/connection";
import { initLogger } from "./shared/logger";
import { requestLoggerMiddleware } from "./shared/middlewares/request-logger.middleware";

const logger = initLogger("mod-auth");
const mailPublisher = createEmailJobPublisher();
const authServices = createAuthServices(createUsersRepository(), mailPublisher);
const healthStartTime = Date.now();

/** Instancia de métricas compartida con los workers de este proceso. */
export const serviceMetrics: ServiceMetrics = createServiceMetrics("crm-auth");

export const createApp = () => {
  const app = new Hono<AppEnv>();

  // --- Middlewares Globales ---
  app.use("*", requestLoggerMiddleware());
  app.use("*", securityHeadersMiddleware);
  app.use("*", httpMetricsMiddleware(serviceMetrics));
  app.use(
    "*",
    bodyLimit({
      maxSize: 1 * 1024 * 1024, // 1MB payload limit for Auth service
      onError: (c) => {
        return c.json({ error: "El tamaño del payload excede el límite de 1MB" }, 413);
      },
    })
  );

  if (env.MOD_AUTH_CORS) {
    app.use(
      "*",
      cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
      })
    );
  }

  // --- (a) Grupo de Rutas Públicas ---
  const publicRoutes = new Hono<AppEnv>();

  publicRoutes.get("/health", async (c) => {
    const [pg, redis] = await Promise.all([
      checkPostgres(pool),
      checkRedis(getRedisConnection()),
    ]);
    const { body, status } = buildHealthResponse(env.SERVICE_VERSION, healthStartTime, {
      db: pg,
      redis,
    });
    return c.json(body, status);
  });

  publicRoutes.get("/metrics", metricsEndpointHandler(serviceMetrics.registry));

  publicRoutes.get("/.well-known/jwks.json", (c) =>
    c.json(getJwksDocument(), 200, {
      "Cache-Control": "public, max-age=300",
    })
  );

  publicRoutes.route("/", createOpenApiRoutes());
  publicRoutes.route("/", createAuthRoutes(authServices));
  publicRoutes.route("/api/v1/auth", createAuthRoutes(authServices));
  
  app.route("/", publicRoutes);

  // --- (b) Grupo de Rutas Internas ---
  const internalRoutes = new Hono<AppEnv>();
  internalRoutes.route("/", createGatewayRoutes());
  
  app.route("/", internalRoutes);

  // --- (c) Grupo de Rutas Autenticadas (requieren JWT válido) ---
  const authenticatedRoutes = new Hono<AppEnv>();
  authenticatedRoutes.use("*", authMiddleware);
  
  authenticatedRoutes.route("/api/v1/auth/users", createUsersAdminRoutes(authServices.adminUserService));
  
  app.route("/", authenticatedRoutes);

  // --- Manejador Global de Errores ---
  app.onError(onError);

  // --- 404 ---
  app.notFound((c) => c.json({ error: "Ruta no encontrada" }, 404));

  return app;
};
