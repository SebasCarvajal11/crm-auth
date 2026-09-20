# Base de Datos y Persistencia: `crm-auth`

Este documento detalla el diseño relacional, el esquema en PostgreSQL (`schema_auth`), la configuración de Drizzle ORM y las políticas de migración sin downtime.

---

## 1. Esquema Dedicado: `schema_auth`

Siguiendo el principio de aislamiento de microservicios, `crm-auth` opera exclusivamente sobre el esquema `schema_auth` dentro de la base de datos compartida `crm_database`. Ningún otro servicio tiene permisos de escritura en este esquema.

### Catálogo de Tablas

| Tabla | Propósito | Índices / Restricciones Clave |
| :--- | :--- | :--- |
| **`users`** | Identidades y credenciales de acceso. | `email` (UNIQUE), `subject` (UNIQUE, UUIDv7). |
| **`refresh_tokens`** | Sesiones activas y rotación. | `user_id` (FK $\rightarrow$ users), `family` (UUID), `token_hash`. |
| **`invitations`** | Invitaciones pendientes a clientes. | `token_hash` (UNIQUE), `email`, `expires_at`. |
| **`password_resets`** | Solicitudes de recuperación de clave. | `token_hash` (UNIQUE), `user_id`, `expires_at`. |
| **`email_verifications`** | Verificación de correos. | `token_hash` (UNIQUE), `user_id`. |
| **`identity_outbox`** | Eventos de identidad pendientes de publicación. | `id` (Bigserial PK), `published_at` (INDEX). |
| **`email_outbox`** | Correos pendientes de encolar en BullMQ. | `id` (Bigserial PK), `status`, `next_attempt_at`. |
| **`audit_logs`** | Registro inmutable de eventos de seguridad. | **Tabla particionada por mes** sobre `timestamp`. |
| **`schema_version`** | Registro histórico de migraciones aplicadas. | `version`, `applied_at`. |

---

## 2. Particionamiento Mensual de `audit_logs`

Para evitar la degradación de rendimiento por el crecimiento sostenido de los logs de auditoría:

- La tabla `schema_auth.audit_logs` está particionada de forma declarativa por rango de fechas sobre la columna `timestamp`.
- Las particiones siguen la convención `audit_logs_pYYYY_MM` (ej. `audit_logs_p2026_09`).
- Existe un script automatizado para proyectar y crear particiones futuras:
  ```bash
  pnpm db:ensure-audit-partitions
  ```

---

## 3. Procedimiento de Migración Sin Downtime (Expand & Contract)

Para soportar despliegues Blue/Green donde conviven simultáneamente dos versiones de la aplicación, las migraciones deben respetar estrictamente el patrón **Expand & Contract**:

```text
Fase 1: Expand (No Breaking)
  ├── Añadir nueva columna como NULLABLE o con DEFAULT
  ├── La nueva versión de la app escribe en ambas columnas
  └── Despliegue de la nueva versión completado

Fase 2: Backfill (En caliente)
  └── Migrar datos existentes en background de la columna vieja a la nueva

Fase 3: Contract (Limpieza)
  ├── El código pasa a leer y escribir únicamente de la nueva columna
  └── Solo tras retirar la versión antigua del servicio, se elimina la columna vieja
```

### Reglas Inviolables de Migración
1. **Nunca renombrar columnas en producción**: Utilizar el patrón de dos pasos (crear nueva, migrar, retirar).
2. **Nunca añadir columnas `NOT NULL` sin valor `DEFAULT`**.
3. **Idempotencia obligatoria**: Todo script de migración y bootstrap debe ser seguro de re-ejecutar múltiples veces (`IF NOT EXISTS`).

---

## 4. Scripts y Comandos de Base de Datos

| Comando | Descripción |
| :--- | :--- |
| `pnpm db:push` | Aplica cambios del esquema Drizzle directamente a la BD. |
| `pnpm db:bootstrap` | Inicializa extensiones, esquema y tablas base de forma idempotente. |
| `pnpm db:seed` | Carga identidades iniciales de prueba (admin, workers, clientes). |
| `pnpm db:studio` | Levanta interfaz visual Drizzle Studio para inspección local. |
| `pnpm db:ensure-audit-partitions` | Genera las particiones mensuales de auditoría para los próximos 3 meses. |
