# ============================================================
# 04 — Invitación y aceptación de cliente (solo identidad en mod-auth)
# ============================================================

POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.access_token"

POST {{base_url}}/api/v1/auth/invite-client
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "cliente@cima.dev",
  "first_name": "Carlos",
  "last_name": "Lopez",
  "client_kind": "juridical",
  "company_name": "Cliente SAS"
}
HTTP 201
[Captures]
invite_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.message" == "Invitacion creada"

GET {{base_url}}/api/v1/auth/accept-invite/{{invite_token}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "cliente@cima.dev"
jsonpath "$.data.first_name" == "Carlos"
jsonpath "$.data.last_name" == "Lopez"
jsonpath "$.data.client_kind" == "juridical"
jsonpath "$.data.company_name" == "Cliente SAS"

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{invite_token}}",
  "password": "ClienteSeguro1!"
}
HTTP 201
[Captures]
client_access_token: jsonpath "$.data.access_token"
[Asserts]
jsonpath "$.data.access_token" isString
jsonpath "$.data.user.role" == "client"
cookie "refresh_token" exists

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{invite_token}}",
  "password": "ClienteSeguro1!"
}
HTTP 409

GET {{base_url}}/api/v1/auth/me
Authorization: Bearer {{client_access_token}}
HTTP 200
[Asserts]
jsonpath "$.data.role" == "client"
jsonpath "$.data.email" == "cliente@cima.dev"
jsonpath "$.data.first_name" == "Carlos"
jsonpath "$.data.last_name" == "Lopez"
jsonpath "$.data.client_kind" == "juridical"
jsonpath "$.data.company_name" == "Cliente SAS"
