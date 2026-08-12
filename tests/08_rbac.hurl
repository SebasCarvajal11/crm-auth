# ============================================================
# 08 — Control de Acceso por Rol (RBAC)
# Requiere mod-auth con NODE_ENV=test y EXPOSE_TEMP_PASSWORDS=true
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
