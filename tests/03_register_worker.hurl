# ============================================================
# 03 — POST /auth/register-worker  (solo Admin)
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
admin_token: jsonpath "$.data.access_token"

POST {{base_url}}{{register_worker_endpoint}}
Content-Type: application/json
{
  "email": "worker.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Ana",
  "last_name": "Ruiz",
  "profession": "Disenadora"
}
HTTP 401

POST {{base_url}}{{register_worker_endpoint}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "worker.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Ana",
  "last_name": "Ruiz",
  "profession": "Disenadora"
}
HTTP 201
[Captures]
worker_invite_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.data.user.role" == "worker"
jsonpath "$.data.user.email" == "worker.{{TEST_SUFFIX}}@hurl.test"
jsonpath "$.data.user.first_name" == "Ana"
jsonpath "$.data.user.last_name" == "Ruiz"
jsonpath "$.data.user.profession" == "Disenadora"
jsonpath "$.data.token" isString

POST {{base_url}}{{register_worker_endpoint}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "worker.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Ana",
  "last_name": "Ruiz",
  "profession": "Disenadora"
}
HTTP 409
[Asserts]
jsonpath "$.message" exists

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{worker_invite_token}}",
  "password": "WorkerPassword123!"
}
HTTP 201
[Captures]
worker_access_token: jsonpath "$.data.access_token"
[Asserts]
jsonpath "$.data.user.role" == "worker"

POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "worker.{{TEST_SUFFIX}}@hurl.test",
  "password": "WorkerPassword123!"
}
HTTP 200
