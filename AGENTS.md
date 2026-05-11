# AGENTS.md — mod-auth

> Microservicio de Identidad y Acceso para CRM CIMA. Lee esto ANTES de generar código.

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js + ESM |
| Framework | Hono (`@hono/node-server`) |
| Lenguaje | TypeScript (`strict: true`, `module: "ESNext"`, `moduleResolution: "bundler"`) |
| Base de datos | PostgreSQL, schema `schema_auth` |
| ORM | Drizzle ORM (`drizzle-orm`) |
| Validación | Zod + `@hono/zod-validator` |
| Colas | BullMQ + `ioredis` (email worker) |
| Email | nodemailer (SMTP o modo `log`) |
| Seguridad | bcrypt (factor 12), JWT RS256, JWKS |

## Responsabilidad

- Credenciales (login, logout, refresh rotation)
- JWT RS256 (firma, JWKS, claims)
- Invitaciones y registro de workers/clients
- Recuperación de contraseña
- Verificación de email
- Lockout por cuenta (8 intentos → 30min)
- Auditoría de seguridad (`audit_logs`)
- Listado admin de usuarios

**NO es responsable de:** perfiles de usuario, datos fiscales, CRM, proyectos, kanban. Eso es `mod-collab` u otros módulos.

## Arquitectura

```
routes → controller → service → repository → Drizzle → PostgreSQL
```

- **Routes:** Definen endpoints, montan middleware (Zod validation, auth, role check)
- **Controller:** Mapea HTTP request/response. Composición via factory functions.
- **Service:** Lógica de negocio + RBAC. Composición via spread de sub-factories.
- **Repository:** Único lugar con llamadas Drizzle. Agregado en `usersRepository`.

### Composición del servicio (`auth.service.ts`)

```typescript
createAuthService(repo, mailPublisher) → {
  ...createLoginSessionMethods(repo),
  ...createInvitationMethods(repo, mailPublisher),
  ...createWorkerRegistrationMethods(repo, mailPublisher),
  ...createPasswordMethods(repo, mailPublisher),
  ...createSessionListingMethods(repo),
  ...createEmailVerificationMethods(repo, mailPublisher),
  ...createAdminUserMethods(repo),
  ...createIdentityReadMethods(repo),
}
```

## Estructura de archivos

```
src/
├── server.ts                    # Bootstrap + graceful shutdown
├── app.ts                       # Hono app, CORS, routes, onError
├── config/
│   ├── env.ts                   # Zod env schema (TODAS las env vars aquí)
│   └── jwt.ts                   # RS256 sign/verify, JWKS document
├── db/
│   ├── connection.ts            # Pool + drizzle(pool, { schema })
│   ├── schema.ts                # 6 tablas en pgSchema("schema_auth")
│   └── seed.ts                  # Seeder de desarrollo
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts       # Definición de rutas + DI wiring
│   │   ├── auth.controller.ts   # Compositor (3 sub-controllers)
│   │   ├── auth.controller.*.ts # Sub-controllers por dominio
│   │   ├── auth.service.ts      # Compositor (8 sub-services)
│   │   ├── auth.service.*.ts    # Sub-services por dominio
│   │   ├── auth.schemas.ts      # Zod schemas + tipos inferidos
│   │   ├── auth.token-utils.ts  # JWT build, refresh token gen/hash
│   │   └── auth.constants.ts    # BCRYPT_ROUNDS, TTLs
│   └── users/
│       ├── users.routes.ts      # Admin user management routes
│       ├── users.controller.ts  # Admin controller
│       ├── users.repository.ts  # Aggregado (spread de 7 slices)
│       └── repository/          # 7 archivos Drizzle queries
├── shared/
│   └── middlewares/
│       ├── auth.middleware.ts    # authMiddleware + requireRole()
│       └── error-handler.middleware.ts  # AppError classes + onError
├── email/
│   ├── mailer.ts                # Transport + 4 tipos de email
│   └── transactional-email.types.ts
├── queues/
│   ├── email.queue.ts           # BullMQ Queue + fallback publisher
│   └── email.processor.ts       # Job handler
└── workers/
    └── email.worker.ts          # BullMQ Worker (proceso separado)
```

## Base de datos (6 tablas)

