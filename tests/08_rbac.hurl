# ============================================================
# 08 — Control de Acceso por Rol (RBAC)
# Requiere mod-auth con NODE_ENV=test y EXPOSE_TEMP_PASSWORDS=true
# ============================================================

POST {{base_url}}/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token_rbac: jsonpath "$.data.access_token"

POST {{base_url}}/auth/register-worker
Authorization: Bearer {{admin_token_rbac}}
Content-Type: application/json
{
  "email": "worker.rbac@cima.dev",
  "first_name": "Laura",
  "last_name": "Gomez",
  "profession": "QA"
}
HTTP 201
[Captures]
worker_rbac_invite_token: jsonpath "$.data.token"

POST {{base_url}}/auth/accept-invite
Content-Type: application/json
{
  "token": "{{worker_rbac_invite_token}}",
  "password": "WorkerPassword123!"
}
HTTP 201
[Captures]
worker_token: jsonpath "$.data.access_token"

POST {{base_url}}/auth/invite-client
Authorization: Bearer {{worker_token}}
Content-Type: application/json
{
  "email": "otro@cima.dev",
  "first_name": "Mario",
  "last_name": "Perez",
  "client_kind": "natural"
}
HTTP 403
[Asserts]
jsonpath "$.error" exists

POST {{base_url}}/auth/register-worker
Authorization: Bearer {{worker_token}}
Content-Type: application/json
{
  "email": "otro_worker@cima.dev",
  "first_name": "Nora",
  "last_name": "Suarez",
  "profession": "DevOps"
}
HTTP 403

GET {{base_url}}/auth/me
Authorization: Bearer {{worker_token}}
HTTP 200
[Asserts]
jsonpath "$.data.role" == "worker"
