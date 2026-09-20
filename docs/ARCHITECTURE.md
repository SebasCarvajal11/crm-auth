# Arquitectura del Sistema: `crm-auth`

Este documento describe la organización estructural, los patrones de diseño y los componentes de tiempo de ejecución del microservicio `crm-auth`.

---

## 1. Estilo Arquitectónico y Separación de Responsabilidades

El servicio implementa una arquitectura por capas desacoplada con inversión de dependencias:

```text
[ Cliente / KrakenD Gateway ]
            │ (HTTP REST / JSON)
            ▼
┌───────────────────────────────────────┐
│ Routes & Middlewares (Hono)           │ <- Validación Zod, CORS, Headers
└──────────────────┬────────────────────┘
                   ▼
┌───────────────────────────────────────┐
│ Controllers                           │ <- Adaptación HTTP, status codes, cookies
└──────────────────┬────────────────────┘
                   ▼
┌───────────────────────────────────────┐
│ Services                              │ <- Reglas de negocio de identidad (Puro)
└──────────────────┬────────────────────┘
                   ▼
┌───────────────────────────────────────┐
│ Repositories                          │ <- Drizzle ORM / PostgreSQL
└───────────────────────────────────────┘
```

- **Routes (`src/modules/*/routes.ts`)**: Definen endpoints, middlewares de autenticación y validación estricta de esquemas Zod en los límites de entrada.
- **Controllers (`src/modules/*/controller.ts`)**: Delgados y deterministas. Extraen parámetros, delegan en servicios y mapean resultados a respuestas HTTP.
- **Services (`src/modules/*/service.ts`)**: Contienen la lógica de negocio nuclear (emisión de tokens, verificación de hashes, rotación, validación de estado de cuenta). No dependen de objetos HTTP (`Request`/`Response`).
- **Repositories (`src/modules/*/repository.ts`)**: Encapsulan las operaciones sobre la base de datos PostgreSQL (`schema_auth`).

---

## 2. Organización del Código

```text
src/
├── config/              # Carga y validación estricta de entorno (env.ts), llaves JWT
├── db/                  # Esquema Drizzle (schema.ts), conexión y scripts de seed
├── email/               # Plantillas y transportes de correos transaccionales
├── modules/
│   ├── auth/            # Módulo de autenticación (login, refresh, logout, password)
│   └── users/           # Módulo de administración de usuarios y perfiles
├── queues/              # Definiciones BullMQ para encolamiento asíncrono
├── shared/              # Utilidades compartidas, middlewares y sanitización
├── workers/             # Procesos de fondo independientes (Outbox, Cleanup, Email)
├── app.ts               # Ensamblado de la aplicación Hono y middlewares globales
└── server.ts            # Entrypoint HTTP principal con manejo de graceful shutdown
```

---

## 3. Procesos en Background y Workers

Para garantizar alta concurrencia y transacciones ACID sin bloqueos de I/O, las tareas pesadas o asíncronas se desacoplan en cuatro workers independientes:

| Worker | Comando | Responsabilidad | Dependencias |
| :--- | :--- | :--- | :--- |
| **Email Worker** | `pnpm worker:email` | Procesa y despacha correos vía BullMQ hacia el servidor SMTP. | Redis (`email-queue`), SMTP |
| **Email Outbox Worker** | `pnpm worker:email-outbox` | Polling transaccional de `email_outbox` en DB para encolar en BullMQ. | PostgreSQL (`schema_auth`), Redis |
| **Identity Outbox Worker**| `pnpm worker:identity-outbox` | Publica eventos de identidad hacia Redis Stream (`stream:auth.identity`). | PostgreSQL (`schema_auth`), Redis |
| **Token Cleanup Worker** | `pnpm worker:cleanup` | Purga periódica de tokens de sesión expirados o revocados. | PostgreSQL (`schema_auth`) |

### Ciclo de Vida y Graceful Shutdown
- **Detección de Salud**: Cada worker escribe un archivo de latido en `/tmp/worker-healthy` cada 15 segundos, verificado por Docker vía [`docker-healthcheck.sh`](file:///d:/BACKUP%20CELULAR%20OLIMPO/crm-auth/docker-healthcheck.sh).
- **Apagado Seguro**: Ante señales `SIGINT` o `SIGTERM`, el servicio detiene la recepción de nuevas tareas, espera el fin de las operaciones en vuelo, cierra conexiones de Redis y base de datos, y termina limpiamente sin pérdida de datos.

---

## 4. Patrones Retirados (Anti-patrones Prohibidos)

Para preservar la integridad arquitectónica, se prohíbe reintroducir los siguientes patrones legados:

- **BFF Dedicado (`crm-bff`)**: El servicio BFF fue eliminado completamente de la plataforma el 2026-06-01. El frontend interactúa directamente a través del API Gateway KrakenD.
- **Secreto Compartido Gateway (`GATEWAY_TRUST_SECRET`)**: Retirado el 2026-05-15. La autenticación inter-servicios se basa estrictamente en la validación asimétrica mediante JWKS.
- **Hidratación HTTP Síncrona (`/bootstrap-identities`)**: Retirada el 2026-05-01. Cualquier sincronización downstream se realiza asíncronamente mediante Redis Streams.
