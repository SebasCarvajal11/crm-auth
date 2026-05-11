# ============================================================
# 03 — POST /auth/register-worker  (solo Admin)
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

POST http://localhost:3000/auth/register-worker
Content-Type: application/json
{
  "email": "worker@cima.dev"
}
HTTP 401

POST http://localhost:3000/auth/register-worker
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "worker@cima.dev"
}
HTTP 201
[Captures]
worker_temp_password: jsonpath "$.data.temp_password"
[Asserts]
jsonpath "$.data.user.role" == "worker"
jsonpath "$.data.user.email" == "worker@cima.dev"
jsonpath "$.data.temp_password" isString

POST http://localhost:3000/auth/register-worker
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "worker@cima.dev"
}
HTTP 409
[Asserts]
jsonpath "$.error" exists
