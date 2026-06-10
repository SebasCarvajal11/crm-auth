# ============================================================
# 12 — Verificacion de Email
# ============================================================
# Prueba los endpoints de verificacion de email:
# - Solicitar verificacion de email
# - Verificar email con token valido
# - Rechaza token invalido (400)
# - Rate limit en verificacion
# ============================================================

# Login como worker (tiene email no verificado en seed)
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "ana.martinez@cima.dev",
  "password": "Demo123!"
}
HTTP 200
[Captures]
verify_token: jsonpath "$.data.access_token"

# --- Solicita verificacion de email ---
POST {{base_url}}/api/v1/auth/request-email-verification
Authorization: Bearer {{verify_token}}
HTTP 200
[Captures]
email_verify_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.message" exists

# --- Verifica email con token invalido (400) ---
POST {{base_url}}/api/v1/auth/verify-email
Content-Type: application/json
{
  "token": "token_invalido_999"
}
HTTP 400
[Asserts]
jsonpath "$.message" exists

# --- Verifica email con token valido ---
POST {{base_url}}/api/v1/auth/verify-email
Content-Type: application/json
{
  "token": "{{email_verify_token}}"
}
HTTP 200
[Asserts]
jsonpath "$.message" exists

# --- Solicita verificacion de email para admin ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_verify_token: jsonpath "$.data.access_token"

POST {{base_url}}/api/v1/auth/request-email-verification
Authorization: Bearer {{admin_verify_token}}
HTTP 200
[Captures]
admin_email_verify_token: jsonpath "$.data.token"

# --- Verifica email del admin ---
POST {{base_url}}/api/v1/auth/verify-email
Content-Type: application/json
{
  "token": "{{admin_email_verify_token}}"
}
HTTP 200
[Asserts]
jsonpath "$.message" exists

# --- Login como client y verifica ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "contacto@restauranteelbuensabor.com",
  "password": "Demo123!"
}
HTTP 200
[Captures]
client_verify_token: jsonpath "$.data.access_token"

POST {{base_url}}/api/v1/auth/request-email-verification
Authorization: Bearer {{client_verify_token}}
HTTP 200
[Captures]
client_email_verify_token: jsonpath "$.data.token"

POST {{base_url}}/api/v1/auth/verify-email
Content-Type: application/json
{
  "token": "{{client_email_verify_token}}"
}
HTTP 200
[Asserts]
jsonpath "$.message" exists
