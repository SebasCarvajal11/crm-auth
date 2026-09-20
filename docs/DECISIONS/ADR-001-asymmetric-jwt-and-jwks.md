# ADR-001: Autenticación Basada en Tokens Asimétricos (RS256) y Publicación JWKS

- **Estado**: Aceptado
- **Fecha**: 2026-05-15
- **Autores**: Equipo de Plataforma y Seguridad CIMA

---

## Contexto y Planteamiento del Problema

En la arquitectura de microservicios de CIMA CRM, cada petición HTTP entrante al API Gateway (KrakenD) o a los servicios internos (`crm-collab`, `crm-media`) requiere verificar la identidad y permisos del usuario. 

Si la validación requiriera invocar síncronamente a `crm-auth` en cada solicitud:
1. `crm-auth` se convertiría en un cuello de botella masivo y un punto único de fallo (*Single Point of Failure*).
2. La latencia global de la plataforma se incrementaría en decenas de milisegundos por cada salto de red.

---

## Alternativas Evaluadas

### Opción 1: Tokens Simétricos (HS256 con Secreto Compartido)
- **Descripción**: Usar una clave secreta simétrica conocida por todos los microservicios y KrakenD.
- **Desventajas**: Si cualquier microservicio secundario o archivo de configuración se ve comprometido, un atacante podría forjar tokens con cualquier rol. Imposibilita la rotación granular de claves.

### Opción 2: Sesiones en Base de Datos Centralizada (Redis / Session Token)
- **Descripción**: Almacenar IDs de sesión en Redis consultados por el Gateway.
- **Desventajas**: Introduce dependencia crítica de disponibilidad en Redis y no transmite claims enriquecidos (rol, subject) sin consultas continuas.

### Opción 3 (Elegida): Criptografía Asimétrica (RS256) con Publicación JWKS
- **Descripción**: `crm-auth` resguarda en privado la clave RSA para firmar tokens. Publica su clave pública en `/api/v1/.well-known/jwks.json` (RFC 7517).

---

## Decisión

Adoptar la **Opción 3**:
1. `crm-auth` genera y custodia la clave privada RSA (mínimo 2048 bits).
2. Firma los Access Tokens usando el algoritmo `RS256` e incluye el identificador `kid` en el encabezado del token.
3. Expone la clave pública en `/api/v1/.well-known/jwks.json`.
4. KrakenD y los microservicios aguas abajo descargan y cachean el JWKS, validando la firma de forma local e instantánea (0 ms de I/O adicional).

---

## Consecuencias

### Positivas
- **Máximo Rendimiento**: Cero llamadas síncronas a `crm-auth` para validar autenticidad de peticiones.
- **Seguridad Robusta**: Principio de menor privilegio; ningún otro servicio tiene acceso a la clave privada de firma.
- **Rotación sin Interrupciones**: Se pueden publicar múltiples claves en el JWKS (`kid` activo + `kid` previo) para rotación gradual sin desconectar usuarios.

### Negativas
- **Revocación Inmediata de Access Tokens**: Un JWT emitido es válido hasta su expiración (`exp`), por lo que los Access Tokens deben mantenerse con tiempos de vida cortos (15-60 min).
