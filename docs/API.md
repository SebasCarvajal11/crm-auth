# Contratos de API: `crm-auth`

Este documento detalla la interfaz pública, los convenios de comunicación y los contratos HTTP expuestos por `crm-auth` a través del API Gateway KrakenD.

La presencia incorpora `POST /api/v1/identity/presence` (señal propia) y
`GET /api/v1/admin/presence` (solo admin activo). El contrato completo está en
OpenAPI y la [política de presencia](PRESENCE.md).

---

## 1. Convenciones y Puertos

| Entorno | Host / URL Base | Notas |
| :--- | :--- | :--- |
| **API Gateway (Recomendado)**| `http://localhost:28080` (Local) / `https://cima.com` (Prod) | KrakenD realiza enrutamiento público, CORS, rate limiting y métricas. |
| **Directo (Desarrollo interno)** | `http://localhost:3000` | Acceso sin pasar por KrakenD (red interna / pruebas unitarias). |

- **Especificación OpenAPI**: [`openapi/openapi.yaml`](../openapi/openapi.yaml)
- **Documentación Interactiva Swagger**: `GET /api/v1/docs` (o vía gateway: `/api/v1/docs/auth/openapi.yaml`)
- **Contrato de Error Estándar (`NormalizedError`)**:
  ```json
  {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje legible del error",
    "statusCode": 400,
    "timestamp": "2026-09-28T12:00:00.000Z",
    "details": {}
  }
  ```
  Los códigos de error canónicos se encuentran catalogados en `@sebascarvajal11/cima-contracts` (`ERROR_CATALOG`).

---

## 2. Mecanismos de Autenticación

### A. Access Token (JWT Bearer)
- Se envía en el encabezado: `Authorization: Bearer <access_token>`.
- Token RS256 de corta duración (típicamente 15 a 60 minutos).
- Contiene los claims canónicos: `iss` (`cima-crm`), `sub` (UUID del usuario), `userId`, `email`, `role`, `exp`, `iat`.

### B. Refresh Token (Cookie Segura HttpOnly)
- Se transporta automáticamente como cookie: `refresh_token`.
- Atributos: `HttpOnly`, `SameSite=Lax`, `Secure` (en HTTPS), `Path=/api/v1/auth/refresh`.
- Permite la renovación transparente del access token sin exponer credenciales al JavaScript del cliente.

### C. Punto de Publicación de Claves Públicas (JWKS)
- **Ruta**: `GET /api/v1/.well-known/jwks.json`
- Devuelve el conjunto de claves RSA públicas (RFC 7517) utilizado por KrakenD y otros microservicios para validar tokens sin llamadas síncronas.

---

## 3. Catálogo de Endpoints (Rutas Públicas KrakenD y Mapeo Interno)

### Sistema y Salud
| Método | Endpoint Público KrakenD | Backend Interno (`crm-auth`) | Acceso | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | `/api/v1/health` | Público | Reporta estado del servicio, base de datos y Redis. |
| `GET` | `/api/v1/.well-known/jwks.json` | `/api/v1/.well-known/jwks.json` | Público | Publica claves públicas RSA en formato JWKS. |
| `GET` | `/api/v1/metrics` | `/api/v1/metrics` | Interno / Prometheus | Expone métricas Prometheus en texto plano. |

### Flujos Públicos de Autenticación
| Método | Endpoint Público KrakenD | Backend Interno (`crm-auth`) | Payload Clave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `/api/v1/auth/login` | `{ email, password }` | Valida credenciales, emite JWT y cookie `refresh_token`. |
| `POST` | `/api/v1/auth/refresh` | `/api/v1/auth/refresh` | Cookie `refresh_token` | Rota token de refresco y emite nuevo Access Token. |
| `POST` | `/api/v1/auth/forgot-password` | `/api/v1/auth/forgot-password` | `{ email }` | Solicita enlace de recuperación de clave. |
| `POST` | `/api/v1/auth/reset-password` | `/api/v1/auth/reset-password` | `{ token, newPassword }` | Establece nueva contraseña con token válido. |
| `GET` | `/api/v1/auth/accept-invite/{token}` | `/api/v1/auth/accept-invite/{token}` | Parámetro URL | Valida validez del token de invitación. |
| `POST` | `/api/v1/auth/accept-invite` | `/api/v1/auth/accept-invite` | `{ token, password, ... }` | Activa cuenta de usuario o cliente invitado. |
| `POST` | `/api/v1/auth/verify-email` | `/api/v1/auth/verify-email` | `{ token }` | Confirma verificación de correo electrónico. |

### Sesión y Cuenta de Usuario (Requiere Bearer JWT)
| Método | Endpoint Público KrakenD | Backend Interno (`crm-auth`) | Rol Requerido | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/identity/me` | `/api/v1/auth/me` | Autenticado | Devuelve identidad y claims del usuario en sesión. |
| `POST` | `/api/v1/identity/logout` | `/api/v1/auth/logout` | Autenticado | Revoca el token de sesión y limpia cookie `refresh_token`. |
| `GET` | `/api/v1/identity/search` | `/api/v1/auth/users/search` | Autenticado | Búsqueda rápida de usuarios por texto (`q`) y rol. |
| `POST` | `/api/v1/account/password` | `/api/v1/auth/change-password` | Autenticado | Permite cambio voluntario o forzado de contraseña. |
| `GET` | `/api/v1/account/sessions` | `/api/v1/auth/sessions` | Autenticado | Lista familias de sesiones activas del usuario. |
| `DELETE`| `/api/v1/account/sessions/{familyId}` | `/api/v1/auth/sessions/{familyId}` | Autenticado | Cierra una sesión activa remota. |
| `POST` | `/api/v1/account/verify-email/request`| `/api/v1/auth/request-email-verification` | Autenticado | Solicita reenvío de correo de verificación. |

### Administración de Cuentas (Requiere Rol `admin`)
| Método | Endpoint Público KrakenD | Backend Interno (`crm-auth`) | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/workers` | `/api/v1/auth/register-worker` | Registra directamente un colaborador de CIMA. |
| `POST` | `/api/v1/admin/admins/invite` | `/api/v1/auth/invite-admin` | Envía invitación a un nuevo administrador. |
| `POST` | `/api/v1/admin/clients/invite` | `/api/v1/auth/invite-client` | Envía invitación a cliente formal (natural/jurídica). |
| `GET` | `/api/v1/admin/users` | `/api/v1/auth/users` | Listado paginado de usuarios con filtros por rol, estado y búsqueda. |
| `PATCH`| `/api/v1/admin/users/{subject}/status` | `/api/v1/auth/users/{subject}/status` | Activa o suspende una cuenta de usuario (`is_active`). |
| `PATCH`| `/api/v1/admin/users/{subject}/flags` | `/api/v1/auth/users/{subject}/flags` | Modifica banderas operativas (ej. cambio forzado de clave). |
| `POST` | `/api/v1/admin/users/{subject}/restore`| `/api/v1/auth/users/{subject}/restore` | Restaura una cuenta previamente dada de baja lógica. |
| `DELETE`| `/api/v1/admin/users/{subject}` | `/api/v1/auth/users/{subject}` | Baja lógica de cuenta (soft-delete vía `deleted_at`). |
