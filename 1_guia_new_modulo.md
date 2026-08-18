# Guía para crear un nuevo módulo con docTypes

Esta guía explica cómo integrar módulos de negocio —ventas, compras, inventarios, producción u otros— sin modificar ni acoplarse a los pilares de Logger:

- `src/core`: autenticación, usuario local, autorización RBAC y auditoría.
- `src/modules/access-management`: administración de usuarios, roles, permisos y asignaciones.

`src/modules/products` es la implementación de referencia.

## Qué es un docType en Logger

Un docType es el descriptor de integración de un módulo. No sustituye al modelo Prisma ni contiene reglas de negocio. Declara:

- un nombre único;
- la ruta base del módulo;
- los permisos que aporta;
- sus dependencias con otros docTypes;
- cómo construir su router y API pública.

`DocTypeRegistry` valida las declaraciones, ordena las dependencias, monta las rutas bajo `/api/v1` y permite que un módulo consuma la API pública de otro.

```text
businessDocTypes
       ↓
DocTypeRegistry
       ├── registra permisos
       ├── resuelve dependencias
       ├── expone APIs públicas
       └── monta routers en /api/v1
```

## Reglas que debe respetar un módulo

1. No modificar `src/core` para agregar reglas propias del dominio.
2. No modificar `src/modules/access-management` para registrar entidades de negocio.
3. No crear otra instancia de Firebase, Prisma o PostgreSQL.
4. No importar repositories, services o controllers internos de otro módulo.
5. Consumir otros módulos exclusivamente mediante su archivo `<module>.api.ts`.
6. Proteger cada endpoint con autenticación, usuario local y permisos RBAC.
7. Guardar las escrituras relevantes y su auditoría en una misma transacción.
8. Registrar el módulo únicamente en `businessDocTypes`.

## 1. Diseñar el módulo

Antes de crear archivos, define:

- nombre singular y plural, por ejemplo `sale` y `sales`;
- entidad, campos, relaciones, restricciones únicas y política de borrado;
- endpoints y respuestas HTTP;
- permisos necesarios;
- eventos que deben auditarse;
- APIs de otros módulos que necesita consumir;
- operaciones que otros módulos podrán consumir de él.

Convención recomendada de permisos:

```text
sales:read
sales:create
sales:update
sales:delete
```

Los códigos son contratos estables. Cambiar un código existente requiere actualizar roles, clientes y pruebas.

## 2. Crear el modelo Prisma

Agrega la entidad en `prisma/schema.prisma`. Ejemplo mínimo:

```prisma
model Sale {
  id        String   @id @default(uuid())
  number    String   @unique
  status    String
  total     Decimal  @db.Decimal(12, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("sales")
}
```

Después crea y revisa la migración:

```bash
npm run db:validate
npm run db:migrate -- --name add_sales
npm run db:generate
```

Versiona `schema.prisma` y la migración. En producción utiliza `npm run db:migrate:deploy`.

## 3. Crear la estructura del módulo

```text
src/modules/sales/
├── sale.model.ts
├── sale.dto.ts
├── sale.schema.ts
├── sale.repository.ts
├── prisma-sale.repository.ts
├── sale.unit-of-work.ts
├── prisma-sale.unit-of-work.ts
├── sale.api.ts
├── sale.service.ts
├── sale.controller.ts
├── sale.routes.ts
└── sale.doc-type.ts
```

Responsabilidades:

| Archivo | Responsabilidad |
| --- | --- |
| `model` | Representación del dominio devuelta por el módulo |
| `dto` | Datos aceptados por creación y actualización |
| `schema` | Validación HTTP con Zod |
| `repository` | Contrato de persistencia |
| `prisma-*.repository` | Consultas Prisma y mapeo al dominio |
| `unit-of-work` | Contrato para escrituras atómicas |
| `prisma-*.unit-of-work` | Transacción Prisma de negocio y auditoría |
| `api` | Contrato público consumible por otros módulos |
| `service` | Reglas y casos de uso |
| `controller` | Adaptación entre HTTP y el service |
| `routes` | Seguridad, permisos, validación y handlers |
| `doc-type` | Registro e integración del módulo |

## 4. Definir dominio, DTO y validaciones

Evita exponer tipos generados por Prisma fuera del repository:

