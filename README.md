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
- [Guía de implementación de un módulo CRUD en Logger](#guía-de-implementación-de-un-módulo-crud-en-logger)
- [Guía para crear nuevos módulos con docTypes](./1_guia_new_modulo.md)
- [Usar Logger como API externa](./2_xapi-logger.md)
- [Guía oficial para frontend](./front_guia-logger.md)
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
- Auditoría append-only para acciones administrativas y escrituras de módulos de negocio.
- Registro declarativo de módulos de negocio mediante docTypes.
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
| Contenedores | Docker y Docker Compose para PostgreSQL local |
| Validación  | Zod |
| Logging     | Pino |
| Seguridad HTTP | Helmet, CORS y express-rate-limit |
| Pruebas     | Node Test Runner ejecutado con TSX |

En el entorno de desarrollo de este proyecto, Docker Compose se utiliza para levantar PostgreSQL de forma reproducible. Docker no es obligatorio: Logger también puede conectarse directamente a una instancia PostgreSQL local, remota o administrada configurando `DATABASE_URL` con el host, puerto, base y credenciales correspondientes.

## Arquitectura

El proyecto utiliza un monolito modular con dependencias explícitas. `src/core` y `src/modules/access-management` son los pilares estables de Logger: el primero resuelve autenticación, usuario local, RBAC y auditoría; el segundo administra usuarios, roles, permisos y sus asignaciones. Los módulos de negocio se agregan como docTypes y no deben modificar esos pilares.

Los controladores no acceden directamente a Firebase ni a Prisma.

```text
src/
├── config/
│   └── env.ts                         # Lectura y validación del entorno
├── infrastructure/
│   ├── database/prisma-client.ts      # Instancia única de Prisma
│   ├── identity/firebase-token-verifier.ts
│   └── logging/logger.ts
├── core/                              # Pilar estable de Logger
│   ├── auth/                          # Identidad, token y /auth/me
│   ├── users/                         # Usuario local y repositorio
│   ├── access-control/                # Evaluación RBAC y middleware
│   └── audit/                         # Contratos y servicio de auditoría
├── modules/
│   ├── access-management/             # Administración de usuarios, roles y permisos
│   ├── doc-types/                     # Registro de módulos de negocio
│   ├── products/                      # Módulo/docType de referencia
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
- **Core** contiene capacidades transversales estables; un módulo de negocio las consume mediante contratos y no las reimplementa.
- **Access Management** es el único módulo responsable de administrar usuarios, roles, permisos y asignaciones RBAC.
- **DocTypeRegistry** registra rutas, permisos, dependencias y APIs públicas sin modificar los pilares por cada módulo nuevo.

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
| `WINTER_DATABASE_URL` | Sí | `postgresql://logger:...@localhost:5433/logger?schema=public` | Cadena de conexión usada por Prisma y `pg`. |
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
| `AuditLog` | Registro append-only de acciones administrativas y de negocio. |

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
- Permiso `rbac:read`.
- Permiso `rbac:manage`.
- Permisos declarados por los docTypes registrados.
- Relaciones entre el rol `admin` y todos esos permisos.

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
  "database": "connected",
  "message": "Hello World!"
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

El modelo `AuditLog` registra acciones administrativas y escrituras relevantes de los módulos de negocio. Cada evento conserva actor, recurso, `requestId`, IP y metadata mínima. La auditoría es append-only y nunca debe almacenar tokens, secretos ni payloads personales completos.

Cuando la mutación y `AuditLog` utilizan PostgreSQL, deben ejecutarse en una misma transacción. Así una falla de auditoría revierte la operación de negocio y la API no informa un resultado ambiguo.

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

## Guía de implementación de un módulo CRUD en Logger

Esta guía describe cómo añadir una entidad y su CRUD a un proyecto construido sobre Logger. Parte de que la autenticación ya está configurada: Firebase valida la identidad, `resolveCurrentUser` carga al usuario local y PostgreSQL conserva sus roles y permisos. El módulo solo debe implementar su dominio y conectarse a esos mecanismos existentes.

El módulo `products` incluido en el repositorio es la referencia ejecutable. Sustituye `product` y `products` por el nombre singular y plural de tu entidad.

### Resultado esperado

Un CRUD completo expone un contrato similar al siguiente:

| Método | Endpoint | Permiso | Resultado |
| --- | --- | --- | --- |
| `GET` | `/api/v1/products` | `products:read` | Lista de entidades |
| `GET` | `/api/v1/products/:id` | `products:read` | Una entidad |
| `POST` | `/api/v1/products` | `products:create` | Entidad creada |
| `PATCH` | `/api/v1/products/:id` | `products:update` | Entidad actualizada |
| `DELETE` | `/api/v1/products/:id` | `products:delete` | Respuesta `204` |

La dependencia entre capas debe mantenerse en una sola dirección:

```text
Route → Controller → Service → Repository → Prisma → PostgreSQL
  │
  └── authenticate → resolveCurrentUser → requirePermission
```

- El controller traduce HTTP; no usa Prisma ni contiene reglas de negocio.
- El service trabaja con DTO y contratos; no conoce Express.
- El repository es el único responsable de persistir y mapear datos.
- El router compone dependencias, seguridad, validación y handlers.
- Firebase Custom Claims no es la fuente de autorización; los permisos se resuelven desde PostgreSQL.

### 1. Diseñar la entidad y su contrato HTTP

Antes de escribir código, define:

- campos requeridos, opcionales, únicos y valores por defecto;
- relaciones y política de borrado;
- reglas de negocio e invariantes;
- operaciones permitidas y permisos necesarios;
- respuestas HTTP y errores esperados.

Para `Product`, por ejemplo, `code` es único, `price` conserva dos decimales y `active` permite desactivar sin eliminar. Se utiliza `PATCH`, por lo que un campo ausente significa “no modificar”; `null` solo se acepta cuando el dominio permite borrar el valor.

### 2. Añadir el modelo Prisma y la migración

Agrega el modelo en `prisma/schema.prisma`:

```prisma
model Product {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  description String?
  price       Decimal  @db.Decimal(12, 2)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("products")
}
```

Valida el esquema, crea una migración descriptiva y regenera el cliente:

```bash
npm run db:validate
npm run db:migrate -- --name add_products
npm run db:generate
```

Versiona tanto `schema.prisma` como la migración generada. En CI y producción aplica migraciones existentes con `npm run db:migrate:deploy`; no uses `db push`, `migrate reset` ni `--force-reset` sobre datos que deban conservarse.

### 3. Registrar permisos RBAC

Declara permisos estables y específicos de la capacidad dentro del docType del módulo:

```ts
permissions: [
  { code: "products:read", name: "Read products" },
  { code: "products:create", name: "Create products" },
  { code: "products:update", name: "Update products" },
  { code: "products:delete", name: "Delete products" },
],
```

`prisma/seed.ts` agrega automáticamente los permisos publicados por `businessDocTypes` y los asocia al rol `admin` mediante `upsert`. Ejecuta el seed después de registrar el módulo:

```bash
npm run db:seed
```

En otros proyectos, decide explícitamente qué roles reciben cada permiso. Ocultar una acción en el frontend mejora la experiencia, pero nunca reemplaza `requirePermission` en la API.

### 4. Crear la estructura del módulo

Organiza el código por dominio:

```text
src/modules/products/
├── product.model.ts
├── product.dto.ts
├── product.api.ts
├── product.schema.ts
├── product.repository.ts
├── prisma-product.repository.ts
├── product.unit-of-work.ts
├── prisma-product.unit-of-work.ts
├── product.service.ts
├── product.controller.ts
├── product.routes.ts
└── product.doc-type.ts
```

No crees conexiones nuevas a PostgreSQL o Firebase dentro del módulo. Reutiliza el cliente Prisma y las dependencias de autenticación que Logger compone en `src/app.ts` y `src/routes/index.ts`.

### 5. Definir modelo de dominio y DTO

El modelo representa lo que devuelve el módulo, sin filtrar tipos de Prisma hacia las demás capas:

```ts
// product.model.ts
export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Los DTO describen los datos aceptados por los casos de uso:

```ts
// product.dto.ts
export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  price: string;
}

