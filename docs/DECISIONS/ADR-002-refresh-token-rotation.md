# ADR-002: Rotación de Refresh Tokens y Detección de Robo mediante Familias de Tokens

- **Estado**: Aceptado
- **Fecha**: 2026-05-20
- **Autores**: Equipo de Plataforma y Seguridad CIMA

---

## Contexto y Planteamiento del Problema

Para brindar una experiencia de usuario fluida, la aplicación web debe mantener la sesión abierta durante días o semanas sin obligar a ingresar credenciales constantemente. Sin embargo, los tokens de refresco de larga duración representan un riesgo crítico: si un token es interceptado (mediante XSS, malware o fuga en tránsito), el atacante podría obtener acceso indefinido a la cuenta.

---

## Alternativas Evaluadas

### Opción 1: Refresh Tokens Estáticos sin Rotación
- **Descripción**: Emitir un refresh token con vigencia fija de 30 días que no cambia al solicitar nuevos access tokens.
- **Desventajas**: Si el token es robado, el atacante tiene 30 días de acceso ininterrumpido sin posibilidad de detectar la brecha.

### Opción 2: Rotación Simple sin Detección de Reutilización
- **Descripción**: Cada vez que se usa un refresh token, se destruye y se emite uno nuevo.
- **Desventajas**: Si un atacante roba el token antes que el usuario legítimo, el usuario legítimo verá su sesión cerrada, pero el atacante continuará rotando tokens sin disparar ninguna alarma.

### Opción 3 (Elegida): Refresh Token Rotation con Familias y Detección de Robo (RFC 6749 BCP)
- **Descripción**: Cada cadena de rotación se agrupa bajo un UUID inmutable llamado `family`. Se almacena el hash del token y su estado (`is_revoked`). Si un token ya revocado es presentado de nuevo, se infiere una colisión de robo y se invalida la familia completa.

---

## Decisión

Adoptar la **Opción 3**:
1. Los tokens de refresco se transportan exclusivamente en una cookie `httpOnly`, `SameSite=Lax`, `Secure`.
2. En la base de datos (`schema_auth.refresh_tokens`) se almacena únicamente el hash SHA-256 del token, asociado a una `family` (UUIDv7).
3. Cada rotación revoca el token anterior (`is_revoked = true`) y emite un sucesor dentro de la misma familia.
4. **Detección de Reutilización**: Si llega una petición con un token que ya tiene `is_revoked === true`:
   - Se marca como **incidente de seguridad**.
   - Se revocan **todos los tokens pertenecientes a esa familia**.
   - Se fuerza a ambos actores (legítimo y atacante) a reautenticarse con usuario y contraseña.

---

## Consecuencias

### Positivas
- **Contención Automática de Brechas**: Un token interceptado solo puede usarse una vez; el primer intento de colisión cierra la sesión de inmediato.
- **Protección contra XSS**: La cookie `httpOnly` impide que scripts maliciosos lean el refresh token.
- **Almacenamiento Seguro**: Al almacenar solo hashes SHA-256, un volcado accidental de la base de datos no compromete sesiones activas.

### Negativas
- **Condiciones de Carrera**: Peticiones concurrentes legítimas de refresco desde múltiples pestañas del navegador deben gestionarse adecuadamente en el cliente para evitar falsos positivos de robo.
