## CRM Auth

Servicio de identidad y acceso de CIMA CRM.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Health check: `http://localhost:3000/health`

JWKS: `http://localhost:3000/.well-known/jwks.json`

## Workers

```bash
pnpm worker:email
pnpm worker:cleanup
```

Limpieza puntual de tokens:

```bash
pnpm cleanup:tokens
```

## Variables de entorno

Parte de `.env.example` y define al menos:

- `DATABASE_URL`
- `PORT`
- `REDIS_URL`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `JWT_KID`
- `TRUST_GATEWAY_JWT_HEADERS`
- `GATEWAY_TRUST_SECRET`
- `APP_PUBLIC_URL`
- `MAIL_FROM`
- `MAIL_TRANSPORT=smtp`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`
- `SMTP_TLS_SERVERNAME`
- `SMTP_USER`
- `SMTP_PASS`

## Base de datos

```bash
pnpm db:push
pnpm db:seed
pnpm db:studio
```

## Pruebas

```bash
pnpm build
pnpm test
pnpm test:rate-limit
```

Para los Hurl locales que requieren contraseñas temporales, usa `NODE_ENV=test` y `EXPOSE_TEMP_PASSWORDS=true` solo durante la ejecución de pruebas.
