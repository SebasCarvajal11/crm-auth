# ============================================================
# 06 — Recuperación de Contraseña
# ============================================================

# --- Email inexistente → 200 (respuesta idempotente, no revela info) ---
# --- Solicitar reset para la cuenta base de pruebas ---
POST {{base_url}}/api/v1/auth/forgot-password
Content-Type: application/json
{
  "email": "{{TEST_ADMIN_EMAIL}}"
}
HTTP 200
[Captures]
reset_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.data.token" isString

# --- Token inválido → 404 ---
POST {{base_url}}/api/v1/auth/reset-password
Content-Type: application/json
{
  "token": "token_invalido_000",
  "password": "NuevaPass123!"
}
HTTP 404

# --- Contraseña débil → 400 (Zod) ---
POST {{base_url}}/api/v1/auth/reset-password
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "password": "debil"
}
HTTP 400

# --- Reset exitoso ---
POST {{base_url}}/api/v1/auth/reset-password
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "password": "NuevaPass123!"
}
HTTP 200
[Asserts]
jsonpath "$.message" == "Contrasena actualizada correctamente"

# --- Reutilizar token → 409 ---
POST {{base_url}}/api/v1/auth/reset-password
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "password": "OtraPass456!"
}
HTTP 409

# --- Login con nueva contraseña ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "{{TEST_ADMIN_EMAIL}}",
  "password": "NuevaPass123!"
}
HTTP 200
[Captures]
new_token: jsonpath "$.data.access_token"

# --- Restaurar contraseña original ---
POST {{base_url}}/api/v1/auth/forgot-password
Content-Type: application/json
{
  "email": "{{TEST_ADMIN_EMAIL}}"
}
HTTP 200
[Captures]
restore_token: jsonpath "$.data.token"

POST {{base_url}}/api/v1/auth/reset-password
Content-Type: application/json
{
  "token": "{{restore_token}}",
  "password": "{{TEST_ADMIN_PASSWORD}}"
}
HTTP 200