export interface UpdateProductDto {
  code?: string;
  name?: string;
  description?: string | null;
  price?: string;
  active?: boolean;
}
```

`price` se expone como string para no perder precisión decimal al convertirlo a `number` en JavaScript.

### 6. Definir el contrato del repository

El service debe depender de una abstracción, no de Prisma:

```ts
// product.repository.ts
import type { CreateProductDto, UpdateProductDto } from "./product.dto.js";
import type { Product } from "./product.model.js";

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  findByCode(code: string): Promise<Product | null>;
  create(data: CreateProductDto): Promise<Product>;
  update(id: string, data: UpdateProductDto): Promise<Product>;
  delete(id: string): Promise<void>;
}
```

La implementación `prisma-product.repository.ts` recibe un cliente compatible mediante el constructor, ejecuta `client.product.*` y mapea el resultado al modelo de dominio. No importes la instancia global: la inyección permite pruebas aisladas y permite usar el mismo repository dentro de una transacción Prisma.

Con `exactOptionalPropertyTypes: true`, no envíes propiedades con `undefined` a Prisma. Inclúyelas condicionalmente:

```ts
data: {
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.description !== undefined
    ? { description: input.description }
    : {}),
}
```

Esto distingue “no modificar” de “asignar `null`”. También captura y transforma errores conocidos de persistencia cuando una restricción pueda competir entre la comprobación del service y la escritura en base de datos.

### 7. Implementar reglas de negocio en el service

El service coordina el repository y devuelve errores de aplicación consistentes:

```ts
// fragmento de product.service.ts
async getById(id: string) {
  const product = await this.productRepository.findById(id);

  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
  }

  return product;
}

