# ============================================================
# 11 — Gestion de Sesiones
# ============================================================
# Prueba los endpoints de sesiones:
# - Listar sesiones activas
# - Revocar sesion especifica
# - Token refresh con familia valida
# - Token refresh con familia revocada (401)
# - Deteccion de robo de token (reuse detection)
# ============================================================

# Login -> capturar access token y refresh token
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
session_token: jsonpath "$.data.access_token"
session_rt_1: cookie "refresh_token"

# --- Listar sesiones activas ---
GET {{base_url}}/api/v1/auth/sessions
Authorization: Bearer {{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# --- Refresh con familia valida: rt_1 -> rt_2 ---
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{session_rt_1}}
HTTP 200
[Captures]
session_token_v2: jsonpath "$.data.access_token"
session_rt_2: cookie "refresh_token"
[Asserts]
jsonpath "$.data.access_token" isString

# --- El nuevo access token funciona ---
GET {{base_url}}/api/v1/identity/me
Authorization: Bearer {{session_token_v2}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "admin@cima.dev"

# --- Refresh con rt_2 para obtener rt_3 ---
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{session_rt_2}}
HTTP 200
[Captures]
session_token_v3: jsonpath "$.data.access_token"
session_rt_3: cookie "refresh_token"

# --- Logout con rt_3: revoca la familia ---
POST {{base_url}}/api/v1/identity/logout
Authorization: Bearer {{session_token_v3}}
[Cookies]
refresh_token: {{session_rt_3}}
HTTP 200
[Asserts]
jsonpath "$.message" exists

# --- Refresh sin cookie: 401 ---
POST {{base_url}}/api/v1/auth/refresh
HTTP 401

# --- Deteccion de robo: rt_1 fue revocado en la primera rotacion ---
# El servidor detecta reuso y rechaza la solicitud
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{session_rt_1}}
HTTP 401
[Asserts]
jsonpath "$.message" exists

# --- Deteccion de robo: rt_2 tambien fue revocado ---
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{session_rt_2}}
HTTP 401
[Asserts]
jsonpath "$.message" exists

# --- Login nuevo para verificar que las sesiones anteriores no afectan ---
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
new_session_token: jsonpath "$.data.access_token"

# --- Verificar que el nuevo token funciona ---
GET {{base_url}}/api/v1/identity/me
Authorization: Bearer {{new_session_token}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "admin@cima.dev"
