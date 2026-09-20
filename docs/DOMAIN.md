# Modelo de Dominio: `crm-auth`

Este documento define los conceptos del negocio, roles, entidades e invariantes gobernados por el microservicio de autenticación en **CIMA CRM**.

---

## 1. Misión de Dominio y Fronteras de Responsabilidad

`crm-auth` es la autoridad única e indiscutible sobre las **credenciales, sesiones e identidad básica** de los usuarios.

- **Dentro de su frontera**: Credenciales (hashes de contraseñas), roles, estado de activación de cuentas, bloqueo por intentos fallidos, tokens de refresco, tokens de invitación y logs de auditoría de acceso.
- **Fuera de su frontera**: Asignación de miembros a proyectos (propiedad de `crm-collab`), almacenamiento de archivos de portafolio o avatares (propiedad de `crm-media`), y cotizaciones o campañas comerciales (propiedad de `crm-marketing`).

---

## 2. Entidad Principal: `User`

El identificador canónico de un usuario en toda la plataforma es su **`subject`** (UUIDv7 inmutable):

| Atributo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUIDv7 | Identificador interno de base de datos. |
| `subject` | UUIDv7 | Identificador público e inmutable propagado en los JWT (`sub`). |
| `email` | String(255) | Correo electrónico único normalizado en minúsculas. |
| `role` | Enum | Rol en la plataforma: `admin`, `worker`, `client`. |
| `clientKind` | Enum | Aplica si `role === 'client'`: `natural` o `juridical`. |
| `isActive` | Boolean | Estado de la cuenta (permite suspensión administrativa). |
| `failedLoginAttempts` | Integer | Contador de intentos fallidos consecutivos. |
| `lockedUntil` | Timestamp | Marca temporal de bloqueo temporal por fuerza bruta. |
| `forcePasswordChange` | Boolean | Exige cambio de clave en el próximo inicio de sesión. |

---

## 3. Jerarquía y Roles de Usuario

CIMA CRM opera con tres roles estrictamente tipados:

1. **`admin` (Administrador)**:
   - Gestión integral de la plataforma.
   - Capacidad para registrar nuevos trabajadores (`worker`) e invitar clientes (`client`).
   - Gestión del directorio de usuarios (activación, bloqueo, edición básica).
2. **`worker` (Colaborador / Artista / Equipo CIMA)**:
   - Miembros del equipo de producción multimedia, creativos y gestores de cuentas.
   - Son registrados directamente por un administrador.
3. **`client` (Cliente / Empresa contratante)**:
   - Acceden al CRM para revisar propuestas, tableros colaborativos, firmar contratos y otrosíes.
   - Se incorporan mediante un flujo de invitación formal. Se diferencian en:
     - **Persona Natural (`natural`)**: Artistas individuales, directores independientes.
     - **Persona Jurídica (`juridical`)**: Agencias, productoras, empresas con razón social y NIT.

---

## 4. Ciclos de Vida y Flujos Clave

### A. Flujo de Invitación de Clientes
```text
Admin genera invitación -> Token UUID con expiración (7 días)
       │
       ▼
Email Outbox -> Worker envía correo con enlace seguro
       │
       ▼
Cliente abre link -> Ingresa datos y contraseña -> Cuenta activada
       │
       ▼
Evento publicado en Redis Stream (stream:auth.identity) -> Sync downstream
```

### B. Flujo de Bloqueo por Fuerza Bruta
1. Cada intento fallido de contraseña incrementa `failed_login_attempts`.
2. Al alcanzar 5 intentos fallidos consecutivos, `locked_until` se establece a `now() + 15 minutos`.
3. Cualquier intento dentro de la ventana de bloqueo responde `403 Forbidden` inmediatamente sin verificar hash.
4. Un inicio de sesión exitoso reinicia el contador a 0 y limpia `locked_until`.

### C. Recuperación de Contraseña
- Solicitud pública (`POST /api/v1/auth/forgot-password`).
- Genera un token hash único con expiración de 1 hora.
- Se emite correo con enlace temporal.
- Al restablecer la contraseña, se invalidan **todas las sesiones activas** (`refresh_tokens`) del usuario.
