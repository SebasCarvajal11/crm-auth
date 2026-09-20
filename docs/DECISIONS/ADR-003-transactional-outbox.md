# ADR-003: Patrón Transactional Outbox para Eventos de Identidad y Correo

- **Estado**: Aceptado
- **Fecha**: 2026-06-05
- **Autores**: Equipo de Plataforma y Backend CIMA

---

## Contexto y Planteamiento del Problema

Cuando ocurre un evento de negocio en `crm-auth` (ej. registro de usuario, actualización de rol, emisión de invitación o solicitud de restablecimiento de contraseña), dos operaciones deben suceder:
1. Persistir el cambio de estado en PostgreSQL (`schema_auth`).
2. Notificar a otros microservicios vía Redis Streams (`stream:auth.identity`) o encolar el envío de un correo en BullMQ.

El problema clásico de la **doble escritura (*Dual-Write Problem*)**:
- Si se publica en Redis antes de confirmar la transacción de base de datos y la transacción falla (rollback), los demás microservicios reaccionarán a datos que nunca existieron.
- Si se confirma la base de datos primero y la conexión con Redis o el servidor falla antes de publicar, los datos en la base de datos quedan huérfanos y los demás microservicios jamás se enteran del cambio.

---

## Alternativas Evaluadas

### Opción 1: Publicación Directa Post-Commit en el Request Handler
- **Descripción**: Ejecutar `await redis.xadd(...)` inmediatamente después del `commit` de Drizzle.
- **Desventajas**: Si el proceso colapsa o la red falla entre el commit y la publicación, el evento se pierde irremediablemente sin reintentos posibles.

### Opción 2: Transacciones Distribuidas (Two-Phase Commit / 2PC)
- **Descripción**: Coordinar una transacción atómica entre PostgreSQL y Redis.
- **Desventajas**: Altísima complejidad operativa, latencia severa, y Redis no soporta transacciones 2PC de forma nativa.

### Opción 3 (Elegida): Patrón Transactional Outbox
- **Descripción**: El cambio de estado de negocio y el registro del evento en la tabla `identity_outbox` (o `email_outbox`) se guardan dentro de **la misma transacción ACID local de PostgreSQL**. Un worker independiente sondea la tabla y despacha los eventos.

---

## Decisión

Adoptar la **Opción 3**:
1. Toda mutación que requiera sincronización downstream persiste un registro en `schema_auth.identity_outbox` o `schema_auth.email_outbox` dentro de la transacción original.
2. Si la transacción hace rollback, el evento también se descarta limpiamente.
3. El proceso `identity-outbox-worker` lee los registros con `published_at IS NULL`, los emite a `stream:auth.identity` y marca `published_at = now()`.
4. El proceso `email-outbox-worker` lee los correos pendientes, desencripta el payload y los programa en BullMQ para su entrega asíncrona.

---

## Consecuencias

### Positivas
- **Consistencia Garantizada**: Imposible que exista un usuario en base de datos cuyo evento de creación no quede registrado para entrega.
- **Semántica At-Least-Once**: El worker reintenta el despacho con backoff exponencial si Redis o la red no están disponibles.
- **Desacoplamiento Temporal**: `crm-auth` puede procesar inicios de sesión y registros incluso si Redis o el servidor SMTP experimentan caídas transitorias.

### Negativas
- **Consistencia Eventual**: Los demás microservicios reciben las actualizaciones con unos pocos milisegundos de latencia en lugar de tiempo real síncrono. Los consumidores deben ser idempotentes ante posibles reintentos de entrega.
