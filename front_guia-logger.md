# Guía oficial de Logger para frontend

Esta guía documenta los endpoints que una aplicación frontend puede consumir para autenticación, recuperación de contraseña, administración de usuarios, roles y permisos, y el CRUD de Products. Los contratos corresponden a Logger API v1.

## 1. Configuración y autenticación

Configura la URL de Logger por entorno local:

```dotenv
VITE_LOGGER_API_URL=http://localhost:3000
```

El origen exacto del frontend debe estar incluido en `CORS_ORIGINS`. El frontend necesita la configuración pública del mismo proyecto Firebase que usa Logger, pero nunca debe incluir credenciales Firebase Admin, `DATABASE_URL` u otros secretos del backend.

Logger no recibe usuario y contraseña. El frontend inicia sesión con Firebase y obtiene un ID Token:

```ts
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const credential = await signInWithEmailAndPassword(
  getAuth(),
  email,
  password,
);
const idToken = await credential.user.getIdToken();
```

Las rutas protegidas requieren:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

No utilices refresh tokens, custom tokens ni credenciales Firebase Admin como Bearer.

### Cliente HTTP recomendado

```ts
import { getAuth } from "firebase/auth";

const API_URL = import.meta.env.VITE_LOGGER_API_URL;

export class LoggerApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function loggerFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const user = getAuth().currentUser;
  if (!user) throw new LoggerApiError(401, "AUTH_REQUIRED", "Login required");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  headers.set("X-Request-Id", crypto.randomUUID());
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 204) return undefined as T;

  const payload = await response.json();
  if (!response.ok) {
    throw new LoggerApiError(
      response.status,
      payload.error?.code ?? "UNKNOWN_ERROR",
      payload.error?.message ?? "Request failed",
      payload.error?.requestId,
      payload.error?.details,
    );
  }
  return payload as T;
}
```

Ante `401 AUTH_INVALID_TOKEN`, fuerza una renovación una sola vez con `getIdToken(true)`. Si vuelve a fallar, cierra la sesión. No implementes reintentos infinitos.

## 2. Convenciones HTTP

| Header | Uso |
| --- | --- |
| `Authorization` | Obligatorio en rutas protegidas |
| `Content-Type` | `application/json` cuando existe body |
| `X-Request-Id` | Correlación opcional; Logger también lo devuelve |

Las respuestas de recursos usan `{ "data": ... }`. `GET /api/v1/auth/me` es la excepción y devuelve el usuario directamente. Una respuesta `204` no tiene body y no debe procesarse con `response.json()`.

Las fechas llegan como strings ISO 8601. `price` llega como string decimal y puede normalizarse (`"100.5"` en vez de `"100.50"`).

