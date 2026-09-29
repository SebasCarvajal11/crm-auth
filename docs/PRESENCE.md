# Presencia administrativa (ADR, 2026-09-28)

## Responsabilidad de dominio

Se evaluaron Media, Collab y Auth. Media controla activos y mensajería; Collab
controla proyectos. Auth ya posee identidad, roles y sesiones, por lo que la
presencia transversal pertenece a `modules/presence` de Auth. No se duplican
perfiles ni se requieren servicios, repositorios, colas o conexiones persistentes.

## Semántica y coste

`POST /api/v1/identity/presence` en KrakenD observa únicamente la identidad del
JWT, sin aceptar destinatarios. Todos los roles pueden enviar su propia señal;
solo administradores pueden leer `GET /api/v1/admin/presence`.
Las rutas internas son `/api/v1/presence/heartbeat` y `/api/v1/presence`.

La política única está en `presence.policy.ts`: señal cada 60 s, vigencia 150 s,
escritura como máximo cada 45 s por identidad, consulta cada 30 s con el panel
abierto, ventana de siete días y diez filas por perfil/página. La respuesta
comunica la política al cliente. “En línea” significa aplicación visible con una
señal reciente y al menos una familia de refresh activa; no prueba actividad humana.
Los cierres abruptos y la suspensión móvil se detectan al caducar la señal.
Revocar todas las sesiones elimina inmediatamente la condición de conectado.

PostgreSQL mantiene una única fila por usuario (`user_presence`); usa hora del
servidor y upsert condicionado para limitar escrituras entre pestañas y réplicas.
No necesita un worker de expiración ni una fila por heartbeat. El índice de
actividad limita la ventana; el índice parcial de sesiones vivas evita búsquedas
repetidas sobre tokens revocados. Una consulta SQL retorna las tres páginas y
sus totales desde el mismo snapshot. Se excluye al solicitante y las cuentas
suspendidas/eliminadas. La fila se borra por FK al eliminar físicamente la identidad.

## Seguridad y búsqueda

Se verifica firma JWT, rol admin y rol/estado actual en DB, además de una sesión
activa. Las respuestas son `Cache-Control: no-store` y omiten tokens, dispositivos,
familias de sesión, IP y credenciales. Redis limita la señal a 12 solicitudes/min
por identidad y la lectura a 30/min; fallar Redis mantiene el control fail-closed.

`q` permite hasta 120 caracteres y busca literalmente en nombre completo, correo
y empresa. El modelo no tiene un username independiente: su alias de correo queda
incluido. `%`, `_` y barras se escapan; los valores SQL se parametrizan. Cada
perfil tiene un parámetro de página (`worker_page`, `client_page`, `admin_page`),
validado y acotado al último número disponible cuando cambia el total.
Los conectados aparecen primero y las desconexiones recientes conservan la
marca real de última actividad; no se inventa una fecha de desconexión exacta.

## Contrato temporal (2026-09-29)

Todas las fechas de la respuesta son instantes ISO 8601 con zona horaria explícita.
`users.last_login_at` conserva el esquema histórico `timestamp without time zone`,
pero `markSuccessfulLogin` escribe instantes UTC. La consulta de presencia aplica
`AT TIME ZONE 'UTC'` antes de construir el JSON, conservando ese instante incluso
cuando la sesión PostgreSQL usa otra zona; los valores nulos siguen siendo nulos.
Así se evita que un login real invalide el listado en el frontend o que Safari
interprete una fecha ambigua en la zona local del dispositivo.

Se evaluaron aceptar fechas ambiguas en el cliente, migrar la columna compartida
y convertirlas en el adaptador SQL. Se eligió la conversión en el repositorio:
respeta el contrato existente, mantiene la validación estricta del cliente y evita
una migración transversal innecesaria para corregir esta lectura.
Las pruebas de PostgreSQL usan logins no nulos y validan el formato y el instante
en UTC, Bogotá y Kolkata, además del caso nulo. Hurl verifica las tres fechas
del listado después del login y heartbeat reales de un colaborador `@hurl.test`.

## Migraciones y validación

0005 añade presencia y 0006 el índice de sesiones: cambios expand compatibles
con Blue/Green. Se reconstruyó el snapshot 0004 que faltaba para `email_outbox`,
sin modificar su SQL aplicado. Esto evita que Drizzle vuelva a crear esa tabla.

`pnpm test:unit` valida autorización HTTP con JWTs de prueba firmados, roles,
cuentas suspendidas, parámetros, política y señales propias. La integración real
usa `PRESENCE_TEST_DATABASE_URL` explícita y local, transacciones con rollback e
identidades únicas `@hurl.test`; se ejecuta con `pnpm test:presence:integration`.
CI requiere ambas suites y Hurl. El flujo RBAC Hurl verifica señales y lecturas
sobre el servidor real. La suite de navegador del frontend valida diseño y red.