async create(data: CreateProductDto, context: AuthenticatedAuditContext) {
  return this.unitOfWork.execute(async ({ products, audit }) => {
    if (await products.findByCode(data.code)) {
      throw new AppError(
        "PRODUCT_CODE_ALREADY_EXISTS",
        "A product with this code already exists",
        409,
      );
    }

    const product = await products.create(data);
    await audit.record(context, {
      action: "PRODUCT_CREATED",
      resourceType: "product",
      resourceId: product.id,
      metadata: { code: product.code, name: product.name },
    });
    return product;
  });
}
```

Usa nombres de error prefijados por el dominio (`PRODUCT_*`, `ORDER_*`) y códigos HTTP previsibles: `404` para inexistencia, `409` para conflicto y `400` para entrada inválida. No devuelvas detalles internos de Prisma al cliente.

Las escrituras relevantes integran `AuditService`: el controller construye el contexto mediante `buildAuthenticatedAuditContext(req, res)` y el service guarda la mutación y su evento dentro de `ProductUnitOfWork`. No almacenes tokens, secretos ni payloads personales completos en auditoría.

### 8. Validar params y body con Zod

Define schemas independientes para params, creación y actualización:

```ts
// product.schema.ts
import { z } from "zod";

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createProductSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    description: z.string().trim().max(500).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
```

`validateRequest` debe ejecutarse antes del controller. Así todos los errores de entrada usan `VALIDATION_ERROR` y el frontend puede consumir `details.formErrors` y `details.fieldErrors` de manera uniforme.

### 9. Implementar el controller

El controller solo recibe la solicitud, llama al service y construye la respuesta. Reenvía los errores al handler global:

```ts
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = buildAuthenticatedAuditContext(req, res);
    const product = await this.productService.create(req.body, context);
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
};

delete = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const context = buildAuthenticatedAuditContext(req, res);
    await this.productService.delete(req.params.id, context);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
