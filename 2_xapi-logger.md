# Usar Logger como API externa

Esta guía describe cómo utilizar Logger como un servicio independiente de identidad, usuarios y autorización, mientras los módulos de negocio —ventas, compras, inventarios, producción u otros— viven en otra API y otra base de datos.

En este modelo no se implementan entidades de negocio dentro de Logger. El proyecto consumidor integra Logger exclusivamente mediante HTTP.

## 1. Responsabilidades de cada servicio

| Logger | API de negocio |
| --- | --- |
| Validar Firebase ID Tokens | Implementar ventas, compras, inventario, etc. |
| Verificar que el usuario local exista y esté `ACTIVE` | Conservar los datos propios del negocio |
| Administrar usuarios e identidades Firebase | Validar reglas específicas del dominio |
| Administrar roles y asignaciones | Autorizar cada endpoint de negocio |
| Devolver roles y permisos efectivos | Auditar las operaciones del negocio |
| Auditar cambios administrativos de Logger | Mantener sus migraciones y disponibilidad |

La API externa nunca debe consultar directamente la base PostgreSQL de Logger. La integración se realiza mediante sus endpoints HTTP versionados.

Logger tampoco conoce las operaciones ejecutadas en la API externa. Por tanto, una venta creada o un movimiento de inventario debe auditarse en el servicio de negocio; `AuditLog` de Logger solo registra acciones que Logger ejecuta.

## 2. Arquitectura recomendada

```text
┌──────────────────┐
│ Frontend / móvil │
└────────┬─────────┘
         │ 1. Login con Firebase SDK
         ▼
┌──────────────────┐
│ Firebase Auth    │
└────────┬─────────┘
         │ 2. Firebase ID Token
         ▼
┌──────────────────┐       4. GET /api/v1/auth/me
│ API de negocio   │ ───────────────────────────────┐
└────────┬─────────┘                                ▼
         │                               ┌──────────────────┐
         │ 5. Ejecutar operación         │ Logger API       │
         │    autorizada                 │ identidad + RBAC │
         ▼                               └────────┬─────────┘
┌──────────────────┐                              │
│ Base de negocio  │                              ▼
└──────────────────┘                     ┌──────────────────┐
                                         │ PostgreSQL Logger│
                                         └──────────────────┘
```

El cliente envía el mismo Firebase ID Token a la API de negocio. Esta llama a Logger con ese token para obtener la identidad local, estado, roles y permisos efectivos.

## 3. Elegir el alcance de la integración

### Modalidad A: Logger para identidad y estado de acceso

La API de negocio utiliza `/api/v1/auth/me` para confirmar:

- que el token Firebase es válido;
- que la identidad está aprovisionada en Logger;
- que el usuario está `ACTIVE`;
- cuál es el identificador local del usuario.

Los roles y permisos propios del negocio se administran en la API externa.

Esta modalidad no requiere declarar permisos de ventas, compras o inventarios dentro de Logger.

### Modalidad B: Logger para identidad y RBAC centralizado

Además de validar al usuario, la API de negocio utiliza `roles` y `permissions` devueltos por `/api/v1/auth/me` para proteger sus endpoints.

Los permisos de negocio deben existir previamente en el catálogo de Logger, por ejemplo:

```text
sales:read
sales:create
sales:approve
inventory:read
inventory:adjust
```

Actualmente el catálogo de permisos es de solo lectura por API. No existe un endpoint para crear códigos de permiso dinámicamente. El equipo que opera Logger debe declararlos y ejecutar el seed antes de asignarlos a roles.

La forma recomendada es registrar un docType de integración sin CRUD que publique únicamente los permisos del sistema externo. Esto no traslada las entidades de negocio a Logger; funciona como manifiesto versionado de capacidades:

```ts
// src/modules/external-project/external-project.doc-type.ts
import { Router } from "express";
import type { DocType } from "../doc-types/doc-type.js";

type ExternalProjectApi = Record<string, never>;

export const externalProjectDocType: DocType<ExternalProjectApi> = {
  name: "external-project",
  route: "/external-project",
  permissions: [
    { code: "sales:read", name: "Read sales" },
    { code: "sales:create", name: "Create sales" },
    { code: "sales:approve", name: "Approve sales" },
    { code: "inventory:read", name: "Read inventory" },
    { code: "inventory:adjust", name: "Adjust inventory" },
  ],
  register() {
    return { api: {}, router: Router() };
  },
};
```

Después se agrega al arreglo `businessDocTypes` y se ejecuta:

```bash
npm run db:seed
```

Si el equipo no quiere mantener ni siquiera este manifiesto en Logger, debe utilizar la modalidad A y conservar el RBAC de negocio en su propio servicio.

## 4. Preparar y desplegar Logger

Logger necesita:

