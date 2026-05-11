import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Raíz del paquete mod-auth (src/openapi → dos niveles; dist/src/openapi → tres niveles). */
function resolveModAuthRoot(): string {
  const fromSrcTree = join(__dirname, "..", "..");
  if (existsSync(join(fromSrcTree, "openapi", "openapi.yaml"))) return fromSrcTree;
  const fromDistTree = join(__dirname, "..", "..", "..");
  if (existsSync(join(fromDistTree, "openapi", "openapi.yaml"))) return fromDistTree;
  const cwd = process.cwd();
  if (existsSync(join(cwd, "openapi", "openapi.yaml"))) return cwd;
  return cwd;
}

const OPENAPI_REL = join("openapi", "openapi.yaml");

const swaggerUiHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>mod-auth — OpenAPI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" crossorigin />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: window.location.origin + "/openapi.yaml",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
      });
    };
  </script>
</body>
</html>`;

export const createOpenApiRoutes = () => {
  const routes = new Hono();

  routes.get("/openapi.yaml", (c) => {
    const root = resolveModAuthRoot();
    const path = join(root, OPENAPI_REL);
    if (!existsSync(path)) {
      return c.json({ error: "No se encontró openapi/openapi.yaml" }, 404);
    }
    const buf = readFileSync(path);
    return c.body(buf, 200, {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    });
  });

  routes.get("/docs", (c) => {
    return c.html(swaggerUiHtml);
  });

  return routes;
};
