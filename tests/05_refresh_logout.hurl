# ============================================================
# 05 - Refresh Token y Logout
# ============================================================
# Nota: Hurl mantiene un cookie store en memoria por invocacion.
# Para evitar que cookies anteriores interfieran con [Cookies]
# explicitos, hacemos el logout ANTES de las pruebas de reuso,
# vaciando asi el store antes de necesitar control total.
# ============================================================

# Login -> capturar rt_1 y access token v1
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
access_token_v1: jsonpath "$.data.access_token"
rt_1: cookie "refresh_token"

# Primera rotacion: rt_1 -> rt_2
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{rt_1}}
HTTP 200
[Captures]
access_token_v2: jsonpath "$.data.access_token"
rt_2: cookie "refresh_token"
[Asserts]
jsonpath "$.data.access_token" isString

# Segunda rotacion: rt_2 -> rt_3
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{rt_2}}
HTTP 200
[Captures]
access_token_v3: jsonpath "$.data.access_token"
rt_3: cookie "refresh_token"
[Asserts]
jsonpath "$.data.access_token" isString

# El access token v3 sirve para autenticarse
GET {{base_url}}/api/v1/auth/me
Authorization: Bearer {{access_token_v3}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "admin@cima.dev"

# Logout: revoca rt_3 y vacia el cookie store
POST {{base_url}}/api/v1/auth/logout
Authorization: Bearer {{access_token_v3}}
[Cookies]
refresh_token: {{rt_3}}
HTTP 200
[Asserts]
jsonpath "$.message" matches "^Sesi.n cerrada correctamente$"

# Con el store vacio: /refresh sin cookie -> 401
POST {{base_url}}/api/v1/auth/refresh
HTTP 401
[Asserts]
jsonpath "$.message" exists

# Deteccion de robo: rt_1 fue revocado en la primera rotacion.
# El store esta vacio -> se envia solo rt_1 -> servidor detecta reuso -> 401
POST {{base_url}}/api/v1/auth/refresh
[Cookies]
refresh_token: {{rt_1}}
HTTP 401
[Asserts]
jsonpath "$.message" exists