```

Mantén estable el formato de éxito (`{ "data": ... }`) y no respondas con cuerpo en un `204`.

### 10. Componer y proteger las rutas

El router recibe el service ya construido por el docType y se limita a seguridad, validación y HTTP:

```ts
export function createProductRouter(
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  productService: ProductService,
) {
  const controller = new ProductController(productService);
  const router = Router();
  const auth = [
    authenticate(tokenVerifier),
    resolveCurrentUser(userRepository),
  ] as const;

  router.get("/", ...auth, requirePermission("products:read"), controller.list);
  router.get(
    "/:id",
    ...auth,
    requirePermission("products:read"),
    validateRequest({ params: productIdParamsSchema }),
    controller.getById,
  );
  router.post(
    "/",
    ...auth,
    requirePermission("products:create"),
    validateRequest({ body: createProductSchema }),
    controller.create,
  );
  router.patch(
    "/:id",
    ...auth,
    requirePermission("products:update"),
    validateRequest({ params: productIdParamsSchema, body: updateProductSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    ...auth,
    requirePermission("products:delete"),
    validateRequest({ params: productIdParamsSchema }),
    controller.delete,
  );

  return router;
}
```

El orden esperado es autenticación, resolución del usuario local, autorización, validación y controller. Una identidad Firebase válida no basta: `resolveCurrentUser` exige que el usuario local exista y esté `ACTIVE`.

### 11. Declarar y registrar el docType

Cada módulo de negocio exporta un docType con su identidad, ruta, permisos y API pública:

```ts
export const productDocType: DocType<ProductApi> = {
  name: "products",
  route: "/products",
  permissions: [
    { code: "products:read", name: "Read products" },
    { code: "products:create", name: "Create products" },
    { code: "products:update", name: "Update products" },
    { code: "products:delete", name: "Delete products" },
  ],
  register(dependencies) {
    const service = new ProductService(
      new PrismaProductRepository(dependencies.prisma),
      new PrismaProductUnitOfWork(dependencies.prisma),
    );
    return {
      api: service,
      router: createProductRouter(
        dependencies.tokenVerifier,
        dependencies.userRepository,
        service,
      ),
    };
  },
};
```

Agrégalo únicamente a `businessDocTypes` en `src/modules/doc-types/index.ts`. `DocTypeRegistry` se encarga de montarlo bajo `/api/v1`; no es necesario modificar `src/core`, `src/modules/access-management` ni añadir una ruta manual en `src/routes/index.ts`.

Si otro módulo depende de Products, declara `dependencies: ["products"]` y resuelve su contrato público durante el registro:

```ts
register(dependencies, resolve) {
  const products = resolve<ProductApi>("products");
  // Inyectar products en el service del módulo dependiente.
}
```

Importa únicamente `product.api.ts` y sus tipos públicos. No importes controllers, repositories Prisma ni detalles internos de Products. El registro ordena dependencias, rechaza nombres o rutas duplicadas y falla al arrancar ante dependencias ausentes o circulares.

### 12. Probar el módulo

Como mínimo, cubre:

- usuario sin token (`401`), no aprovisionado o inactivo (`403`);
- usuario autenticado sin el permiso requerido (`403 AUTH_FORBIDDEN`);
- UUID, query o body inválido (`400 VALIDATION_ERROR`);
- entidad inexistente (`404`);
- restricción única o conflicto de negocio (`409`);
- caminos exitosos de listar, obtener, crear, actualizar y eliminar;
- reglas del service con un repository falso;
- contrato HTTP con dobles de autenticación, sin depender de Firebase real.

Antes de considerar terminado el módulo, ejecuta:

```bash
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run build
```

### Checklist reutilizable

- [ ] Entidad, relaciones, unicidad y política de borrado definidas.
- [ ] Migración creada, revisada y versionada.
- [ ] Permisos agregados al seed idempotente y asignados a los roles correctos.
- [ ] Modelo, DTO, schemas, contrato e implementación del repository creados.
- [ ] Reglas de negocio y errores implementados en el service.
- [ ] Controller limitado a HTTP y router protegido en el orden correcto.
- [ ] API pública y docType declarados; docType añadido a `businessDocTypes`.
- [ ] Dependencias entre módulos declaradas y resueltas por su API pública.
- [ ] Escrituras y auditoría ejecutadas atómicamente cuando comparten PostgreSQL.
- [ ] Casos positivos, autenticación, permisos, validación, `404` y conflictos probados.
- [ ] Prisma, tipos, pruebas y build verificados.

Para aplicar este patrón en Ventas, Compras, Inventarios o Producción, consulta [Guía para crear un nuevo módulo con docTypes](./new_modulo_guia.md).

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

La v1 proporciona identidad local, RBAC, administración de acceso, auditoría y un registro de docTypes para módulos de negocio. No incluye todavía OpenAPI, multi-tenancy ni aprovisionamiento just-in-time.

## Licencia

ISC.
