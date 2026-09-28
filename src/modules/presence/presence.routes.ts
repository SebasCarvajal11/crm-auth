import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, requireRole, type AppEnv } from "../../shared/middlewares/auth.middleware";
import type { PresenceService } from "./presence.service";
import { PresenceQuerySchema } from "./presence.schemas";
import { identityRateLimit } from "../../shared/middlewares/rate-limit.middleware";

export function createPresenceRoutes(service: PresenceService) {
  const routes = new Hono<AppEnv>();
  routes.use("*", authMiddleware);
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  routes.post("/heartbeat", identityRateLimit({ maxAttempts: 12, windowMs: 60_000 }), async (c) => c.json({ data: await service.heartbeat(c.get("user").userId) }));
  routes.get("/", requireRole("admin"), identityRateLimit({ maxAttempts: 30, windowMs: 60_000 }), zValidator("query", PresenceQuerySchema), async (c) =>
    c.json({ data: await service.list(c.get("user").userId, c.req.valid("query")) }));
  return routes;
}
