# ============================================================
# 07 — Rate Limiting en /auth/login (via API Gateway)
# ============================================================
# NOTA: El rate-limiting ahora vive en KrakenD (qos/ratelimit/router),
# NO en mod-auth. Este test debe ejecutarse contra el gateway aislado (:18080).
# El lockout por cuenta (8 intentos → 30min) sigue en mod-auth.
#
# Ejecutar: hurl --test tests/07_rate_limit.hurl
# Requisito: KrakenD + mod-auth corriendo (start-project.ps1)

POST http://localhost:18080/auth/login
X-Forwarded-For: {{LOGIN_IP}}
X-Real-IP: {{LOGIN_IP}}
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "WrongPass1!"
}
HTTP 401

POST http://localhost:18080/auth/login
X-Forwarded-For: {{LOGIN_IP}}
X-Real-IP: {{LOGIN_IP}}
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "WrongPass2!"
}
HTTP 401

POST http://localhost:18080/auth/login
X-Forwarded-For: {{LOGIN_IP}}
X-Real-IP: {{LOGIN_IP}}
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "WrongPass3!"
}
HTTP 401

POST http://localhost:18080/auth/login
X-Forwarded-For: {{LOGIN_IP}}
X-Real-IP: {{LOGIN_IP}}
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "WrongPass4!"
}
HTTP 401

POST http://localhost:18080/auth/login
X-Forwarded-For: {{LOGIN_IP}}
X-Real-IP: {{LOGIN_IP}}
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "WrongPass5!"
}
HTTP 401

# 6to intento → debe ser bloqueado por KrakenD rate limiter (429)
POST http://localhost:18080/auth/login
X-Forwarded-For: {{LOGIN_IP}}
X-Real-IP: {{LOGIN_IP}}
Content-Type: application/json
{
  "email": "admin@cima.dev",
  "password": "WrongPass6!"
}
HTTP 429
