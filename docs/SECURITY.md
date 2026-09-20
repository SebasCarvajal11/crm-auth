# Seguridad y Criptografía: `crm-auth`

Este documento describe la arquitectura de seguridad, la gestión de claves criptográficas, los mecanismos de defensa en profundidad y la protección de datos personales en `crm-auth`.

---

## 1. Criptografía Asimétrica y Firma de Tokens (RS256)

Para evitar la distribución de secretos compartidos a través de la red, `crm-auth` utiliza criptografía asimétrica **RSA (mínimo 2048 bits)**:

- **Clave Privada (`JWT_PRIVATE_KEY`)**: Resguardada exclusivamente en `crm-auth`. Firma digitalmente los Access Tokens (algoritmo `RS256`).
- **Clave Pública (`JWT_PUBLIC_KEY`)**: Publicada en formato JWKS en `/api/v1/.well-known/jwks.json`. Permite a KrakenD y demás microservicios verificar la autenticidad del token sin consultar a `crm-auth`.
- **Identificador de Clave (`JWT_KID`)**: Asocia cada par criptográfico. Permite rotar claves cada 90 días sin desconectar sesiones activas.

---

## 2. Rotación de Refresh Tokens y Detección de Robo

El sistema implementa **Refresh Token Rotation (RTR)** con **detección automática de reutilización (Token Family)**:

```text
[ Cliente ] ──(Envía RT-1)──> [ crm-auth ]
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
   ¿RT-1 es Válido?                                ¿RT-1 ya fue Revocado?
   ├── Revoca RT-1                                 └── ¡ALERTA DE ROBO!
   ├── Emite RT-2 en Familia F1                        └── Revoca de inmediato TODA
   └── Emite nuevo Access Token                            la Familia F1 (cierra sesiones)
```

- Los refresh tokens **nunca se almacenan en texto plano**: se persiste exclusivamente su hash SHA-256 en `schema_auth.refresh_tokens`.
- Si un atacante intercepta un token ya utilizado e intenta presentarlo, el sistema detecta la colisión en la familia y desactiva de inmediato todas las sesiones asociadas a ese dispositivo/familia.

---

## 3. Defensa Contra Fuerza Bruta y Abusos

1. **Bloqueo Progresivo de Cuentas**:
   - Cada intento fallido de contraseña suma 1 a `failed_login_attempts`.
   - Al 5to intento fallido consecutivo, la cuenta entra en estado de bloqueo (`locked_until = now() + 15 min`).
   - El sistema responde con `403 Forbidden` inmediato sin procesar el hash de contraseña, protegiendo los recursos de cómputo del servidor.
2. **Rate Limiting**:
   - Aplicado a nivel de Gateway (KrakenD) en rutas sensibles (`/login`, `/forgot-password`).
   - Middleware interno de protección por IP para limitar ráfagas maliciosas.

---

## 4. Cifrado en Reposo de Cargas Sensibles

- **Cifrado del Email Outbox**: La tabla `schema_auth.email_outbox` contiene tokens de invitación y enlaces de recuperación. Los payloads se almacenan **cifrados simétricamente con AES-256-GCM** mediante la clave de entorno `EMAIL_OUTBOX_ENCRYPTION_KEY`.
- **Hashes de Contraseña**: Generados mediante algoritmos adaptativos lentos (Argon2id/Bcrypt), resistentes a ataques por fuerza bruta mediante GPU/ASIC.

---

## 5. Auditoría y Protección de Datos (PII)

- **Logs Inmutables**: Todo evento crítico (login exitoso/fallido, cambio de clave, revocación, invitación) genera un registro inmutable en `schema_auth.audit_logs`.
- **Sanitización de Logs**: Las credenciales, contraseñas y tokens están explícitamente excluidos de cualquier log de aplicación (Pino).
- **Limpieza de PII**: Existe la utilidad `pnpm pii:clean` para anonimizar o purgar registros históricos que excedan los límites legales de retención.
