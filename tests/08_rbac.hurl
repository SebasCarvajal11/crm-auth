# ============================================================
# 08 — Control de Acceso por Rol (RBAC)
# ============================================================

POST http://localhost:3000/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token_rbac: jsonpath "$.data.access_token"

POST http://localhost:3000/auth/register-worker
Authorization: Bearer {{admin_token_rbac}}
Content-Type: application/json
{
  "email": "worker.rbac@cima.dev"
}
HTTP 201
[Captures]
worker_rbac_temp_password: jsonpath "$.data.temp_password"

POST http://localhost:3000/auth/login
Content-Type: application/json
{
  "email": "worker.rbac@cima.dev",
  "password": "{{worker_rbac_temp_password}}"
}
HTTP 200
[Captures]
worker_token: jsonpath "$.data.access_token"

POST http://localhost:3000/auth/invite-client
Authorization: Bearer {{worker_token}}
Content-Type: application/json
{
  "email": "otro@cima.dev"
}
HTTP 403
[Asserts]
jsonpath "$.error" exists

POST http://localhost:3000/auth/register-worker
Authorization: Bearer {{worker_token}}
Content-Type: application/json
{
  "email": "otro_worker@cima.dev"
}
HTTP 403

GET http://localhost:3000/auth/me
Authorization: Bearer {{worker_token}}
HTTP 200
[Asserts]
jsonpath "$.data.role" == "worker"
