# Estrategia de Pruebas: `crm-auth`

Este documento describe la pirámide de pruebas, los niveles de aislamiento, las herramientas utilizadas y el protocolo para verificar cambios en `crm-auth`.

---

## 1. Niveles de Pruebas y Aislamiento

```text
       ▲
      / \     Nivel 3: Pruebas E2E / Hurl (A través de KrakenD Gateway)
     /   \
    /─────\   Nivel 2: Pruebas de Integración Local (DB y Redis en Docker)
   /       \
  /─────────\ Nivel 1: Pruebas Unitarias Aisladas (Vitest, lógica pura, Zod)
```

### Nivel 1: Pruebas Unitarias (`pnpm test:unit`)
- **Herramienta**: Vitest.
- **Alcance**: Funciones puras, validadores Zod, formateadores de claims JWT, cálculo de expiración y lógica de negocio sin conexión a base de datos ni red.
- **Ejecución**: Se ejecutan en milisegundos en el pipeline de CI del servicio de forma completamente autocontenida.

### Nivel 2: Pruebas de Integración Local (`pnpm test:contract`)
- **Alcance**: Valida repositorios Drizzle contra PostgreSQL real (`schema_auth`) y colas de Redis.
- **Requisitos**: Solo requiere la infraestructura compartida local (`postgres_db` y `redis`), sin necesidad de levantar otros microservicios.

### Nivel 3: Pruebas de Integración Cruzada / Hurl (`pnpm test`)
- **Herramienta**: Hurl + KrakenD Gateway.
- **Alcance**: Ejecuta escenarios reales de usuario simulando peticiones HTTP externas hacia el Gateway:
  - Login exitoso $\rightarrow$ Validación de cabecera `Set-Cookie` y payload JWT.
  - Refresh rotation $\rightarrow$ Comprobación de revocación del token previo.
  - Bloqueo por fuerza bruta tras 5 intentos erróneos.
  - Aceptación de invitaciones y cambio de credenciales.

---

## 2. Aislamiento de Datos de Prueba (`hurl.test`)

Para evitar la corrupción o interferencia con las cuentas de desarrollo y demostración:

1. **Dominio Reservado**: Todas las identidades transitorias creadas por las pruebas deben pertenecer al dominio `@hurl.test` (ej. `gateway.worker.contract@hurl.test`).
2. **Invariante de No Mutación**: Los tests automatizados **jamás deben modificar ni eliminar cuentas operativas** (ej. `gerente@cima.dev` o `sebastian.ruiz@cima.dev`).
3. **Idempotencia y Limpieza**: Las suites de prueba deben limpiar o aislar su estado de manera que múltiples ejecuciones sucesivas arrojen el mismo resultado.

---

## 3. Catálogo de Comandos de Prueba y Validación

| Comando | Propósito | Entorno Requerido |
| :--- | :--- | :--- |
| `pnpm test:unit` | Ejecuta la suite de pruebas unitarias. | Ninguno (autocontenido) |
| `pnpm test:unit:coverage` | Genera reporte de cobertura de código. | Ninguno |
| `pnpm test` | Ejecuta la suite completa de contratos Hurl. | Docker stack activo |
| `pnpm test:rate-limit` | Verifica las políticas de límite de velocidad. | Docker stack activo |
| `pnpm openapi:check` | Valida la sintaxis del archivo `openapi.yaml`. | Ninguno |
| `pnpm gateway:validate` | Verifica consistencia entre OpenAPI y Gateway Manifest. | Ninguno |
| `pnpm lint` | Analiza cumplimiento de reglas ESLint. | Ninguno |
| `pnpm typecheck` | Comprueba tipos TypeScript sin emitir código. | Ninguno |
