# CRM Auth Service

> Servicio de identidad, credenciales y control de acceso para CIMA CRM.

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Platform](https://img.shields.io/badge/platform-CIMA%20CRM-blue.svg)]()
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

---

## Propósito

`crm-auth` es la **única fuente de la verdad para identidad** en la plataforma CIMA CRM. Gestiona el ciclo de vida completo de usuarios, autenticación mediante credenciales, emisión de Access Tokens asimétricos (RS256), rotación de Refresh Tokens en cookies `httpOnly`, flujos de invitación de clientes y registro de auditoría de seguridad.

---

## Documentación Detallada (`docs/`)

Para consultar las especificaciones técnicas completas y guías de arquitectura, visita la suite documental:

- [**Guía de Arquitectura (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md): Diseño en capas, ciclo de vida de procesos y workers en background.
- [**Modelo de Dominio (`docs/DOMAIN.md`)**](./docs/DOMAIN.md): Roles de usuario, flujos de invitación, bloqueo por fuerza bruta y reglas CIMA.
- [**Contratos de API (`docs/API.md`)**](./docs/API.md): Catálogo de endpoints, KrakenD Gateway, formato de errores y JWKS.
- [**Base de Datos y Persistencia (`docs/DATABASE.md`)**](./docs/DATABASE.md): Esquema PostgreSQL `schema_auth`, Drizzle ORM y migraciones Expand & Contract.
- [**Seguridad y Criptografía (`docs/SECURITY.md`)**](./docs/SECURITY.md): Llaves RSA256, detección de robo de refresh tokens y cifrado de outbox.
- [**Integraciones y Plataforma (`docs/INTEGRATIONS.md`)**](./docs/INTEGRATIONS.md): Eventos en Redis Streams, colas BullMQ y observabilidad con Prometheus/Loki.
- [**Estrategia de Pruebas (`docs/TESTING.md`)**](./docs/TESTING.md): Pruebas unitarias Vitest, pruebas de contrato y suites Hurl E2E.
- [**Decisiones Arquitectónicas (`docs/DECISIONS/`)**](./docs/DECISIONS/): Registros formales de decisiones (ADRs).

---

## Inicio Rápido Local

### 1. Configuración de Entorno
```bash
cp .env.example .env
# Configurar secretos locales o ejecutar pnpm setup:env desde crm-infra
```

### 2. Instalación y Puesta en Marcha
```bash
pnpm install
pnpm db:bootstrap             # inicializar esquema y extensiones
pnpm db:push                  # sincronizar esquema Drizzle
pnpm dev                      # servidor con hot-reload en http://localhost:3000
```

### 3. Workers de Background (Procesos Independientes)
```bash
pnpm worker:email             # envío de correos transaccionales (BullMQ)
pnpm worker:identity-outbox   # despachador de eventos a Redis Streams
pnpm worker:cleanup           # purga de tokens y sesiones expiradas
```

---

## Pruebas y Validación de Calidad

```bash
pnpm test:unit                # pruebas unitarias aisladas (Vitest)
pnpm test                     # pruebas de contrato e integración Hurl vía Gateway
pnpm lint                     # validación estricta de estilo y linter
pnpm typecheck                # verificación estricta de tipos TypeScript
pnpm gateway:validate         # comprueba paridad entre OpenAPI y Gateway Manifest
```

---

## Despliegue en Producción

El despliegue está automatizado mediante GitHub Actions y orquestado por el script canónico de slots Blue/Green:

```bash
# Desde crm-infra/
./deploy/remote/deploy-component.sh auth
```