- Node.js 22 o la imagen Docker del proyecto;
- PostgreSQL 16, local, remoto o administrado;
- un proyecto de Firebase Authentication;
- credenciales de Firebase Admin;
- la Web API Key de Firebase para invitaciones y recuperación de contraseña;
- HTTPS en cualquier entorno no local.

Variables principales:

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@postgres-host:5432/logger?schema=public
FIREBASE_PROJECT_ID=my-firebase-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY=my-firebase-web-api-key
CORS_ORIGINS=https://app.example.com
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
TRUST_PROXY=true
```

`TRUST_PROXY=true` solo debe utilizarse detrás de un proxy confiable correctamente configurado.

Secuencia de despliegue:

```bash
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run build
npm start
```

Configura monitoreo sobre:

- `GET /health`: proceso HTTP disponible.
- `GET /health/ready`: conexión PostgreSQL disponible.

La API consumidora debe guardar la URL de Logger como configuración, preferiblemente apuntando a su dirección privada:

```dotenv
LOGGER_API_URL=https://logger.internal.example.com
```

`CORS_ORIGINS` solo controla llamadas realizadas por navegadores. No protege ni bloquea tráfico backend-to-backend. Si existe un panel administrativo web que llama directamente a Logger, agrega su origen exacto a la allowlist.

## 5. Configurar Firebase en el cliente

El frontend o aplicación móvil inicia sesión directamente con el SDK cliente de Firebase. Logger nunca recibe ni almacena contraseñas.

El proyecto Firebase del cliente debe coincidir con `FIREBASE_PROJECT_ID` configurado en Logger. Un token emitido por otro proyecto será rechazado.

Flujo del cliente:

1. Iniciar sesión con Firebase.
2. Obtener un Firebase ID Token vigente mediante el SDK.
3. Enviar `Authorization: Bearer <ID_TOKEN>` a la API de negocio.
4. Renovar el token mediante el SDK cuando corresponda.

No envíes refresh tokens, custom tokens, credenciales de la cuenta de servicio ni contraseñas a Logger o a la API de negocio.

## 6. Aprovisionar el primer administrador

El seed crea el rol `admin` y los permisos, pero no crea usuarios. El primer administrador requiere un bootstrap controlado:

1. Ejecutar migraciones y `npm run db:seed`.
2. Crear la identidad inicial en Firebase Authentication.
3. Crear el registro `User` local con el mismo `firebaseUid`, email y estado `ACTIVE`.
4. Buscar el rol `admin` generado por el seed.
5. Crear la relación `UserRole` entre el usuario y el rol.
6. Confirmar que `GET /api/v1/auth/me` devuelve el rol `admin`.

Este bootstrap puede realizarse mediante Prisma Studio o una herramienta administrativa protegida. No expongas una ruta pública que permita autoconcederse el rol `admin`.

Después del bootstrap, los siguientes usuarios se administran mediante la API de Access Management.

## 7. Validar una petición desde la API de negocio

Por cada petición protegida, el backend consumidor debe reenviar a Logger:

```http
GET /api/v1/auth/me HTTP/1.1
Host: logger.internal.example.com
Authorization: Bearer <FIREBASE_ID_TOKEN>
X-Request-Id: <REQUEST_ID>
```

Respuesta `200`:

```json
{
  "id": "a56f3204-61ac-4bee-a3dc-132b7fe9de74",
  "firebaseUid": "firebase-user-uid",
  "email": "user@example.com",
  "displayName": "Logger User",
  "status": "ACTIVE",
  "lastLoginAt": "2026-08-18T12:00:00.000Z",
  "roles": ["sales_manager"],
  "permissions": ["sales:read", "sales:create", "sales:approve"]
}
```

Ejemplo conceptual de middleware TypeScript para la API externa:

```ts
interface LoggerUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: "ACTIVE";
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
}

