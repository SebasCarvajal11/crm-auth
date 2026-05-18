# ============================================================
# 03 — POST /auth/register-worker  (solo Admin)
# Requiere mod-auth con NODE_ENV=test y EXPOSE_TEMP_PASSWORDS=true
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
  "email": "worker@cima.dev",
  "first_name": "Ana",
  "last_name": "Ruiz",
  "profession": "Disenadora"
}
HTTP 401

POST http://localhost:3000/auth/register-worker
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "worker@cima.dev",
  "first_name": "Ana",
  "last_name": "Ruiz",
  "profession": "Disenadora"
}
HTTP 201
[Captures]
worker_temp_password: jsonpath "$.data.temp_password"
[Asserts]
jsonpath "$.data.user.role" == "worker"
jsonpath "$.data.user.email" == "worker@cima.dev"
jsonpath "$.data.user.first_name" == "Ana"
jsonpath "$.data.user.last_name" == "Ruiz"
jsonpath "$.data.user.profession" == "Disenadora"
jsonpath "$.data.temp_password" isString

POST http://localhost:3000/auth/register-worker
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "worker@cima.dev",
  "first_name": "Ana",
  "last_name": "Ruiz",
  "profession": "Disenadora"
}
HTTP 409
[Asserts]
jsonpath "$.error" exists
