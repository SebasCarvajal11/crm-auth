# Contratos de API: `crm-auth`

Este documento detalla la interfaz pública, los convenios de comunicación y los contratos HTTP expuestos por `crm-auth` a través del API Gateway KrakenD.

---

## 1. Convenciones y Puertos

| Entorno | Host / URL Base | Notas |
| :--- | :--- | :--- |
| **API Gateway (Recomendado)**| `http://localhost:28080` (Local) / `https://cima.com` (Prod) | KrakenD realiza enrutamiento, CORS y métricas. |
| **Directo (Desarrollo)** | `http://localhost:3000` | Acceso sin pasar por KrakenD. |

- **Especificación OpenAPI**: [`openapi/openapi.yaml`](file:///d:/BACKUP%20CELULAR%20OLIMPO/crm-auth/openapi/openapi.yaml)
- **Documentación Interactiva Swagger**: `GET /api/v1/docs`
- **Contrato de Error Estándar**: `{ "error": "Mensaje legible del error" }` (HTTP 400, 401, 403, 404, 429, 500).

---

## 2. Mecanismos de Autenticación

### A. Access Token (JWT Bearer)
- Se envía en el encabezado: `Authorization: Bearer <access_token>`.
- Token RS256 de corta duración (típicamente 15 a 60 minutos).
- Contiene los claims: `sub` (UUIDv7 del usuario), `userId`, `email`, `role`, `exp`, `iat`.

### B. Refresh Token (Cookie Segura HttpOnly)
- Se transporta automáticamente como cookie: `refreshToken`.
- Atributos: `HttpOnly`, `SameSite=Lax`, `Secure` (en HTTPS), `Path=/api/v1/auth/refresh`.
- Permite la renovación transparente del access token sin exponer credenciales al JavaScript del cliente.

### C. Punto de Publicación de Claves Públicas (JWKS)
- **Ruta**: `GET /api/v1/.well-known/jwks.json`
- Devuelve el conjunto de claves RSA públicas (RFC 7517) utilizado por KrakenD y otros microservicios para validar tokens sin llamadas síncronas.

---

## 3. Catálogo de Endpoints

### Sistema y Salud
| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Público | Reporta estado del servicio, base de datos y Redis. |
| `GET` | `/api/v1/.well-known/jwks.json` | Público | Publica claves públicas RSA en formato JWKS. |
| `GET` | `/api/v1/metrics` | Interno / Prometheus | Expone métricas Prometheus en texto plano. |

### Flujos Públicos de Autenticación
| Método | Endpoint | Payload Clave | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `{ email, password }` | Valida credenciales, emite JWT y cookie refresh. |
| `POST` | `/api/v1/auth/refresh` | Cookie `refreshToken` | Rota token y emite nuevo Access Token. |
| `POST` | `/api/v1/auth/logout` | Cookie `refreshToken` | Revoca el token de sesión y borra la cookie. |
| `POST` | `/api/v1/auth/forgot-password` | `{ email }` | Solicita enlace de recuperación de clave. |
| `POST` | `/api/v1/auth/reset-password` | `{ token, newPassword }` | Establece nueva contraseña con token válido. |
| `POST` | `/api/v1/auth/accept-invitation` | `{ token, password, ... }` | Activa cuenta de cliente invitado. |

### Sesión y Perfil (Requiere Bearer)
| Método | Endpoint | Rol Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/auth/me` | Autenticado | Devuelve identidad del usuario en sesión. |
| `POST` | `/api/v1/auth/change-password`| Autenticado | Permite cambio voluntario o forzado de clave. |

### Administración de Cuentas (Requiere Rol `admin`)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register-worker` | Registra directamente un colaborador de CIMA. |
| `POST` | `/api/v1/auth/invite-client` | Envía invitación a cliente formal (natural/jurídica). |
| `GET` | `/api/v1/users` | Listado paginado de usuarios con filtros por rol y estado. |
| `GET` | `/api/v1/users/{id}` | Detalle completo de una cuenta. |
| `PATCH` | `/api/v1/users/{id}` | Modificación de estado (`is_active`), nombre o rol. |
| `DELETE` | `/api/v1/users/{id}` | Baja lógica de cuenta (soft-delete vía `deleted_at`). |
