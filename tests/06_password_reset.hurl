# ============================================================
# 06 — Recuperación de Contraseña
# ============================================================

# --- Email inexistente → 200 (respuesta idempotente, no revela info) ---
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json
{
  "email": "noexiste@cima.dev"
}
HTTP 200
[Asserts]
jsonpath "$.message" exists

# --- Solicitar reset para admin ---
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json
{
  "email": "admin@cima.dev"
}
HTTP 200
[Captures]
reset_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.data.token" isString

# --- Segundo token pendiente (mismo usuario) ---
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json
{
  "email": "admin@cima.dev"
}
HTTP 200
[Captures]
alt_reset_token: jsonpath "$.data.token"

# --- Token inválido → 404 ---
POST http://localhost:3000/auth/reset-password
Content-Type: application/json
{
  "token": "token_invalido_000",
  "password": "NuevaPass123!"
}
HTTP 404

# --- Contraseña débil → 400 (Zod) ---
POST http://localhost:3000/auth/reset-password
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "password": "debil"
}
HTTP 400

# --- Reset exitoso ---
POST http://localhost:3000/auth/reset-password
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "password": "NuevaPass123!"
}
HTTP 200
[Asserts]
jsonpath "$.message" == "Contrasena actualizada correctamente"

# --- Reutilizar token → 409 ---
POST http://localhost:3000/auth/reset-password
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "password": "OtraPass456!"
}
HTTP 409

# --- Otro token pendiente invalidado tras el primer reset ---
POST http://localhost:3000/auth/reset-password
Content-Type: application/json
{
  "token": "{{alt_reset_token}}",
  "password": "OtraPass456!"
}
HTTP 409

# --- Login con nueva contraseña ---
POST http://localhost:3000/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "NuevaPass123!"
}
HTTP 200
[Captures]
new_token: jsonpath "$.data.access_token"

# --- Restaurar contraseña original ---
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json
{
  "email": "admin@cima.dev"
}
HTTP 200
[Captures]
restore_token: jsonpath "$.data.token"

POST http://localhost:3000/auth/reset-password
Content-Type: application/json
{
  "token": "{{restore_token}}",
  "password": "Admin123!"
}
HTTP 200
