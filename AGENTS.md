# AGENTS

## Purpose

`crm-auth` is the identity and access service for CIMA CRM. It owns authentication, session lifecycle, invitation flows, password recovery, JWT issuance, JWKS exposure, and auth-related audit logging. It must remain the single source of truth for identity concerns.

## System Boundaries

- Owns login, refresh, logout, password reset, profile identity, worker registration, and client invitation flows.
- Owns JWT issuance and JWKS publication.
- Owns auth-side audit logs, refresh tokens, invitations, and email verification state.
- May publish trust headers for internal platform traffic, but must not absorb gateway, collaboration, or media business rules.

## Fronteras con otros servicios

- **Upstream**: Ninguno (es la fuente única de verdad para la identidad y credenciales).
- **Downstream**: `crm-collab`, `crm-media` (consumidores de su JWKS para validación de tokens), y `crm-frontend` (consume flujos de login y perfil).
- **Pares**: `crm-collab`, `crm-media` (a través de eventos de identidad en `stream:auth.identity`).
- **Recursos Compartidos**: PostgreSQL (`schema_auth` schema) y Redis (para `stream:auth.identity` y BullMQ `email-queue`).
- **Fuera de mi responsabilidad**: Lógica de gestión de proyectos, membresías de colaboración, almacenamiento de archivos físicos en OCI Object Storage, antivirus, composición BFF para vistas agregadas.

## Architecture Rules

- Preserve separation between routes/controllers, services, repositories, workers, and infrastructure.
- Keep controllers thin and deterministic. Business decisions belong in services; persistence belongs in repositories.
- JWT, session, password, and invitation logic must stay explicit and auditable. Avoid hidden side effects.
- Email delivery, queues, and background cleanup are infrastructure concerns and should remain isolated from request handlers.
- Security-sensitive behavior must prefer fail-fast validation over permissive defaults.

## Code Organization

- `src/modules/auth`: auth flows, session logic, profile/password logic, invitation entrypoints, and related orchestration.
- `src/modules/users`: user-facing persistence and supporting repository structure.
- `src/workers`, `src/queues`, `src/email`: background processing and delivery concerns.
- `src/config`: runtime configuration and JWT setup.
- `src/db`: schema, seed, and database scripts owned by this service.
- `openapi/`: published API contract for this repo.
- `tests/`: Hurl-based contract and behavior checks.

## Security and Operational Rules

- Never commit real JWT private keys, SMTP credentials, cookies, or production secrets.
- Treat refresh-token, password-reset, invitation, and trust-header flows as high-risk code paths. Changes must preserve least privilege and explicit validation.
- Gateway trust integration must never weaken direct JWT verification without a deliberate architectural decision.
- Keep test-only behaviors clearly isolated from normal runtime configuration.

## Development Rules

- Use `pnpm` only. Never add `npm` commands, lockfiles, or documentation.
- Keep documentation minimal: only `README.md` and this file.
- Preserve or improve the Hurl suite when modifying external behavior.
- If new auth capabilities are added, document their boundaries and invariants here instead of scattering operational notes around the repo.

## Workers and Background Processes

`crm-auth` manages three background workers executed as isolated processes:

1. **Email Worker** (`pnpm worker:email`): Handles outbound transactional emails via BullMQ.
   - *Dependencies*: Redis (connection URL, prefix: `auth`, queue: `email-queue`).
2. **Identity Outbox Worker** (`pnpm worker:identity-outbox`): Polling publisher that processes identity outbox table events.
   - *Dependencies*: PostgreSQL (`schema_auth` schema, `identity_outbox` table), Redis (publishes to `stream:auth.identity`).
3. **Token Cleanup Worker** (`pnpm worker:cleanup`): Triggers scheduled cleanup of expired tokens.
   - *Dependencies*: PostgreSQL (`schema_auth` schema).