Formato de error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "requestId": "031bd95a-d1a3-4bea-a883-f61abc21a586",
    "details": {
      "formErrors": [],
      "fieldErrors": { "email": ["Invalid email address"] }
    }
  }
}
```

`details` solo aparece fuera de producción. Usa `code` para decisiones de interfaz y `message` como fallback.

### Errores globales

| HTTP | Código | Acción frontend |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Mostrar errores disponibles |
| `401` | `AUTH_MISSING_TOKEN` / `AUTH_REQUIRED` | Solicitar login |
| `401` | `AUTH_INVALID_HEADER` | Revisar cliente HTTP |
| `401` | `AUTH_INVALID_TOKEN` | Renovar una vez o cerrar sesión |
| `403` | `AUTH_USER_NOT_REGISTERED` | Informar falta de aprovisionamiento |
| `403` | `AUTH_USER_INACTIVE` | Informar cuenta inactiva |
| `403` | `AUTH_FORBIDDEN` | Mostrar acceso denegado |
| `404` | `ROUTE_NOT_FOUND` | Revisar método y URL |
| `429` | — | Esperar antes de reintentar |
| `500` | `INTERNAL_ERROR` | Error general y conservar `requestId` |

## 3. Inventario de endpoints

### Públicos y operativos

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | Readiness PostgreSQL |
| `GET` | `/health/db` | Alias de readiness |
| `POST` | `/api/v1/auth/password-reset` | Recuperar contraseña |

### Autenticación y administración

| Método | Endpoint | Permiso |
| --- | --- | --- |
| `GET` | `/api/v1/auth/me` | Usuario `ACTIVE` |
| `GET` | `/api/v1/users` | `users:read` |
| `GET` | `/api/v1/users/:id` | `users:read` |
| `POST` | `/api/v1/users` | `users:manage` |
| `PATCH` | `/api/v1/users/:id` | `users:manage` |
| `POST` | `/api/v1/users/:id/activate` | `users:manage` |
| `POST` | `/api/v1/users/:id/suspend` | `users:manage` |
| `POST` | `/api/v1/users/:id/send-password-setup` | `users:manage` |
| `GET` | `/api/v1/roles` | `rbac:read` |
| `GET` | `/api/v1/roles/:id` | `rbac:read` |
| `POST` | `/api/v1/roles` | `rbac:manage` |
| `PATCH` | `/api/v1/roles/:id` | `rbac:manage` |
| `DELETE` | `/api/v1/roles/:id` | `rbac:manage` |
| `GET` | `/api/v1/permissions` | `rbac:read` |
| `GET` | `/api/v1/permissions/:id` | `rbac:read` |
| `PUT` | `/api/v1/users/:id/roles` | `rbac:manage` |
| `PUT` | `/api/v1/roles/:id/permissions` | `rbac:manage` |

### Products

| Método | Endpoint | Permiso |
| --- | --- | --- |
| `GET` | `/api/v1/products` | `products:read` |
| `GET` | `/api/v1/products/:id` | `products:read` |
| `POST` | `/api/v1/products` | `products:create` |
| `PATCH` | `/api/v1/products/:id` | `products:update` |
| `DELETE` | `/api/v1/products/:id` | `products:delete` |

## 4. Sesión actual

### `GET /api/v1/auth/me`

```ts
interface CurrentUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: "ACTIVE";
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
}

