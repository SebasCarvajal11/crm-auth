# Guía de Agentes: `crm-auth`

Este archivo es el **enrutador principal para Agentes de Inteligencia Artificial**. La documentación técnica y de negocio completa y detallada está modularizada dentro de la carpeta [`docs/`](./docs/README.md).

---

## Misión del Servicio

`crm-auth` es la **autoridad única e indiscutible sobre la identidad, credenciales y emisión de tokens** en CIMA CRM. Ningún otro servicio tiene potestad para gestionar contraseñas, emitir JWTs de usuario o alterar el estado de las cuentas.

---

## Enrutamiento Documental para Agentes

Antes de proponer o ejecutar cambios, consulta el documento especializado correspondiente a tu objetivo:

| Si tu tarea involucra... | Consulta este documento |
| :--- | :--- |
| Comprender la arquitectura en capas, controllers, services y workers | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Entender roles (`admin`, `worker`, `client`), invitaciones y reglas CIMA | [`docs/DOMAIN.md`](./docs/DOMAIN.md) |
| Crear, modificar o auditar endpoints y contratos OpenAPI | [`docs/API.md`](./docs/API.md) |
| Modificar tablas, modelos Drizzle o ejecutar migraciones sin downtime | [`docs/DATABASE.md`](./docs/DATABASE.md) |
| Ajustar criptografía RSA256, JWKS, refresh tokens o rate-limits | [`docs/SECURITY.md`](./docs/SECURITY.md) |
| Conectar con Redis Streams (`stream:auth.identity`), BullMQ o KrakenD | [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md) |
| Escribir o ejecutar pruebas unitarias, de contrato o suites Hurl | [`docs/TESTING.md`](./docs/TESTING.md) |
| Entender el porqué de las decisiones técnicas estructurales (ADRs) | [`docs/DECISIONS/`](./docs/DECISIONS/) |

---

## Reglas Inviolables para Agentes de IA

1. **Gestor Único**: Utiliza **exclusivamente `pnpm`**. Está terminantemente prohibido usar `npm` o generar archivos `package-lock.json`.
2. **Cero Secretos**: Nunca escribas ni persistas claves privadas RSA, contraseñas ni credenciales SMTP en el repositorio.
3. **Migraciones Expand & Contract**: Todo cambio en base de datos debe ser retrocompatible y no destructivo para soportar despliegues Blue/Green sin downtime.
4. **Validación Temprana**: Todo nuevo parámetro de configuración debe registrarse en `src/config/env.ts` con validación estricta y falla inmediata (*fail-fast*).
5. **Aislamiento de Pruebas**: Nunca alteres ni elimines usuarios de desarrollo. Las pruebas automatizadas deben usar identidades bajo el dominio `@hurl.test`.
