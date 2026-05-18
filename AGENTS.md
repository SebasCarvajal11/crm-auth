# AGENTS

## Purpose

`crm-auth` is the identity and access service for CIMA CRM. It owns authentication, session lifecycle, invitation flows, password recovery, JWT issuance, JWKS exposure, and auth-related audit logging. It must remain the single source of truth for identity concerns.

## System Boundaries

- Owns login, refresh, logout, password reset, profile identity, worker registration, and client invitation flows.
- Owns JWT issuance and JWKS publication.
- Owns auth-side audit logs, refresh tokens, invitations, and email verification state.
- May publish trust headers for internal platform traffic, but must not absorb gateway, collaboration, or media business rules.

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
