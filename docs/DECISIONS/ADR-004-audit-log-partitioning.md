# ADR-004: Particionamiento Mensual Declarativo de Logs de Auditoría

- **Estado**: Aceptado
- **Fecha**: 2026-06-25
- **Autores**: Equipo de Infraestructura y Base de Datos CIMA

---

## Contexto y Planteamiento del Problema

La tabla `schema_auth.audit_logs` almacena el rastro inmutable de cada intento de login (exitoso o fallido), rotación de refresh tokens, emisión de invitaciones y cambios administrativos de usuarios.

En un entorno productivo prolongado:
1. Esta tabla crece de forma monótona y rápida, acumulando millones de filas.
2. Los índices de árbol B (`B-tree`) crecen hasta desbordar la memoria RAM disponible en el servidor de base de datos (`shared_buffers`).
3. El mantenimiento regular de la tabla (`VACUUM`, reindexación, archivado histórico o purgas por cumplimiento normativo) causa bloqueos o degradaciones severas de I/O sobre el disco.

---

## Alternativas Evaluadas

### Opción 1: Tabla Monolítica Única con Índices
- **Descripción**: Mantener una tabla estándar con índice sobre `timestamp` y `user_id`.
- **Desventajas**: Con más de 10 millones de filas, las inserciones se ralentizan debido al tamaño del índice, y las consultas de auditoría reciente compiten por memoria de búfer con las operaciones críticas de autenticación.

### Opción 2: Purga Periódica por Lotes (DELETE vía Cron)
- **Descripción**: Ejecutar `DELETE FROM audit_logs WHERE timestamp < now() - interval '90 days'`.
- **Desventajas**: Las sentencias `DELETE` masivas generan un volumen excesivo de registros WAL (*Write-Ahead Logging*), fragmentación masiva (*table bloat*) y bloqueos de tabla.

### Opción 3 (Elegida): Particionamiento Declarativo Mensual por Rango
- **Descripción**: Configurar `schema_auth.audit_logs` como tabla particionada por rangos de fecha (`PARTITION BY RANGE (timestamp)`), creando una subtabla física por cada mes calendario.

---

## Decisión

Adoptar la **Opción 3**:
1. La tabla principal `audit_logs` se define con particionamiento declarativo nativo de PostgreSQL 16 sobre la columna `timestamp`.
2. Las particiones siguen la nomenclatura estandarizada:
   `schema_auth.audit_logs_pYYYY_MM` (ej. `audit_logs_p2026_09`).
3. El script idempotente `pnpm db:ensure-audit-partitions` se ejecuta durante el bootstrap y tareas programadas para garantizar la existencia anticipada de las particiones de los siguientes 3 meses.
4. Para archivar o descartar datos de más de 1 año, basta con ejecutar `DROP TABLE audit_logs_pYYYY_MM`, una operación O(1) instantánea sin fragmentación de almacenamiento.

---

## Consecuencias

### Positivas
- **Rendimiento Constante de Escritura**: Los índices de la partición del mes en curso caben completamente en memoria RAM.
- **Poda de Particiones (*Partition Pruning*)**: Las consultas con filtros de fecha solo escanean las particiones relevantes, ignorando el historial de meses anteriores.
- **Mantenimiento Cero Impacto**: Descartar datos obsoletos se realiza con un simple `DROP TABLE` en milisegundos sin generar bloat ni registros masivos en WAL.

### Negativas
- **Supervisión de Particiones**: Es indispensable que el sistema cree con antelación las particiones de meses venideros; si llega un registro con una fecha para la cual no existe partición, PostgreSQL lanzará un error de inserción.
