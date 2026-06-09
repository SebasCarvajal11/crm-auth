# ============================================================
# crm-auth - Gateway Contract Tests
# ============================================================

# 1. Login as Admin
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "Admin123!"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.access_token"

# 2. Login as Worker
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json
{
  "email": "ana.martinez@cima.dev",
  "password": "Demo123!"
}
HTTP 200
[Captures]
worker_token: jsonpath "$.data.access_token"

# 3. Access Identity Me (with worker token)
GET {{base_url}}/api/v1/identity/me
Authorization: Bearer {{worker_token}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "ana.martinez@cima.dev"
jsonpath "$.data.role" == "worker"

# 4. Access Admin Users List (should fail with worker token - 403 Forbidden)
GET {{base_url}}/api/v1/admin/users
Authorization: Bearer {{worker_token}}
HTTP 403

# 5. Access Admin Users List (should pass with admin token)
GET {{base_url}}/api/v1/admin/users
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