async function resolveLoggerUser(
  authorization: string | undefined,
  requestId: string,
): Promise<LoggerUser> {
  if (!authorization) {
    throw new HttpError(401, "AUTH_MISSING_TOKEN");
  }

  let response: Response;
  try {
    response = await fetch(`${LOGGER_API_URL}/api/v1/auth/me`, {
      headers: {
        authorization,
        "x-request-id": requestId,
      },
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    throw new HttpError(503, "IDENTITY_SERVICE_UNAVAILABLE");
  }

  if (response.status === 401 || response.status === 403) {
    const body = await response.json();
    throw new HttpError(response.status, body.error?.code ?? "AUTH_REJECTED");
  }
  if (!response.ok) {
    throw new HttpError(503, "IDENTITY_SERVICE_UNAVAILABLE");
  }

  return response.json() as Promise<LoggerUser>;
}
```

El nombre de `HttpError` y la integración con el framework dependen de la API consumidora.

## 8. Autorizar endpoints externos

Logger autentica al usuario y devuelve sus permisos, pero no puede proteger automáticamente una ruta que existe en otro servicio. La API de negocio debe comprobar el permiso requerido:

```ts
function requirePermission(user: LoggerUser, permission: string): void {
  if (!user.permissions.includes(permission)) {
    throw new HttpError(403, "AUTH_FORBIDDEN");
  }
}

const user = await resolveLoggerUser(authorization, requestId);
requirePermission(user, "sales:create");
await salesService.create(input, { actorUserId: user.id, requestId });
```

El frontend puede ocultar botones según `permissions`, pero esa comprobación es solo visual. El backend debe volver a autorizar cada operación.

En la base de datos externa se recomienda conservar `user.id` de Logger como identificador del actor. `firebaseUid` también es estable, pero no debe utilizarse como sustituto de la autorización.

## 9. Administrar usuarios y RBAC mediante HTTP

Todas las rutas administrativas requieren un Firebase ID Token de un usuario Logger autorizado.

### Usuarios

| Operación | Endpoint | Permiso |
| --- | --- | --- |
| Listar | `GET /api/v1/users` | `users:read` |
| Consultar | `GET /api/v1/users/:id` | `users:read` |
| Crear e invitar | `POST /api/v1/users` | `users:manage` |
| Actualizar | `PATCH /api/v1/users/:id` | `users:manage` |
| Activar | `POST /api/v1/users/:id/activate` | `users:manage` |
| Suspender | `POST /api/v1/users/:id/suspend` | `users:manage` |
| Reenviar configuración de contraseña | `POST /api/v1/users/:id/send-password-setup` | `users:manage` |

Crear un usuario:

```bash
curl -X POST "$LOGGER_API_URL/api/v1/users" \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: onboarding-user-001" \
  -d '{
    "email": "user@example.com",
    "displayName": "Example User",
    "roleIds": ["ROLE_UUID"]
  }'
```

Logger crea la identidad Firebase, el usuario local y envía el correo de configuración de contraseña.

### Roles y permisos

| Operación | Endpoint | Permiso |
| --- | --- | --- |
| Listar roles | `GET /api/v1/roles` | `rbac:read` |
| Crear rol | `POST /api/v1/roles` | `rbac:manage` |
| Actualizar rol | `PATCH /api/v1/roles/:id` | `rbac:manage` |
| Eliminar rol | `DELETE /api/v1/roles/:id` | `rbac:manage` |
| Listar permisos | `GET /api/v1/permissions` | `rbac:read` |
| Consultar permiso | `GET /api/v1/permissions/:id` | `rbac:read` |
| Reemplazar roles de usuario | `PUT /api/v1/users/:id/roles` | `rbac:manage` |
| Reemplazar permisos de rol | `PUT /api/v1/roles/:id/permissions` | `rbac:manage` |

Ejemplo de configuración:

```bash
# 1. Crear rol
curl -X POST "$LOGGER_API_URL/api/v1/roles" \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "sales_manager",
    "name": "Sales Manager",
    "description": "Manages sales operations"
  }'

# 2. Consultar IDs del catálogo de permisos
curl "$LOGGER_API_URL/api/v1/permissions" \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN"

# 3. Reemplazar todos los permisos del rol
curl -X PUT "$LOGGER_API_URL/api/v1/roles/ROLE_UUID/permissions" \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionIds":["PERMISSION_UUID_1","PERMISSION_UUID_2"]}'

# 4. Reemplazar todos los roles del usuario
curl -X PUT "$LOGGER_API_URL/api/v1/users/USER_UUID/roles" \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleIds":["ROLE_UUID"]}'
```

Los endpoints `PUT` reemplazan el conjunto completo. El consumidor debe enviar todos los IDs que deben permanecer asignados, no solamente los nuevos.

## 10. Recuperación de contraseña

El cliente puede solicitar el correo de recuperación mediante:

```http
POST /api/v1/auth/password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

Logger devuelve `202 { "accepted": true }` incluso si Firebase no reconoce el email, evitando revelar qué cuentas existen.

## 11. Interpretar errores

| Respuesta de Logger | Significado para la API externa | Respuesta recomendada |
| --- | --- | --- |
| `401 AUTH_MISSING_TOKEN` | No existe token | `401` |
| `401 AUTH_INVALID_HEADER` | Bearer mal formado | `401` |
| `401 AUTH_INVALID_TOKEN` | Token inválido o vencido | `401` |
| `403 AUTH_USER_NOT_REGISTERED` | Identidad Firebase sin usuario local | `403` |
| `403 AUTH_USER_INACTIVE` | Usuario `PENDING` o `SUSPENDED` | `403` |
| `403 AUTH_FORBIDDEN` | Falta un permiso administrativo | `403` |
| `429` | Rate limit de Logger | `503` o reintento controlado |
| `5xx`, timeout o error de red | Logger no está disponible | `503` y acceso denegado |

