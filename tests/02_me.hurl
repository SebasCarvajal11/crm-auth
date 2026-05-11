# ============================================================
# 02 — GET /auth/me (solo identidad; sin PATCH de perfil)
# ============================================================

POST http://localhost:3000/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.access_token"

GET http://localhost:3000/auth/me
HTTP 401

GET http://localhost:3000/auth/me
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "admin@cima.dev"
jsonpath "$.data.role" == "admin"