### Healthcheck and Graceful Shutdown
- **Healthcheck**: Workers write their status and dependencies health report to `/tmp/worker-healthy` every 15 seconds. Checked inside Docker using `docker-healthcheck.sh`.
- **Graceful Shutdown (Draining)**: Workers catch `SIGINT` and `SIGTERM` signals. They close active subscriptions (e.g. `worker.close()`), stop tick timers, disconnect Redis/Postgres clients, and then exit.

## Configuration and Environment Variables

- **Contract Source of Truth**: The sole source of truth for the service configuration contract is [.env.example](file:///D:/BACKUP CELULAR OLIMPO/crm-auth/.env.example). No production secrets or specific environment parameters should be committed.
- **Fail-Fast Validation**: All environment variables are parsed and validated at startup using `src/config/env.ts`. The process will exit immediately with code 1 if any required environment variable is missing or malformed.
- **Deployment Injection**: Production variables are injected dynamically from a secure orchestrator into `.env` or the container environment at deployment time.

## Testing Levels and Isolation

- **Nivel 1: Pruebas Unitarias** (`pnpm test:unit`): Pruebas aisladas de funciones puras, validadores de esquemas y lógica que no interactúa con bases de datos ni redes. Se ejecutan en aislamiento total en el pipeline del microservicio.
- **Nivel 2: Pruebas de Contrato Local**: Pruebas de integración locales que requieren únicamente la base de datos (esquema `schema_auth`) y Redis local, sin levantar otros microservicios de la plataforma.
- **Nivel 3: Pruebas de Integración Cruzada** (`pnpm test`): Pruebas Hurl de extremo a extremo que validan la API Gateway y requieren que el microservicio esté en funcionamiento junto con su infraestructura. Son orquestadas a nivel de plataforma por `crm-infra` en ejecuciones temporales limpias.


## Database Schema Migration Procedure (Expand & Contract)

To ensure zero-downtime deployments where old and new versions of a service run concurrently (such as during Blue/Green deployments), database migrations must never contain breaking changes:

1. **Non-Breaking Changes Only**: Every migration must be backward-compatible. Do not rename columns, remove columns, or add non-nullable columns without default values.
2. **Adding a Column (Expand)**:
   - Add the column as nullable or with a default value.
   - Deploy the new service version to write to both the old and new columns, or migrate data in the background.
3. **Changing a Column/Type**:
   - Create a new column with the target type.
   - Update the code to read/write to both columns.
   - Run a background script to backfill data from the old column to the new column.
   - Update the code to read from the new column only.
4. **Removing/Renaming a Column (Contract)**:
   - Mark the column as deprecated in the schema code (e.g., comments).
   - Deploy code that does not reference the old column name.
   - Once the old code is completely retired, run a cleanup migration to drop/rename the column.

## Observabilidad

- **Health**: `GET /api/v1/health` — estado de DB y Redis. Devuelve `{ status, version, uptimeSec, dependencies }`.
- **Métricas**: `GET /api/v1/metrics` — Prometheus text/plain (prom-client). Incluye:
  - `http_requests_total`, `http_request_duration_seconds`, `http_errors_5xx_total`
  - `worker_outbox_depth{worker="identity-outbox"}` — pendientes en `identity_outbox` DB
  - Métricas de Node.js por defecto (heap, event loop lag, GC)
- **Logs**: pino → Loki via promtail (label `service=crm-auth`)
- **Dashboard**: Grafana http://localhost:13000 → "CIMA CRM — Overview"

## Patrones retirados

| Patrón | Retirado | Motivo |
|--------|----------|--------|
| HTTP Identity Hydration (`/bootstrap-identities`) | 2026-05-01 | Reemplazado por replay-request stream |
| `GATEWAY_TRUST_SECRET` / `gatewayTrustMiddleware` | 2026-05-15 | Eliminado; validación JWKS directa |
| `crm-bff` como downstream | 2026-06-01 | `crm-bff` fue eliminado del stack |
