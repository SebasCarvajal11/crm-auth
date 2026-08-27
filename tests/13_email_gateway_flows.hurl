# ============================================================
# 13 — Flujos públicos de correo a través del API Gateway
#
# Esta suite no depende de SMTP externo. En NODE_ENV=test cada operación
# expone únicamente el token efímero necesario para confirmar que el
# contrato público, la transacción de identidad y el outbox se integran.
# ============================================================

# Credenciales de las identidades sembradas para el entorno efímero.
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.access_token"

POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "ana.martinez@cima.dev",
  "password": "Demo123!"
}
HTTP 200
[Captures]
unverified_worker_token: jsonpath "$.data.access_token"

# La ruta pública debe encolar la verificación dentro de la misma transacción.
POST {{base_url}}/api/v1/account/verify-email/request
Authorization: Bearer {{unverified_worker_token}}
HTTP 200
[Asserts]
jsonpath "$.message" exists

# Invitación de trabajador: alias público -> Auth -> outbox -> activación.
POST {{base_url}}/api/v1/admin/workers
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "gateway.worker.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Alicia",
  "last_name": "Gomez",
  "profession": "Disenadora"
}
HTTP 201
[Captures]
worker_invitation_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.data.user.role" == "worker"
jsonpath "$.data.token" isString

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{worker_invitation_token}}",
  "password": "WorkerGateway123!"
}
HTTP 201

# Invitación de cliente: alias público -> Auth -> outbox -> activación.
POST {{base_url}}/api/v1/admin/clients/invite
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "gateway.client.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Carlos",
  "last_name": "Perez",
  "client_kind": "juridical",
  "company_name": "Gateway SAS"
}
HTTP 201
[Captures]
client_invitation_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.message" == "Invitacion creada"
jsonpath "$.data.token" isString

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{client_invitation_token}}",
  "password": "ClientGateway123!"
}
HTTP 201
[Asserts]
jsonpath "$.data.user.role" == "client"

# No existe contraseña compartida en el contrato público de invitación admin.
POST {{base_url}}/api/v1/admin/admins/invite
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "email": "gateway.admin.{{TEST_SUFFIX}}@hurl.test",
  "first_name": "Maria",
  "last_name": "Lopez"
}
HTTP 201
[Captures]
admin_invitation_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.data.user.role" == "admin"
jsonpath "$.data.token" isString

POST {{base_url}}/api/v1/auth/accept-invite
Content-Type: application/json
{
  "token": "{{admin_invitation_token}}",
  "password": "AdminGateway123!"
}
HTTP 201
[Asserts]
jsonpath "$.data.user.role" == "admin"

# Recuperación: emisión, canje y autenticación final del usuario afectado.
POST {{base_url}}/api/v1/auth/forgot-password
Content-Type: application/json
{
  "email": "gateway.worker.{{TEST_SUFFIX}}@hurl.test"
}
HTTP 200
[Captures]
password_reset_token: jsonpath "$.data.token"
[Asserts]
jsonpath "$.data.token" isString

POST {{base_url}}/api/v1/auth/reset-password
Content-Type: application/json
{
  "token": "{{password_reset_token}}",
  "password": "WorkerGatewayReset123!"
}
HTTP 200

POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "gateway.worker.{{TEST_SUFFIX}}@hurl.test",
  "password": "WorkerGatewayReset123!"
}
HTTP 200
