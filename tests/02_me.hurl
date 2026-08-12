# ============================================================
# 02 — GET /auth/me (solo identidad; sin PATCH de perfil)
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

GET {{base_url}}{{identity_me_endpoint}}
HTTP 401

GET {{base_url}}{{identity_me_endpoint}}
Authorization: Bearer {{admin_token}}
HTTP 200
[Asserts]
jsonpath "$.data.email" == "{{TEST_ADMIN_EMAIL}}"
jsonpath "$.data.role" == "admin"