```ts
// sale.model.ts
export interface Sale {
  id: string;
  number: string;
  status: string;
  total: string;
  createdAt: Date;
  updatedAt: Date;
}
```

```ts
// sale.dto.ts
export interface CreateSaleDto {
  number: string;
  total: string;
}

export interface UpdateSaleDto {
  status?: string;
  total?: string;
}
```

Los schemas Zod deben validar `params`, `query` y `body` antes del controller. Para `PATCH`, rechaza un body vacío y distingue una propiedad ausente de un valor `null`.

## 5. Implementar el repository mediante inyección

El contrato no conoce Prisma:

```ts
export interface SaleRepository {
  findAll(): Promise<Sale[]>;
  findById(id: string): Promise<Sale | null>;
  findByNumber(number: string): Promise<Sale | null>;
  create(data: CreateSaleDto): Promise<Sale>;
  update(id: string, data: UpdateSaleDto): Promise<Sale>;
  delete(id: string): Promise<void>;
}
```

La implementación recibe el cliente, en lugar de importar la instancia global:

```ts
export class PrismaSaleRepository implements SaleRepository {
  constructor(private readonly client: Pick<PrismaClient, "sale">) {}

  // Implementación de find/create/update/delete y mapper.
}
```

Esto permite utilizar tanto `PrismaClient` como el cliente de una transacción. Traduce errores conocidos como restricciones únicas (`P2002`) o registros desaparecidos (`P2025`) a `AppError`; no envíes detalles internos de Prisma al cliente.

Con `exactOptionalPropertyTypes`, agrega campos opcionales condicionalmente:

```ts
data: {
  ...(input.status !== undefined ? { status: input.status } : {}),
}
```

## 6. Hacer atómicas las escrituras y la auditoría

Define una unidad de trabajo para el módulo:

```ts
export interface SaleTransaction {
  sales: SaleRepository;
  audit: AuditService;
}

export interface SaleUnitOfWork {
  execute<T>(
    work: (transaction: SaleTransaction) => Promise<T>,
  ): Promise<T>;
}
```

La implementación Prisma construye ambos repositories con el mismo cliente transaccional:

```ts
export class PrismaSaleUnitOfWork implements SaleUnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  execute<T>(work: (transaction: SaleTransaction) => Promise<T>) {
    return this.client.$transaction(async (tx) => work({
      sales: new PrismaSaleRepository(tx),
      audit: new AuditService(new PrismaAuditRepository(tx)),
    }));
  }
}
```

Si `AuditLog` falla, Prisma revierte la escritura del negocio. Evita responder `500` después de haber confirmado parcialmente la operación.

## 7. Implementar el service y los eventos

El service recibe el repository de lectura y la unidad de trabajo. Las escrituras requieren `AuthenticatedAuditContext`:

```ts
async create(
  data: CreateSaleDto,
  context: AuthenticatedAuditContext,
) {
  return this.unitOfWork.execute(async ({ sales, audit }) => {
    if (await sales.findByNumber(data.number)) {
      throw new AppError(
        "SALE_NUMBER_ALREADY_EXISTS",
        "A sale with this number already exists",
        409,
      );
    }

    const sale = await sales.create(data);
    await audit.record(context, {
      action: "SALE_CREATED",
      resourceType: "sale",
      resourceId: sale.id,
      metadata: { number: sale.number },
    });
    return sale;
  });
}
```

Usa eventos consistentes:

```text
SALE_CREATED
SALE_UPDATED
SALE_DELETED
```

Incluye metadata mínima, por ejemplo identificadores de negocio y `changedFields`. Nunca almacenes tokens, secretos ni el body completo.

## 8. Crear la API pública

`sale.api.ts` define lo único que otros módulos pueden consumir:

```ts
export interface SaleApi {
  list(): Promise<Sale[]>;
  getById(id: string): Promise<Sale>;
  create(
    data: CreateSaleDto,
    context: AuthenticatedAuditContext,
  ): Promise<Sale>;
}
```

`SaleService` implementa esta interfaz. No expongas Prisma, Express, controllers ni repositories concretos en ella.

## 9. Crear controller y rutas protegidas

En operaciones auditadas, el controller construye el contexto después de que la autenticación haya resuelto al usuario:

```ts
const context = buildAuthenticatedAuditContext(req, res);
const sale = await this.saleService.create(req.body, context);
res.status(201).json({ data: sale });
```

