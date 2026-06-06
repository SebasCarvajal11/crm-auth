import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthRoutes } from "./modules/auth/auth.routes";
import { createUsersAdminRoutes } from "./modules/users/users.routes";
import { createGatewayRoutes } from "./gateway/gateway.routes";
import { createOpenApiRoutes } from "./openapi/openapi.routes";
import { getJwksDocument } from "./config/jwt";
import { onError } from "./shared/middlewares/error-handler.middleware";
import type { AppEnv } from "./shared/middlewares/auth.middleware";
import { createUsersRepository } from "./modules/users/users.repository";
import { createAuthServices } from "./modules/auth/auth.service";
import { createEmailJobPublisher } from "./queues/email.queue";
import { getRedisConnection } from "./shared/redis";
import { checkPostgres, checkRedis, buildHealthResponse } from "./shared/health";
import { pool } from "./db/connection";
import { initLogger } from "./shared/logger";
import { requestLoggerMiddleware } from "./shared/middlewares/request-logger.middleware";

const logger = initLogger("mod-auth");
const mailPublisher = createEmailJobPublisher();
const authServices = createAuthServices(createUsersRepository(), mailPublisher);
const healthStartTime = Date.now();

export const createApp = () => {
  const app = new Hono<AppEnv>();

  // --- Middlewares Globales ---
  app.use("*", requestLoggerMiddleware());
  /**
   * CORS solo en el API Gateway (KrakenD) para el SPA. Si habilitamos cors aquí también,
   * el navegador recibe cabeceras duplicadas (`Access-Control-Allow-Credentials: true, true`)
   * y bloquea la petición con credentials: 'include'.
   * Activa `MOD_AUTH_CORS=true` solo si llamas al backend directamente en :3000 desde el navegador.
   */
  if (process.env.MOD_AUTH_CORS === "true") {
    app.use(
      "*",
      cors({
        origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
        credentials: true,
      })
    );
  }

  // --- OpenAPI + Swagger UI ---
  app.route("/", createOpenApiRoutes());
  app.route("/", createGatewayRoutes());

  // --- API v1 routes ---
  const v1 = new Hono();
  v1.route("/auth", createAuthRoutes(authServices));
  v1.route("/auth/users", createUsersAdminRoutes(authServices.adminUserService));
  app.route("/api/v1", v1);

  // --- Rutas legacy (backward compatibility) ---
  app.route("/auth", createAuthRoutes(authServices));
  app.route("/users", createUsersAdminRoutes(authServices.adminUserService));

  // --- JWKS (clave pública RS256 para KrakenD / otros microservicios) ---
  app.get("/.well-known/jwks.json", (c) =>
    c.json(getJwksDocument(), 200, {
      "Cache-Control": "public, max-age=300",
    })
  );

  // --- Health Check ---
  app.get("/health", async (c) => {
    const [pg, redis] = await Promise.all([
      checkPostgres(pool),
      checkRedis(getRedisConnection()),
    ]);

    const { body, status } = buildHealthResponse("mod-auth", healthStartTime, [pg, redis]);
    return c.json(body, status);
  });

  // --- Manejador Global de Errores ---
  app.onError(onError);

  // --- 404 ---
  app.notFound((c) => c.json({ error: "Ruta no encontrada" }, 404));

  return app;
};
