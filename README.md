# CRM Auth

> Servicio de identidad y acceso para CIMA CRM.

## Propósito

`crm-auth` es la única fuente de verdad para identidad en la plataforma CIMA CRM. Gestiona autenticación, ciclo de vida de sesiones, flujos de invitación, recuperación de contraseña, emisión de JWTs y auditoría de accesos. Ningún otro servicio tiene autoridad sobre credenciales o identidad de usuarios.

## Entorno

```bash
cp .env.example .env
# Completar: DATABASE_URL, REDIS_URL, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_KID
```

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | Conexión PostgreSQL (`schema_auth`) | ✅ |
| `REDIS_URL` | Redis para stream de identidad y BullMQ | ✅ |
| `JWT_PRIVATE_KEY` | Clave RSA privada para firmar JWTs | ✅ |
| `JWT_PUBLIC_KEY` | Clave RSA pública (derivada de la privada) | ✅ |
| `JWT_KID` | Key ID del par RSA activo | ✅ |
| `SERVICE_VERSION` | Versión semver del servicio | ✅ |
| `SMTP_*` | Configuración de transporte de email | Opcional |

Ver [`.env.example`](./.env.example) para la lista completa.

## Local

```bash
pnpm install
pnpm db:push             # aplicar migraciones Drizzle
pnpm dev                 # servidor con hot-reload en :3000
```

Endpoints útiles:

- Health: `http://localhost:3000/api/v1/health`
- Métricas: `http://localhost:3000/api/v1/metrics`
- JWKS: `http://localhost:3000/api/v1/.well-known/jwks.json`
- OpenAPI: `http://localhost:3000/api/v1/openapi.yaml`

Workers (procesos separados):

```bash
pnpm worker:email            # envío de emails transaccionales (BullMQ)
pnpm worker:identity-outbox  # publica eventos de identidad a Redis Stream
pnpm worker:cleanup          # limpieza de tokens expirados
```

Utilidades:

```bash
pnpm jwt:gen-keys            # generar nuevo par RSA
pnpm db:seed                 # poblar DB con datos de prueba
pnpm test:rate-limit         # test de límite de velocidad
```

## Deploy

```bash
# Desde crm-infra/
./deploy/remote/deploy-component.sh auth
```

El script aplica migraciones, rota el slot inactivo (blue/green) y verifica health antes del cutover. Ver [crm-infra/ONBOARDING.md](../crm-infra/ONBOARDING.md).

## Tests

```bash
pnpm test:unit    # unitarios Vitest (validadores Zod, lógica pura)
pnpm test         # contrato Hurl contra gateway (requiere stack local)
```

Cobertura mínima: validadores, flujos de login/refresh/logout, contrato HTTP por endpoint público.

## Contrato público

- OpenAPI: [`openapi/openapi.yaml`](./openapi/openapi.yaml)
- Gateway manifest: [`gateway/gateway.manifest.json`](./gateway/gateway.manifest.json)
