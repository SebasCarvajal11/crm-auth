# Documentación Técnica: `crm-auth`

Bienvenido a la documentación oficial del microservicio de autenticación e identidad de **CIMA CRM** (`crm-auth`). Este servicio es la **única fuente de la verdad** para la gestión de identidades, credenciales, sesiones y emisión de tokens criptográficos en la plataforma.

---

## Índice de Documentación

| Documento | Audiencia Principal | Descripción |
| :--- | :--- | :--- |
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | Arquitectos / Backend | Diseño en capas, ciclo de vida de procesos, workers en background y concurrencia. |
| [**DOMAIN.md**](./DOMAIN.md) | Negocio / Backend | Roles (`admin`, `worker`, `client`), ciclo de vida de cuentas, invitaciones y reglas CIMA. |
| [**API.md**](./API.md) | Frontend / Integraciones | Contratos HTTP, especificación OpenAPI, autenticación mediante cookies y JWKS. |
| [**DATABASE.md**](./DATABASE.md) | DBA / Backend | Esquema PostgreSQL `schema_auth`, Drizzle ORM, migraciones Expand & Contract y particionamiento. |
| [**SECURITY.md**](./SECURITY.md) | Seguridad / DevOps | Criptografía RSA256, rotación de tokens, mitigación de fuerza bruta y cifrado en reposo. |
| [**INTEGRATIONS.md**](./INTEGRATIONS.md) | Plataforma / DevOps | Integración con Redis Streams, colas BullMQ, API Gateway KrakenD y observabilidad. |
| [**TESTING.md**](./TESTING.md) | QA / Desarrolladores | Pirámide de pruebas: unitarias Vitest, validadores Zod, pruebas Hurl y aislamiento. |
| [**DECISIONS/**](./DECISIONS/) | Todo el equipo | Architecture Decision Records (ADRs) que justifican decisiones estructurales. |

---

## Guía Rápida de Navegación para Agentes de IA

Si eres un **agente autónomo**, consulta directamente el archivo correspondiente a tu objetivo:

- **Modificar o agregar un endpoint**: Consulta [`API.md`](./API.md) y [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Alterar el modelo de datos o tablas**: Consulta [`DATABASE.md`](./DATABASE.md) para cumplir el protocolo Expand & Contract.
- **Entender los permisos y roles de usuarios**: Consulta [`DOMAIN.md`](./DOMAIN.md).
- **Trabajar con colas o eventos hacia otros servicios**: Consulta [`INTEGRATIONS.md`](./INTEGRATIONS.md).
- **Ajustar lógica de tokens, cookies o seguridad**: Consulta [`SECURITY.md`](./SECURITY.md) y los [ADRs](./DECISIONS/).
- **Ejecutar o escribir pruebas**: Consulta [`TESTING.md`](./TESTING.md).

---

## Reglas Inviolables del Repositorio

1. **Gestor de Paquetes**: Únicamente `pnpm`. Nunca utilizar `npm` ni `yarn`.
2. **Cero Secretos en Código**: Jamás versionar claves privadas RSA, contraseñas ni secretos reales.
3. **Validación Fail-Fast**: Toda configuración de entorno debe validarse al arrancar mediante `src/config/env.ts`.
4. **Desacoplamiento Estricto**: `crm-auth` no debe absorber lógica de negocio de proyectos, archivos ni finanzas.