Conserva el `requestId` de Logger en logs internos para correlacionar incidentes. No expongas stacks ni mensajes internos.

## 12. Disponibilidad, caché y rate limiting

Consultar `/auth/me` por cada petición proporciona revocación local inmediata: una suspensión o cambio de roles se refleja en la siguiente llamada. También convierte Logger en una dependencia de tiempo de ejecución.

Recomendaciones:

- usar una URL privada entre backends cuando sea posible;
- aplicar timeout corto y política **fail closed**;
- no permitir operaciones si Logger no puede confirmar la identidad;
- monitorear latencia, `429`, `5xx` y disponibilidad;
- propagar `X-Request-Id`;
- no reintentar indiscriminadamente respuestas `401` o `403`;
- configurar `RATE_LIMIT_MAX` para el tráfico agregado esperado.

Si todas las consultas llegan desde una única IP de la API de negocio, el límite global por IP puede agotarse rápidamente. Dimensiona el rate limiter para ese patrón y configura correctamente el proxy.

Es posible utilizar una caché breve de respuestas exitosas, pero introduce una ventana durante la cual una suspensión o revocación de permisos puede no aplicarse. Si se usa:

- mantener un TTL corto;
- no cachear errores ni tokens vencidos;
- no compartir resultados entre tokens o usuarios;
- omitir caché en operaciones sensibles;
- documentar la ventana de revocación aceptada.

## 13. Límites actuales

- Logger acepta Firebase ID Tokens; no ofrece actualmente OAuth client credentials ni API keys para autenticación máquina-a-máquina.
- Una cuenta de servicio Firebase o un custom token no debe enviarse directamente como Bearer; Logger espera un ID Token verificable.
- Para automatizaciones sin usuario final se necesita una identidad Firebase dedicada y aprovisionada con privilegios mínimos, o implementar explícitamente un flujo de servicio adicional.
- Logger no crea permisos por HTTP; el catálogo se versiona y se aplica mediante seed.
- Logger no autoriza automáticamente endpoints externos; el backend consumidor debe comprobar los permisos.
- Logger no audita acciones de negocio realizadas fuera de su proceso.
- Logger no comparte su base de datos como contrato de integración.

## 14. Seguridad mínima

- Usar HTTPS y una red privada entre servicios cuando sea posible.
- Guardar credenciales Firebase Admin únicamente en Logger.
- No enviar credenciales administrativas de Firebase a la API de negocio.
- No registrar headers `Authorization`, cookies ni tokens.
- Validar permisos en el backend, nunca solo en el frontend.
- Aplicar privilegio mínimo a roles y usuarios técnicos.
- Suspender usuarios desde Logger para cortar el acceso local.
- Rotar secretos y limitar el acceso a `DATABASE_URL`.
- Restringir CORS a orígenes conocidos; CORS no sustituye autenticación.
- Proteger endpoints administrativos y no exponerlos mediante proxies sin controles equivalentes.

## 15. Checklist de integración

- [ ] Logger desplegado con PostgreSQL, Firebase Admin y HTTPS.
- [ ] Migraciones y seed aplicados.
- [ ] Primer administrador aprovisionado de forma controlada.
- [ ] Frontend configurado con el mismo proyecto Firebase.
- [ ] Modalidad A o B elegida explícitamente.
- [ ] Permisos externos declarados si se utiliza RBAC centralizado.
- [ ] Middleware de la API externa consulta `/api/v1/auth/me`.
- [ ] Cada endpoint externo comprueba su permiso requerido.
- [ ] Errores `401`, `403`, `429`, timeout y `5xx` gestionados.
- [ ] Timeout, rate limiting y política de caché definidos.
- [ ] `X-Request-Id` propagado entre servicios.
- [ ] Auditoría del negocio implementada en la API externa.
- [ ] Tokens y secretos excluidos de logs.
- [ ] Pruebas de suspensión y cambios de permisos completadas.

## 16. Pruebas de aceptación recomendadas

1. Token válido, usuario `ACTIVE` y permiso requerido: operación permitida.
2. Token ausente, mal formado o inválido: `401`.
3. Identidad Firebase no aprovisionada: `403 AUTH_USER_NOT_REGISTERED`.
4. Usuario suspendido: `403 AUTH_USER_INACTIVE`.
5. Usuario activo sin permiso: la API externa responde `403`.
6. Permiso agregado o retirado de un rol: `/auth/me` refleja el cambio.
7. Logger fuera de servicio: la API externa responde `503` y no ejecuta la operación.
8. Auditoría externa conserva `user.id` y `requestId` como actor y correlación.
9. El rate limiter soporta el tráfico agregado del backend consumidor.
10. Ningún log contiene Firebase ID Tokens o secretos.
