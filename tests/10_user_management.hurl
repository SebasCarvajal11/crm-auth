# ============================================================
# 10 — Gestion de Usuarios (Admin)
# ============================================================
# Prueba los endpoints de administracion de usuarios:
# - Listar usuarios con paginacion
# - Buscar usuario por email
# - Activar/desactivar usuario
# - Forzar cambio de contrasena
# - Restaurar usuario eliminado
# - Eliminar usuario (soft-delete)
# - RBAC: Worker y Client no pueden listar (403)
# - Guest no puede acceder (401)
# ============================================================

# Login como admin
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.access_token"

# Login como worker
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "ana.martinez@cima.dev",
  "password": "Demo123!"
}
HTTP 200
[Captures]
worker_token: jsonpath "$.data.access_token"

# Login como client
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "contacto@restauranteelbuensabor.com",
  "password": "Demo123!"
}
HTTP 200
[Captures]
client_token: jsonpath "$.data.access_token"

# --- Guest: NO puede listar usuarios (401) ---
GET {{base_url}}/api/v1/auth/users
HTTP 401

# --- Worker: NO puede listar usuarios (403) ---
GET {{base_url}}/api/v1/auth/users
Authorization: Bearer {{worker_token}}
HTTP 403

# --- Client: NO puede listar usuarios (403) ---
GET {{base_url}}/api/v1/auth/users
Authorization: Bearer {{client_token}}
HTTP 403

# --- Admin: Lista usuarios con paginacion ---
GET {{base_url}}/api/v1/auth/users?page=1&limit=10
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data.items" isCollection
jsonpath "$.data.page" == 1
jsonpath "$.data.limit" == 10
jsonpath "$.data.total" isString

# --- Admin: Busca usuario por email ---
GET {{base_url}}/api/v1/auth/users/search?email=admin@cima.dev
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# --- Admin: Busca usuario por email inexistente ---
GET {{base_url}}/api/v1/auth/users/search?email=noexiste@cima.dev
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# --- Admin: Crea worker para pruebas de gestion ---
POST {{base_url}}/api/v1/auth/register-worker
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "test.gestion@cima.dev",
  "first_name": "Test",
  "last_name": "Gestion",
  "profession": "QA Tester"
}
HTTP 201
[Captures]
test_user_token: jsonpath "$.data.token"
test_user_id: jsonpath "$.data.user.id"

# Aceptar invitacion para activar el usuario
POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{test_user_token}}",
  "password": "TestGestion123!"
}
HTTP 201

# --- Admin: Fuerza cambio de contrasena ---
PATCH {{base_url}}/api/v1/auth/users/test.gestion@cima.dev/flags
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "force_password_change": true
}
HTTP 200
[Asserts]
jsonpath "$.data.force_password_change" == true

# --- Admin: Desactiva usuario ---
PATCH {{base_url}}/api/v1/auth/users/test.gestion@cima.dev/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "is_active": false
}
HTTP 200
[Asserts]
jsonpath "$.data.is_active" == false

# --- Admin: Reactiva usuario ---
PATCH {{base_url}}/api/v1/auth/users/test.gestion@cima.dev/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "is_active": true
}
HTTP 200
[Asserts]
jsonpath "$.data.is_active" == true

# --- Admin: Elimina usuario (soft-delete) ---
DELETE {{base_url}}/api/v1/auth/users/test.gestion@cima.dev
Authorization: Bearer {{admin_token}}
HTTP 200

# --- Admin: Restaura usuario eliminado ---
POST {{base_url}}/api/v1/auth/users/test.gestion@cima.dev/restore
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data.is_active" exists

# --- Admin: Elimina usuario nuevamente para limpieza ---
DELETE {{base_url}}/api/v1/auth/users/test.gestion@cima.dev
Authorization: Bearer {{admin_token}}
HTTP 200