const me = await loggerFetch<CurrentUser>("/api/v1/auth/me");
const can = (permission: string) => me.permissions.includes(permission);
```

Respuesta `200`, sin wrapper `data`:

```json
{
  "id": "USER_UUID",
  "firebaseUid": "firebase-user-uid",
  "email": "admin@example.com",
  "displayName": "Admin User",
  "status": "ACTIVE",
  "lastLoginAt": "2026-08-18T12:00:00.000Z",
  "roles": ["admin"],
  "permissions": ["users:read", "users:manage", "rbac:read", "rbac:manage"]
}
```

Ocultar componentes con `permissions` mejora la UX, pero Logger valida nuevamente el permiso en cada endpoint.

## 5. Recuperación de contraseña

### `POST /api/v1/auth/password-reset`

Ruta pública, sin Bearer:

```json
{ "email": "user@example.com" }
```

```ts
await fetch(`${API_URL}/api/v1/auth/password-reset`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});
```

Respuesta `202`:

```json
{ "accepted": true }
```

La respuesta es igual aunque el email no exista. Muestra siempre un mensaje neutral.

## 6. Usuarios

```ts
interface UserAdmin {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  roles: Array<{ id: string; code: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}
```

### Listar y consultar

```http
GET /api/v1/users
GET /api/v1/users/:id
```

Lista: `200 { "data": UserAdmin[] }`. Detalle: `200 { "data": UserAdmin }`. No hay filtros ni paginación. Un ID debe ser UUID; un usuario inexistente devuelve `404 USER_NOT_FOUND`.

### Crear e invitar

Consulta primero `GET /api/v1/roles` para obtener IDs válidos.

```http
POST /api/v1/users
```

```json
{
  "email": "user@example.com",
  "displayName": "Example User",
  "roleIds": ["ROLE_UUID"]
}
```

- `email`: requerido, email válido, máximo 320.
- `displayName`: opcional, 1 a 150 caracteres.
- `roleIds`: opcional, máximo 50 UUID.

Respuesta `201 { "data": UserAdmin }`. Logger crea el usuario local `ACTIVE`, la identidad Firebase y envía el email para establecer contraseña.

Errores: `404 ROLE_NOT_FOUND`, `409 USER_EMAIL_ALREADY_EXISTS`, `502 IDENTITY_PROVIDER_ERROR`.

### Actualizar

```http
PATCH /api/v1/users/:id
```

```json
{
  "email": "new@example.com",
  "displayName": null
}
```

El body no puede estar vacío. `displayName: null` elimina el nombre. Los roles se modifican en el endpoint de asignaciones. Respuesta `200 { "data": UserAdmin }`.

### Activar, suspender y reenviar email

```http
POST /api/v1/users/:id/activate
POST /api/v1/users/:id/suspend
POST /api/v1/users/:id/send-password-setup
```

No llevan body. Activar y suspender devuelven `200 { "data": UserAdmin }`; reenviar email devuelve `204`.

Conflictos de suspensión: `USER_CANNOT_SUSPEND_SELF` y `LAST_ADMIN_PROTECTED` (`409`).

## 7. Roles

```ts
interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Array<{ id: string; code: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}
```

### Listar y consultar

```http
GET /api/v1/roles
GET /api/v1/roles/:id
```

Respuestas: `{ "data": Role[] }` y `{ "data": Role }`. No hay paginación. Un rol inexistente devuelve `404 ROLE_NOT_FOUND`.

### Crear

```http
POST /api/v1/roles
```

```json
{
  "code": "sales_manager",
  "name": "Sales Manager",
  "description": "Manages sales operations"
}
```

`code` usa 2 a 80 caracteres, empieza con letra minúscula y acepta letras minúsculas, números, `:`, `_` y `-`. `name` es requerido y admite 150; `description` es opcional y admite 500.

Respuesta `201 { "data": Role }`. Código duplicado: `409 ROLE_CODE_ALREADY_EXISTS`.

### Actualizar y eliminar

```http
PATCH /api/v1/roles/:id
DELETE /api/v1/roles/:id
```

PATCH acepta `name` y `description`; `description: null` la elimina. `code` es inmutable y el body no puede estar vacío. Devuelve `200 { "data": Role }`.

DELETE devuelve `204`. Conflictos: `SYSTEM_ROLE_PROTECTED` para `admin` y `ROLE_IN_USE` cuando existen usuarios asignados.

## 8. Permisos y asignaciones

Los permisos son un catálogo de solo lectura:

```ts
interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
```

```http
GET /api/v1/permissions
GET /api/v1/permissions/:id
```

Respuestas: `{ "data": Permission[] }` y `{ "data": Permission }`. No hay filtros ni paginación. Un permiso inexistente devuelve `404 PERMISSION_NOT_FOUND`.

### Reemplazar roles del usuario

```http
PUT /api/v1/users/:id/roles
```

```json
{ "roleIds": ["ROLE_UUID_1", "ROLE_UUID_2"] }
```

Reemplaza el conjunto completo, acepta máximo 100 UUID y devuelve `204`. Enviar `[]` quita todos si las protecciones lo permiten. Errores: `USER_NOT_FOUND`, `ROLE_NOT_FOUND`, `USER_CANNOT_REMOVE_OWN_ADMIN`, `LAST_ADMIN_PROTECTED`.

### Reemplazar permisos del rol

```http
PUT /api/v1/roles/:id/permissions
```

```json
{ "permissionIds": ["PERMISSION_UUID_1", "PERMISSION_UUID_2"] }
```

Reemplaza el conjunto completo, acepta máximo 500 UUID y devuelve `204`. Errores: `ROLE_NOT_FOUND`, `PERMISSION_NOT_FOUND`, `SYSTEM_ROLE_PERMISSIONS_PROTECTED`.

El rol `admin` debe conservar `users:read`, `users:manage`, `rbac:read` y `rbac:manage`.

Para las pantallas de asignación: carga el recurso actual y el catálogo, inicializa todos los IDs seleccionados, envía el conjunto final completo y recarga después del `204`.

## 9. Products

```ts
interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Listar y consultar

```http
GET /api/v1/products
GET /api/v1/products/:id
```

Lista: `200 { "data": Product[] }`, ordenada por creación descendente y sin paginación. Detalle: `200 { "data": Product }`. ID inválido: `400 VALIDATION_ERROR`; inexistente: `404 PRODUCT_NOT_FOUND`.

### Crear

```http
POST /api/v1/products
```

```json
{
  "code": "PROD-001",
  "name": "Example product",
  "description": "Product description",
  "price": "100.50"
}
```

- `code`: requerido, 1 a 50.
- `name`: requerido, 1 a 150.
- `description`: opcional, máximo 500.
- `price`: string con máximo dos decimales.

No envíes `price` como número JSON. Respuesta `201 { "data": Product }`; duplicado: `409 PRODUCT_CODE_ALREADY_EXISTS`.

### Actualizar

```http
PATCH /api/v1/products/:id
```

```json
{
  "name": "Updated product",
  "description": null,
  "price": "120.00",
  "active": false
}
```

Todos los campos son opcionales, pero debe existir al menos uno. `description: null` elimina la descripción. Respuesta `200 { "data": Product }`.

### Eliminar

```http
DELETE /api/v1/products/:id
```

Respuesta `204`. Si debe conservarse historial, prefiere `PATCH { "active": false }` según la política funcional.

## 10. Health checks

No requieren autenticación y están orientados a diagnóstico:

```http
GET /health
GET /health/ready
GET /health/db
```

Liveness `200`:

```json
{ "status": "ok", "service": "logger-api", "environment": "development" }
```

Readiness devuelve `200 { "status": "ok", "database": "connected" }` o `503 { "status": "error", "database": "disconnected" }`.

## 11. Navegación y permisos

Flujo posterior al login:

```text
Firebase login
    ↓
GET /api/v1/auth/me
    ├── 200 → cargar navegación
    ├── 401 → renovar o volver al login
    ├── AUTH_USER_NOT_REGISTERED → falta aprovisionamiento
    ├── AUTH_USER_INACTIVE → cuenta inactiva
    └── 5xx/red → servicio no disponible
```

| Acción visual | Permiso |
| --- | --- |
| Menú Usuarios | `users:read` |
| Crear/editar/activar/suspender usuario | `users:manage` |
| Menú Roles y Permisos | `rbac:read` |
| Modificar roles y asignaciones | `rbac:manage` |
| Menú Products | `products:read` |
| Crear producto | `products:create` |
| Editar producto | `products:update` |
| Eliminar producto | `products:delete` |

Vuelve a consultar `/auth/me` al iniciar la aplicación, después del login y cuando cambien los roles del usuario actual.

## 12. Casos de prueba frontend

### Sesión

- Login, carga de `/auth/me` y renovación de token.
- Usuario no registrado, suspendido o sin permiso.
- Logger no disponible y rate limit `429`.

### Usuarios y RBAC

- Crear usuario con/sin roles, email inválido o duplicado.
- Editar email/nombre y eliminar nombre con `null`.
- Activar, suspender y proteger al último administrador.
- Reenviar email y manejar `204`.
- Crear rol, código inválido/duplicado y descripción `null`.
- Impedir eliminar `admin` o roles en uso.
- Reemplazar asignaciones sin perder selecciones.
- Conservar permisos obligatorios de `admin`.

### Products

- Listar, consultar, crear, actualizar y eliminar.
- UUID inválido, código duplicado y producto inexistente.
- Precio como string con cero, uno y dos decimales.
- Rechazar más de dos decimales y `PATCH {}`.
- Eliminar descripción con `null` y cambiar `active`.
- Verificar cada permiso por separado.

### Cliente HTTP

- No parsear JSON después de `204`.
- Funcionar sin `error.details`.
- Conservar `requestId` para soporte.
- Evitar bucles de reintentos ante `401` o `429`.
- Confirmar que tokens y secretos no aparecen en logs.

## 13. Checklist de entrega

- [ ] URL base y Firebase configurados por ambiente.
- [ ] Origen incluido en `CORS_ORIGINS`.
- [ ] Bearer agregado solo a rutas protegidas.
- [ ] Cliente maneja `204` y la excepción de `/auth/me` sin `data`.
- [ ] Fechas y precios tratados como strings.
- [ ] Navegación y acciones usan permisos.
- [ ] Asignaciones `PUT` envían el conjunto completo.
- [ ] Formularios no dependen de `error.details`.
- [ ] UX definida para `401`, `403`, `404`, `409`, `429` y `5xx`.
- [ ] Tokens y secretos no se guardan ni imprimen en logs.
- [ ] Pruebas de sesión, RBAC, usuarios y Products aprobadas.
