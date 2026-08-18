# Logger API v1

API REST modular para autenticación y autorización de Logger. Firebase Authentication es la fuente de identidad; PostgreSQL y Prisma son la fuente canónica de usuarios locales, estados, roles y permisos.

La v1 implementa una política segura de aprovisionamiento **invite-only**: tener una cuenta válida en Firebase no concede acceso automáticamente. El usuario también debe existir en PostgreSQL con el mismo `firebaseUid` y estado `ACTIVE`.

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Flujo de autenticación y autorización](#flujo-de-autenticación-y-autorización)
- [Requisitos](#requisitos)
- [Configuración](#configuración)
- [Inicio rápido](#inicio-rápido)
- [Base de datos y Prisma](#base-de-datos-y-prisma)
- [Aprovisionamiento de usuarios](#aprovisionamiento-de-usuarios)
- [Contrato HTTP](#contrato-http)
- [Seguridad y observabilidad](#seguridad-y-observabilidad)
- [Scripts disponibles](#scripts-disponibles)
- [Pruebas](#pruebas)
- [Docker y despliegue](#docker-y-despliegue)
- [Desarrollo de nuevos módulos](#desarrollo-de-nuevos-módulos)
- [Troubleshooting](#troubleshooting)

## Características

- Verificación de Firebase ID Tokens mediante Firebase Admin SDK.
- Usuarios locales con estados `PENDING`, `ACTIVE` y `SUSPENDED`.
- RBAC normalizado con roles, permisos y relaciones many-to-many.
- Middleware declarativo `requireRole`, `requirePermission` y `requireAnyPermission`.
- API versionada bajo `/api/v1`.
- Liveness y readiness checks sin efectos secundarios.
- Validación fail-fast de variables de entorno con Zod.
- Errores HTTP con formato estable y `requestId`.
- Logs JSON estructurados con Pino.
- CORS por allowlist, Helmet y rate limiting global.
- Graceful shutdown de HTTP y Prisma.
- Migraciones reproducibles y seed RBAC idempotente.
- Esquema base para auditoría de seguridad.
- TypeScript estricto y pruebas unitarias/HTTP con `node:test`.

## Stack tecnológico

| Componente  | Tecnología |
| ---         | --- |
| Runtime     | Node.js 22+ |
| Lenguaje    | TypeScript, ESM y `NodeNext` |
| HTTP        | Express 5 |
| Identidad   | Firebase Authentication / Firebase Admin |
| Persistencia | PostgreSQL 16 |
| ORM         | Prisma ORM 7 con `@prisma/adapter-pg` |
| Validación  | Zod |
| Logging     | Pino |
| Seguridad HTTP | Helmet, CORS y express-rate-limit |
| Pruebas     | Node Test Runner ejecutado con TSX |

## Arquitectura

El proyecto utiliza un monolito modular con dependencias explícitas. Los controladores no acceden directamente a Firebase ni a Prisma.

```text
src/
├── config/
│   └── env.ts                         # Lectura y validación del entorno
├── infrastructure/
│   ├── database/prisma-client.ts      # Instancia única de Prisma
│   ├── identity/firebase-token-verifier.ts
│   └── logging/logger.ts
├── modules/
│   ├── auth/                          # Token, sesión lógica y /auth/me
│   ├── users/                         # Contrato y repositorio de usuarios
│   ├── access-control/                # Evaluación RBAC y middleware
│   └── health/                        # Liveness y readiness
├── routes/index.ts                    # Composición de rutas
├── shared/
│   ├── errors/                        # Errores de aplicación
│   ├── http/                          # Contexto, validación y handlers
│   └── types/                         # Extensiones de tipos Express
├── app.ts                             # Construcción de Express
└── server.ts                          # Puerto, señales y cierre ordenado

prisma/
├── migrations/                        # Historial SQL versionado
├── schema.prisma                      # Modelo de persistencia
└── seed.ts                            # Roles y permisos iniciales

tests/                                 # Pruebas unitarias y HTTP
```

### Límites principales

- **Firebase** gestiona registro, credenciales, proveedores OAuth, MFA, recuperación y emisión de tokens.
- **PostgreSQL** gestiona acceso local, perfil, estado, roles, permisos y auditoría.
- **TokenVerifier** desacopla Auth del SDK de Firebase.
- **UserRepository** desacopla los casos de uso del modelo Prisma.
- **HTTP** transforma solicitudes y respuestas, pero no contiene consultas de persistencia.

## Flujo de autenticación y autorización

```mermaid
flowchart LR
    A[Authorization: Bearer ID Token] --> B[authenticate]
    B --> C[FirebaseTokenVerifier]
    C --> D[Identidad Firebase: uid y email]
    D --> E[PrismaUserRepository]
    E --> F{Usuario local ACTIVE}
    F -- No existe o inactivo --> G[403]
    F -- Sí --> H[Roles y permisos]
    H --> I[Controller o middleware RBAC]
```

1. El cliente obtiene un Firebase ID Token usando el SDK cliente de Firebase.
2. Envía `Authorization: Bearer <ID_TOKEN>` a Logger API.
3. `FirebaseTokenVerifier` valida firma, expiración y proyecto.
4. La API busca `users.firebase_uid` en PostgreSQL.
5. Solo un usuario `ACTIVE` continúa.
6. Roles y permisos se cargan desde PostgreSQL, no desde Firebase Custom Claims.

La v1 usa `verifyIdToken(token)` sin verificación de revocación remota en cada petición. Las operaciones sensibles futuras pueden utilizar una estrategia específica con `checkRevoked`.

## Requisitos

- Node.js `22` o superior.
- npm compatible con el `package-lock.json` incluido.
- Docker Engine con Docker Compose, o PostgreSQL 16 accesible externamente.
- Proyecto de Firebase.
- Cuenta de servicio de Firebase Admin con `project_id`, `client_email` y `private_key`.

Comprueba las herramientas:

```bash
node --version
npm --version
docker compose version
```

## Configuración

Crea el archivo local a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

En Bash:

```bash
cp .env.example .env
```

### Variables de entorno

| Variable    | Requerida | Valor de ejemplo | Descripción |
| ---         | --- | --- | --- |
| `NODE_ENV`  | No | `development` | `development`, `test` o `production`. |
| `PORT`      | No | `3000` | Puerto HTTP entre 1 y 65535. |
| `DATABASE_URL` | Sí | `postgresql://logger:...@localhost:5433/logger?schema=public` | Cadena de conexión usada por Prisma y `pg`. |
| `FIREBASE_PROJECT_ID` | Sí | `my-project` | ID del proyecto Firebase. |
| `FIREBASE_CLIENT_EMAIL` | Sí | `firebase-adminsdk@...` | Email de la cuenta de servicio. |
| `FIREBASE_PRIVATE_KEY` | Sí | `"-----BEGIN...\n..."` | Clave privada; los saltos deben representarse como `\n`. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Allowlist separada por comas, sin espacios requeridos. |
| `LOG_LEVEL` | No | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` o `silent`. |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Ventana global del rate limiter en milisegundos. |
| `RATE_LIMIT_MAX` | No | `100` | Máximo de peticiones por cliente y ventana. |
| `TRUST_PROXY` | No | `false` | Habilitar solo detrás de un proxy confiable correctamente configurado. |
| `SHUTDOWN_TIMEOUT_MS` | No | `10000` | Tiempo máximo para el cierre ordenado. |
| `POSTGRES_DB` | Solo Compose | `logger` | Base creada por el contenedor. |
| `POSTGRES_USER` | Solo Compose | `logger` | Usuario local de PostgreSQL. |
| `POSTGRES_PASSWORD` | Solo Compose | `logger_local` | Contraseña local; reemplazar fuera de desarrollo. |
| `POSTGRES_PORT` | Solo Compose | `5433` | Puerto publicado en el host. |

La aplicación no arranca si falta una variable obligatoria o su formato es inválido. Nunca almacenes `.env`, tokens ni JSON de cuentas de servicio en control de versiones.

### Clave privada de Firebase

Convierte los saltos de línea reales a `\n` dentro de `.env`:

```dotenv
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"
```

En producción es preferible inyectar secretos mediante el gestor de secretos de la plataforma.

## Inicio rápido

```bash
# 1. Instalar exactamente las dependencias bloqueadas
npm ci

# 2. Arrancar PostgreSQL local
docker compose up -d db

# 3. Validar el esquema y generar Prisma Client
npm run db:validate
npm run db:generate

# 4. Aplicar migraciones versionadas
npm run db:migrate:deploy

# 5. Crear/actualizar roles y permisos base
npm run db:seed

# 6. Iniciar en modo desarrollo
npm run dev
```

El servicio queda disponible en `http://localhost:3000` salvo que se cambie `PORT`.

Comprueba el arranque:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

## Base de datos y Prisma

### Modelo

| Modelo | Responsabilidad |
| --- | --- |
| `User` | Identidad local vinculada por `firebaseUid`, perfil y estado. |
| `Role` | Rol estable identificado mediante `code`. |
| `Permission` | Capacidad estable, por ejemplo `users:read`. |
| `UserRole` | Asignación many-to-many entre usuarios y roles. |
| `RolePermission` | Asignación many-to-many entre roles y permisos. |
| `AuditLog` | Registro append-only previsto para acciones de seguridad. |

Los códigos se usan en políticas y deben tratarse como contratos estables. Los nombres y descripciones son presentacionales.

### Estados de usuario

| Estado | Acceso autenticado |
| --- | --- |
| `PENDING` | Denegado con `403`. |
| `ACTIVE` | Permitido. |
| `SUSPENDED` | Denegado con `403`. |

### Migraciones

Durante desarrollo, crea y aplica una migración después de modificar `schema.prisma`:

```bash
npm run db:migrate -- --name descripcion_del_cambio
npm run db:generate
```

En CI y producción aplica exclusivamente migraciones ya versionadas:

```bash
npm run db:migrate:deploy
```

No uses `prisma db push`, `migrate reset` ni `--force-reset` contra bases con datos que deban conservarse.

### Seed RBAC

El seed es idempotente y crea:

- Rol `admin`.
- Permiso `users:read`.
- Permiso `users:manage`.
- Permiso `rbac:manage`.
- Relaciones entre el rol `admin` y esos permisos.

Ejecutarlo varias veces actualiza nombres y evita duplicados:

```bash
npm run db:seed
```

El seed no crea usuarios ni asigna automáticamente el rol `admin`.

## Aprovisionamiento de usuarios

Firebase y PostgreSQL deben compartir el mismo UID, pero tienen responsabilidades distintas.

1. Crea o identifica el usuario en Firebase Authentication.
2. Copia su Firebase UID.
3. Abre Prisma Studio:

```bash
npm exec prisma studio
```

4. Crea un registro `User` con:
   - `firebaseUid`: UID exacto de Firebase.
   - `email`: email único.
   - `displayName`: opcional.
   - `status`: `ACTIVE` para permitir acceso.
5. Si necesita RBAC, crea el registro correspondiente en `UserRole` usando el ID del usuario y el ID del rol.

Un token válido produce `403 AUTH_USER_NOT_REGISTERED` hasta que exista el usuario local. Un usuario `PENDING` o `SUSPENDED` produce `403 AUTH_USER_INACTIVE`.

## Contrato HTTP

### Headers comunes

| Header | Dirección | Descripción |
| --- | --- | --- |
| `Authorization` | Request | `Bearer <Firebase ID Token>` en rutas protegidas. |
| `X-Request-Id` | Request opcional | ID de correlación proporcionado por el cliente. |
| `X-Request-Id` | Response | ID recibido o UUID generado por la API. |
| `Content-Type` | Ambos | `application/json` cuando existe cuerpo JSON. |

El cuerpo JSON está limitado a `100kb`.

### `GET /health`

Liveness del proceso. No consulta PostgreSQL.

Respuesta `200`:

```json
{
  "status": "ok",
  "service": "logger-api",
  "environment": "development"
}
```

### `GET /health/ready`

Readiness de PostgreSQL mediante `SELECT 1`; no escribe datos.

Respuesta `200`:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Respuesta `503`:

```json
{
  "status": "error",
  "database": "disconnected"
}
```

`GET /health/db` es un alias de compatibilidad con el mismo comportamiento.

### `GET /api/v1/auth/me`

Devuelve el usuario local activo, roles y permisos efectivos.

Request:

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN"
```

Respuesta `200`:

```json
{
  "id": "a56f3204-61ac-4bee-a3dc-132b7fe9de74",
  "firebaseUid": "firebase-user-uid",
  "email": "user@example.com",
  "displayName": "Logger User",
  "status": "ACTIVE",
  "roles": ["admin"],
  "permissions": ["users:read", "users:manage", "rbac:manage"]
}
```

Los permisos duplicados entre varios roles se eliminan de la respuesta.

### Formato de errores

```json
{
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Invalid or expired authentication token",
    "requestId": "5fdca7d1-9452-445f-8243-d6b1672184b0"
  }
}
```

| Código | HTTP | Motivo |
| --- | --- | --- |
| `AUTH_MISSING_TOKEN` | `401` | No se envió `Authorization`. |
| `AUTH_INVALID_HEADER` | `401` | El header no cumple exactamente `Bearer <token>`. |
| `AUTH_INVALID_TOKEN` | `401` | Firebase rechazó o no pudo verificar el token. |
| `AUTH_REQUIRED` | `401` | Falta el contexto autenticado requerido. |
| `AUTH_USER_NOT_REGISTERED` | `403` | No existe un usuario local para el Firebase UID. |
| `AUTH_USER_INACTIVE` | `403` | El usuario está `PENDING` o `SUSPENDED`. |
| `AUTH_FORBIDDEN` | `403` | Falta el rol o permiso solicitado. |
| `VALIDATION_ERROR` | `400` | Entrada inválida en una ruta que usa validación. |
| `ROUTE_NOT_FOUND` | `404` | Método/ruta inexistente. |
| `INTERNAL_ERROR` | `500` | Error inesperado ocultado al cliente. |

Los detalles de validación solo se incluyen fuera de producción. Los stacks nunca se devuelven al cliente.

## Seguridad y observabilidad

### Controles activos

- Parsing estricto de `Authorization`.
- Verificación criptográfica mediante Firebase Admin.
- Estado de acceso consultado en PostgreSQL en cada petición autenticada.
- RBAC obtenido de PostgreSQL para evitar permisos desactualizados en tokens.
- Helmet y eliminación de `X-Powered-By`.
- CORS con allowlist; las solicitudes sin `Origin` siguen permitidas para CLI y servicios backend.
- Rate limiting global con headers estándar.
- Límite de cuerpo JSON.
- Logs JSON y redacción de authorization, cookies y tokens.
- Request ID en logs y respuestas.
- Mensajes seguros para errores internos.

### Logging

Cada petición finalizada genera un evento JSON con:

- `service` y `environment`.
- `requestId`.
- método y ruta.
- código HTTP.
- duración en milisegundos.
- ID local del actor cuando está disponible.

Configura `LOG_LEVEL=debug` para diagnóstico local y `info` o `warn` en producción. No registres tokens, secretos ni payloads completos con datos personales.

### Auditoría

El modelo `AuditLog` está disponible para registrar acciones de seguridad. En esta v1 todavía no se escriben eventos automáticamente. Cualquier implementación debe ser append-only y almacenar únicamente metadatos necesarios, nunca tokens ni secretos.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia TSX en watch mode. |
| `npm run build` | Genera Prisma Client y compila TypeScript a `dist/`. |
| `npm start` | Ejecuta `dist/server.js`; requiere un build previo. |
| `npm run typecheck` | Verifica TypeScript sin emitir archivos. |
| `npm test` | Ejecuta todas las pruebas `*.test.ts`. |
| `npm run db:generate` | Regenera Prisma Client. |
| `npm run db:validate` | Valida sintaxis, modelos y relaciones Prisma. |
| `npm run db:migrate -- --name <nombre>` | Crea/aplica una migración de desarrollo. |
| `npm run db:migrate:deploy` | Aplica migraciones pendientes sin crear nuevas. |
| `npm run db:seed` | Ejecuta el seed RBAC idempotente. |

## Pruebas

La suite actual cubre:

- Parsing estricto de Bearer tokens.
- Evaluación de roles y permisos.
- Respuesta HTTP de `/api/v1/auth/me` para un usuario activo.
- Rechazo de identidades Firebase no aprovisionadas localmente.

Ejecuta:

```bash
npm test
npm run typecheck
npm run build
```

Las pruebas HTTP usan dobles de `TokenVerifier` y `UserRepository`, por lo que no requieren Firebase ni PostgreSQL reales.

## Docker y despliegue

### PostgreSQL local

```bash
docker compose up -d db
docker compose ps
docker compose logs -f db
```

El servicio `db` usa PostgreSQL 16, healthcheck con `pg_isready` y volumen persistente `postgres_data`.

Detener sin borrar datos:

```bash
docker compose down
```

> `docker compose down -v` elimina permanentemente el volumen y todos los datos locales.

### Imagen de la API

El `Dockerfile` multi-stage compila con Node 22 y ejecuta la imagen final como usuario no privilegiado:

```bash
docker build -t logger-api:1.0.0 .
docker run --rm -p 3000:3000 --env-file .env logger-api:1.0.0
```

Si la API y PostgreSQL están en contenedores de la misma red, `DATABASE_URL` debe usar el hostname del servicio (`db:5432`) en lugar de `localhost:5433`.

### Secuencia de producción

1. Inyectar secretos y variables de entorno.
2. Aplicar `npm run db:migrate:deploy` desde un job de release con acceso a la base.
3. Desplegar la imagen de la API.
4. Configurar liveness en `/health` y readiness en `/health/ready`.
5. Enviar `SIGTERM` durante reemplazos para permitir graceful shutdown.

La imagen no ejecuta migraciones automáticamente al arrancar, evitando carreras entre múltiples réplicas.

## Desarrollo de nuevos módulos

Para mantener los límites arquitectónicos:

1. Crea `src/modules/<feature>/`.
2. Define tipos y contratos independientes de Express/Prisma cuando exista lógica reusable.
3. Encapsula consultas en un repositorio.
4. Mantén el controller limitado a HTTP.
5. Construye un router del módulo.
6. Regístralo en `src/routes/index.ts`.
7. Usa `validateRequest` con esquemas Zod para body, params o query.
8. Protege rutas con `authenticate`, `resolveCurrentUser` y el middleware RBAC necesario.
9. Añade pruebas unitarias y HTTP.

Ejemplo conceptual de una ruta protegida:

```ts
router.get(
  "/users",
  authenticate(tokenVerifier),
  resolveCurrentUser(userRepository),
  requirePermission("users:read"),
  listUsersController,
);
```

No importes Prisma directamente desde controllers ni uses Firebase Custom Claims como fuente canónica de autorización.

## Troubleshooting

### `Invalid environment configuration`

Revisa las variables indicadas por el mensaje. Las causas más frecuentes son una clave Firebase vacía, un email inválido, un puerto fuera de rango o un valor numérico incorrecto.

### `AUTH_INVALID_TOKEN`

- Confirma que se envía un Firebase **ID Token**, no un refresh token ni custom token.
- Confirma que el token pertenece a `FIREBASE_PROJECT_ID`.
- Revisa expiración y reloj del sistema.
- Verifica que la cuenta de servicio corresponde al proyecto.

### `AUTH_USER_NOT_REGISTERED`

El token es válido, pero no hay un registro en `users` con el mismo `firebaseUid`. Completa el aprovisionamiento local.

### `AUTH_USER_INACTIVE`

Actualiza el estado únicamente si la política de negocio permite acceso. `PENDING` y `SUSPENDED` se rechazan intencionalmente.

### Readiness devuelve `503`

```bash
docker compose ps
docker compose logs db
npm run db:migrate:deploy
```

Comprueba host, puerto, credenciales y base en `DATABASE_URL`. Desde el host usa normalmente `localhost:5433`; desde otro contenedor usa `db:5432`.

### Prisma Client desactualizado

Después de modificar `schema.prisma`:

```bash
npm run db:validate
npm run db:generate
npm run typecheck
```

### CORS bloquea el frontend

Añade el origen exacto, incluyendo protocolo y puerto:

```dotenv
CORS_ORIGINS=http://localhost:5173,https://app.example.com
```

Reinicia la API después de cambiar el entorno.

## Estado de la v1

La v1 proporciona el núcleo reutilizable de identidad local y RBAC. No incluye todavía endpoints administrativos de usuarios/roles, escritura automática de auditoría, OpenAPI, multi-tenancy ni aprovisionamiento just-in-time.

## Licencia

ISC.