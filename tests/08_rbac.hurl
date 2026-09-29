# ============================================================
# 08 — Control de Acceso por Rol (RBAC)
# Requiere mod-auth con NODE_ENV=test para exponer el token de invitación.
# ============================================================

POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "{{TEST_ADMIN_EMAIL}}",
  "password": "{{TEST_ADMIN_PASSWORD}}"
}
HTTP 200
[Captures]
admin_token_rbac: jsonpath "$.data.access_token"

POST {{base_url}}{{register_worker_endpoint}}
Authorization: Bearer {{admin_token_rbac}}
Content-Type: application/json
{
  "email": "worker.rbac.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Laura",
  "last_name": "Gomez",
  "profession": "QA"
}
HTTP 201
[Captures]
worker_rbac_invite_token: jsonpath "$.data.token"

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{worker_rbac_invite_token}}",
  "password": "WorkerPassword123!"
}
HTTP 201
[Captures]
worker_token: jsonpath "$.data.access_token"

POST {{base_url}}{{invite_client_endpoint}}
Authorization: Bearer {{worker_token}}
Content-Type: application/json
{
  "email": "otro.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Mario",
  "last_name": "Perez",
  "client_kind": "natural"
}
HTTP 403
[Asserts]
jsonpath "$.message" exists

POST {{base_url}}{{register_worker_endpoint}}
Authorization: Bearer {{worker_token}}
Content-Type: application/json
{
  "email": "otro-worker.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Nora",
  "last_name": "Suarez",
  "profession": "DevOps"
}
HTTP 403

GET {{base_url}}{{identity_me_endpoint}}
Authorization: Bearer {{worker_token}}
HTTP 200
[Asserts]
jsonpath "$.data.role" == "worker"

# Presencia: el colaborador comunica solo su propia actividad, sin acceso al listado.
POST {{base_url}}/api/v1/presence/heartbeat
Authorization: Bearer {{worker_token}}
HTTP 200
[Asserts]
jsonpath "$.data.heartbeat_interval_seconds" == 60

GET {{base_url}}/api/v1/presence
Authorization: Bearer {{worker_token}}
HTTP 403

GET {{base_url}}/api/v1/presence
HTTP 401

GET {{base_url}}/api/v1/presence?q=worker.rbac.{{TEST_SUFFIX}}
Authorization: Bearer {{admin_token_rbac}}
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.data.groups[0].role" == "worker"
jsonpath "$.data.groups[0].total" == 1
jsonpath "$.data.groups[0].online" == 1
jsonpath "$.data.groups[0].users[0].email" == "worker.rbac.{{TEST_SUFFIX}}@hurl.test"
jsonpath "$.data.as_of" matches "(Z|[+-][0-9]{2}:[0-9]{2})$"
jsonpath "$.data.groups[0].users[0].last_activity_at" matches "(Z|[+-][0-9]{2}:[0-9]{2})$"
jsonpath "$.data.groups[0].users[0].last_connection_at" matches "(Z|[+-][0-9]{2}:[0-9]{2})$"
