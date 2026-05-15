## Desarrollo

```bash
pnpm install
pnpm dev
```

## Worker de correo

```bash
pnpm worker:email
```

## Variables de entorno

Parte de `mod-auth/.env.example` y define al menos:

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
- `PASSWORD_RESET_MIN_INTERVAL_MS`
- `PASSWORD_RESET_MAX_PER_DAY`

En Brevo sobre puerto `587`, usa `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true` y `SMTP_TLS_SERVERNAME=smtp-relay.sendinblue.com`.