El orden de middlewares es obligatorio:

```ts
router.post(
  "/",
  authenticate(tokenVerifier),
  resolveCurrentUser(userRepository),
  requirePermission("sales:create"),
  validateRequest({ body: createSaleSchema }),
  controller.create,
);
```

Una identidad válida de Firebase no concede acceso por sí sola: el usuario debe existir localmente, estar `ACTIVE` y tener el permiso requerido.

## 10. Declarar el docType

```ts
export const saleDocType: DocType<SaleApi> = {
  name: "sales",
  route: "/sales",
  permissions: [
    { code: "sales:read", name: "Read sales" },
    { code: "sales:create", name: "Create sales" },
    { code: "sales:update", name: "Update sales" },
    { code: "sales:delete", name: "Delete sales" },
  ],
  register(dependencies) {
    const service = new SaleService(
      new PrismaSaleRepository(dependencies.prisma),
      new PrismaSaleUnitOfWork(dependencies.prisma),
    );

    return {
      api: service,
      router: createSaleRouter(
        dependencies.tokenVerifier,
        dependencies.userRepository,
        service,
      ),
    };
  },
};
```

Finalmente agrégalo al catálogo:

```ts
// src/modules/doc-types/index.ts
export const businessDocTypes: readonly DocType[] = [
  productDocType,
  saleDocType,
];
```

No modifiques `src/routes/index.ts`. El registro monta automáticamente el endpoint en `/api/v1/sales`. `prisma/seed.ts` también incorpora los permisos publicados por los docTypes; ejecuta:

```bash
npm run db:seed
```

## 11. Consumir otro módulo

Si Ventas necesita consultar Products, declara la dependencia:

```ts
export const saleDocType: DocType<SaleApi> = {
  name: "sales",
  route: "/sales",
  dependencies: ["products"],
  permissions: [/* ... */],
  register(dependencies, resolve) {
    const products = resolve<ProductApi>("products");
    const service = new SaleService(/* repositories */, products);
    return { api: service, router: createSaleRouter(/* ... */, service) };
  },
};
```

El módulo dependiente importa solamente `ProductApi` y los tipos públicos necesarios. `DocTypeRegistry` registra primero Products aunque el orden del catálogo sea diferente. El arranque falla de forma explícita si encuentra:

- un nombre o ruta duplicados;
- permisos duplicados entre docTypes;
- una dependencia ausente;
- una dependencia circular.

No utilices `resolve()` fuera de la composición del docType ni como service locator dentro de controllers.

## 12. Pruebas mínimas

Cada módulo debe cubrir:

- reglas del service mediante repositories falsos;
- eventos y metadata de auditoría;
- rollback cuando falla `AuditLog`;
- autenticación ausente o inválida (`401`);
- usuario local inexistente o inactivo (`403`);
- permiso faltante (`403 AUTH_FORBIDDEN`);
- params y body inválidos (`400 VALIDATION_ERROR`);
- entidad inexistente (`404`);
- restricciones únicas (`409`);
- caminos exitosos del CRUD;
- dependencias públicas con otros módulos.

Ejecuta antes de terminar:

```bash
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run build
```

## Checklist final

- [ ] Modelo Prisma y migración revisados.
- [ ] Modelo de dominio, DTO y schemas creados.
- [ ] Repository inyectable y errores Prisma traducidos.
- [ ] API pública mínima definida.
- [ ] Escrituras importantes auditadas atómicamente.
- [ ] Rutas protegidas con autenticación, usuario local, permiso y validación.
- [ ] docType con nombre, ruta, permisos y dependencias únicas.
- [ ] docType agregado a `businessDocTypes`.
- [ ] Permisos aplicados mediante `npm run db:seed`.
- [ ] Pruebas, tipos, esquema y build aprobados.

## Archivos de referencia

- `src/modules/products/`: módulo completo de ejemplo.
- `src/modules/doc-types/doc-type.ts`: contrato del descriptor.
- `src/modules/doc-types/doc-type.registry.ts`: registro y resolución.
- `src/modules/doc-types/index.ts`: catálogo de módulos activos.
- `src/core/audit/`: contratos de auditoría reutilizables.
- `src/shared/http/audit-context.ts`: contexto del actor HTTP.
