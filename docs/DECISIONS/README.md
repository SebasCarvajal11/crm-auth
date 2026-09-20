# Architecture Decision Records (ADRs): `crm-auth`

Este directorio contiene los registros de decisiones arquitectónicas que fundamentan el diseño de seguridad, persistencia y autenticación en `crm-auth`.

---

## Índice de Decisiones

| ADR | Título | Estado | Fecha |
| :--- | :--- | :--- | :--- |
| [**ADR-001**](./ADR-001-asymmetric-jwt-and-jwks.md) | Autenticación Basada en Tokens Asimétricos (RS256) y Publicación JWKS | Aceptado | 2026-05-15 |
| [**ADR-002**](./ADR-002-refresh-token-rotation.md) | Rotación Estricta de Refresh Tokens y Detección de Reutilización | Aceptado | 2026-06-01 |
| [**ADR-003**](./ADR-003-transactional-outbox.md) | Publicación Segura de Eventos mediante Patrón Transactional Outbox | Aceptado | 2026-06-15 |
| [**ADR-004**](./ADR-004-audit-log-partitioning.md) | Particionamiento Mensual de la Tabla de Auditoría de Seguridad | Aceptado | 2026-07-01 |
