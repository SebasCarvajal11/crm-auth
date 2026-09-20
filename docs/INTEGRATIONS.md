# Integraciones y Plataforma: `crm-auth`

Este documento define la interacción de `crm-auth` con los demás componentes del ecosistema CIMA CRM, los canales de mensajería asíncrona, el API Gateway y el stack de observabilidad.

---

## 1. Topología de Integración

```text
               ┌───────────────────────┐
               │    KrakenD Gateway    │
               └───────────┬───────────┘
                           │ (HTTP REST / JWKS Cache)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                          crm-auth                           │
│  (Emite JWTs, persiste en schema_auth, produce al outbox)   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼ (Eventos de Identidad)        ▼ (Trabajos de Correo)
     ┌──────────────────┐            ┌──────────────────┐
     │  Redis Streams   │            │   BullMQ Queue   │
     │ stream:auth.id.. │            │   email-queue    │
     └─────────┬────────┘            └─────────┬────────┘
               │                               │
       ┌───────┴───────┐                       ▼
       ▼               ▼                [ Email Worker ]
 [ crm-collab ]  [ crm-media ]                 │
(Sincronizan    (Sincronizan                   ▼
 perfiles)       avatares/cuotas)        [ Servidor SMTP ]
```

---

## 2. Eventos Asíncronos en Redis Streams

Cualquier mutación en la identidad de un usuario se publica en Redis Streams para sincronizar las vistas desnormalizadas de los microservicios aguas abajo:

- **Nombre del Stream**: `stream:auth.identity`
- **Contrato de Eventos**: Definido formalmente en `@sebascarvajal11/cima-contracts/auth-identity-events`.
- **Tipos de Eventos Publicados**:
  - `auth.user.created`: Alta de nuevo usuario (worker o cliente que aceptó invitación).
  - `auth.user.updated`: Cambio de nombre, rol, estado de activación o teléfono.
  - `auth.user.deleted`: Baja lógica de usuario.
- **Mecanismo de Despacho**: Gestionado por el `identity-outbox-worker` para garantizar semántica *at-least-once* sin pérdida de eventos por caídas de red.

---

## 3. Integración con KrakenD API Gateway

- **Manifiesto del Servicio**: [`gateway/gateway.manifest.json`](file:///d:/BACKUP%20CELULAR%20OLIMPO/crm-auth/gateway/gateway.manifest.json).
- **Validación Automática**: Durante el build de infraestructura, `crm-infra` lee el manifiesto y genera la configuración consolidada de KrakenD.
- **Circuit Breaker (Disyuntor)**:
  - KrakenD monitorea `/api/v1/health`.
  - Configuración: `max_errors: 3`, `interval: 60s`, `timeout: 10s`.
  - Si el servicio se degrada, el gateway activa el disyuntor y responde con `503 Service Unavailable` limpio en lugar de agotar sockets.

---

## 4. Stack de Observabilidad y Monitoreo

### A. Health Checks (`GET /api/v1/health`)
Devuelve un JSON estructurado con el estado de las dependencias vitales:
```json
{
  "status": "ok",
  "service": "mod-auth",
  "version": "1.0.0",
  "uptimeSec": 3420,
  "dependencies": {
    "database": { "status": "ok", "latencyMs": 2 },
    "redis": { "status": "ok", "latencyMs": 1 }
  }
}
```

### B. Métricas Prometheus (`GET /api/v1/metrics`)
- Instrumentado con `prom-client`.
- Métricas clave:
  - `http_requests_total`, `http_request_duration_seconds`, `http_errors_5xx_total`.
  - `worker_outbox_depth{worker="identity-outbox"}`: Profundidad de eventos pendientes de publicar.
  - Métricas internas de V8 (consumo de memoria heap, GC, event loop lag).

### C. Trazabilidad y Logs Estructurados
- Generados con **Pino** en formato JSON.
- Incluyen automáticamente `traceId` y `requestId` propagados desde KrakenD.
- Ingeridos por Grafana Loki mediante Promtail con etiqueta `service=crm-auth`.
