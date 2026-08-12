# ============================================================
# 01 — Login
# ============================================================

# --- Credenciales inválidas (400 / 401) ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "noexiste@cima.dev",
  "password": "Cualquiera1!"
}
HTTP 401
[Asserts]
jsonpath "$.message" exists

# --- Contraseña sin formato mínimo (422 Zod) ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "{{TEST_ADMIN_EMAIL}}",
  "password": "corta"
}
HTTP 400
[Asserts]
jsonpath "$.message" exists

# --- Login exitoso ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "{{TEST_ADMIN_EMAIL}}",
  "password": "{{TEST_ADMIN_PASSWORD}}"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.access_token"
[Asserts]
jsonpath "$.data.access_token" isString
jsonpath "$.data.expires_in" == 28800
jsonpath "$.data.user.role" == "admin"
cookie "refresh_token" exists
