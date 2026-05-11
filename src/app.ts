import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersAdminRoutes } from "./modules/users/users.routes";
import { createOpenApiRoutes } from "./openapi/openapi.routes";
import { getJwksDocument } from "./config/jwt";
import { onError } from "./shared/middlewares/error-handler.middleware";
import type { AppEnv } from "./shared/middlewares/auth.middleware";

export const createApp = () => {
  const app = new Hono<AppEnv>();

  // --- Middlewares Globales ---
  app.use("*", logger());
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

  // --- Rutas ---
  app.route("/auth", authRoutes);
  app.route("/users", usersAdminRoutes);

  // --- JWKS (clave pública RS256 para KrakenD / otros microservicios) ---
  app.get("/.well-known/jwks.json", (c) =>
    c.json(getJwksDocument(), 200, {
      "Cache-Control": "public, max-age=300",
    })
  );

  // --- Health Check ---
  app.get("/health", (c) => c.json({ status: "ok", service: "mod-auth" }));

  // --- Manejador Global de Errores ---
  app.onError(onError);

  // --- 404 ---
  app.notFound((c) => c.json({ error: "Ruta no encontrada" }, 404));

  return app;
};