Todas en `pgSchema("schema_auth")`. Enum `roleEnum`: `admin | worker | client`.

| Tabla | Propósito |
|---|---|
| `users` | Identidad, credenciales, flags de cuenta |
| `refresh_tokens` | Tokens opacos (SHA-256 hash), family model |
| `invitations` | Invitaciones de client (token 32-byte hex) |
| `password_resets` | Tokens de reseteo (32-byte hex, 1hr TTL) |
| `email_verifications` | Tokens de verificación (48hr TTL) |
| `audit_logs` | Log de auditoría (PK compuesta para partición mensual) |

**Identity cross-service:** `users.subject` (UUID, unique) es el `sub` en JWT. Otros módulos vinculan por `sub`, no duplican auth.

## Variables de entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `DATABASE_URL` | Sí | — | PostgreSQL connection string |
| `JWT_PRIVATE_KEY` | Sí | — | PKCS#8 PEM RSA |
| `JWT_PUBLIC_KEY` | Sí | — | SPKI PEM RSA |
| `JWT_KID` | No | `mod-auth-rsa-1` | Key ID para JWKS |
| `REDIS_URL` | No | — | Redis para BullMQ (email queue) |
| `PORT` | No | `3000` | Puerto HTTP |
| `TRUST_GATEWAY_JWT_HEADERS` | No | `false` | Confía en headers X-User-* del gateway |
| `GATEWAY_TRUST_SECRET` | Si trust=true | — | Secreto compartido con KrakenD (min 32 chars) |
| `LOGIN_LOCKOUT_MAX_ATTEMPTS` | No | `8` | Intentos fallidos antes de lockout |
| `LOGIN_LOCKOUT_DURATION_MS` | No | `1800000` | Duración del lockout (30min) |
| `MAIL_TRANSPORT` | No | `log` | `smtp` o `log` (consola) |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |

## Reglas absolutas

### HACER SIEMPRE
- Validar payloads en el edge con `zValidator("json", Schema)`
- Usar Repository Pattern — TODAS las queries Drizzle en `repository/*.ts`
- Usar factory DI: `createAuthService(repo)`, `createAuthController(service)`
- Responder `{ data: {...} }` en éxito, `{ error: "..." }` en error
- Escribir `audit_logs` para acciones críticas (login, logout, invite, password change)
- Setear `updatedAt: new Date()` explícitamente en updates
- Importar `relations` de `"drizzle-orm"`, NO de `"drizzle-orm/pg-core"`

### NUNCA HACER
- Usar `any` — usar interfaces, `z.infer<>`, o `InferSelectModel`/`InferInsertModel`
- Poner llamadas Drizzle en controllers o services — solo en `repository/*.ts`
- Lanzar `new Error(...)` — siempre usar `AppError` subclasses
- Filtrar stack traces o errores raw de DB al cliente
- Crear tablas fuera de `pgSchema("schema_auth")`
- Almacenar el Refresh Token en texto plano — siempre SHA-256 hash
- Duplicar verificación de JWT en cada request sin gateway

### Clases de error disponibles
```typescript
BadRequestError(400) | UnauthorizedError(401) | ForbiddenError(403)
NotFoundError(404) | ConflictError(409) | TooManyRequestsError(429)
```

## Flujos de autenticación

1. **Login:** Valida credenciales → verifica lockout → emite access token (RS256, 15min) + refresh token (HttpOnly cookie, 7 días)
2. **Refresh:** Lee cookie → valida family → rota token (nuevo access + nuevo refresh) → revoca anterior
3. **Logout:** Revoca familia del refresh token actual
4. **Reuse detection:** Si un refresh token revocado es presentado → revoca toda la familia + audit log

## Scripts

| Comando | Propósito |
|---|---|
| `npm run dev` | Servidor con hot-reload |
| `npm start` | Producción |
| `npm run build` | Compilar a `./dist` |
| `npm run worker:email` | Worker BullMQ (proceso separado) |
| `npm run db:push` | Push schema a DB |
| `npm run db:generate` | Generar migración |
| `npm run db:seed` | Seed de desarrollo |
| `npm run jwt:gen-keys` | Generar par RSA para JWT |
| `npm test` | Tests Hurl (requiere DB corriendo) |
| `npm run test:rate-limit` | Test de rate limiting (requiere gateway) |
