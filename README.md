# CRM Auth

`crm-auth` is the identity and access service for CIMA CRM.

## Scope

- login, refresh, logout, and profile identity
- worker registration and client invitation flows
- password reset and email verification
- JWT issuance and JWKS exposure
- auth audit logging and session/token lifecycle

## Local Development

```bash
pnpm install
pnpm db:push
pnpm dev
```

Useful commands:

- `pnpm worker:email`
- `pnpm worker:cleanup`
- `pnpm cleanup:tokens`
- `pnpm db:seed`
- `pnpm build`
- `pnpm test`
- `pnpm test:rate-limit`

Health check: `http://localhost:3000/health`

JWKS: `http://localhost:3000/.well-known/jwks.json`

## Environment

Start from [`./.env.example`](./.env.example).

Required runtime areas:

- database connectivity
- JWT key material and `JWT_KID`
- optional Redis for queue-backed email delivery
- gateway trust settings when the service participates in trusted internal flows
- public app URL and mail transport settings

## Contract and Verification

- OpenAPI source: [`./openapi/openapi.yaml`](./openapi/openapi.yaml)
- Hurl contract tests live under `tests/`

For local Hurl runs that rely on temporary-password exposure, use test-only settings such as `NODE_ENV=test` and `EXPOSE_TEMP_PASSWORDS=true` only for the test execution window.
