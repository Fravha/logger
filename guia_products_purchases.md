# Guía de uso: Products y Purchases

Esta guía describe el consumo de los módulos de productos y compras de Logger API v1. La URL base local es `http://localhost:3000` y todas las rutas se montan bajo `/api/v1`.

## Requisitos comunes

Todas las rutas de esta guía requieren un Firebase ID Token válido y un usuario local con estado `ACTIVE`. Incluye los headers:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```

El usuario también necesita el permiso específico de cada operación. Las respuestas exitosas con contenido usan el formato `{ "data": ... }`; `DELETE` responde `204 No Content`, sin cuerpo.

Los importes (`price` y `total`) son strings decimales, nunca números JSON: usa por ejemplo `"100"`, `"100.5"` o `"100.50"`. Se permiten como máximo dos decimales.

## Products

Representa un producto identificable por su `code`. Su forma de respuesta es:

```json
{
  "id": "PRODUCT_UUID",
  "code": "PROD-001",
  "name": "Producto de ejemplo",
  "description": "Descripción opcional",
  "price": "100.50",
  "active": true,
  "createdAt": "2026-09-02T12:00:00.000Z",
  "updatedAt": "2026-09-02T12:00:00.000Z"
}
```

| Método | Endpoint | Permiso |
| --- | --- | --- |
| `GET` | `/api/v1/products` | `products:read` |
| `GET` | `/api/v1/products/:id` | `products:read` |
| `POST` | `/api/v1/products` | `products:create` |
| `PATCH` | `/api/v1/products/:id` | `products:update` |
| `DELETE` | `/api/v1/products/:id` | `products:delete` |

### Listar y consultar

```bash
curl http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/v1/products/PRODUCT_UUID \
  -H "Authorization: Bearer $TOKEN"
```

La lista se ordena por creación descendente y no está paginada. Ambas operaciones devuelven `200`; para la lista, `data` es un array. Un UUID mal formado devuelve `400 VALIDATION_ERROR` y un producto inexistente devuelve `404 PRODUCT_NOT_FOUND`.

### Crear

```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROD-001",
    "name": "Producto de ejemplo",
    "description": "Descripción opcional",
    "price": "100.50"
  }'
```

`code` es obligatorio (1–50 caracteres), `name` es obligatorio (1–150), `description` es opcional (máximo 500) y `price` debe ser un decimal positivo o cero con máximo dos decimales. Devuelve `201`. Un `code` ya existente devuelve `409 PRODUCT_CODE_ALREADY_EXISTS`.

### Actualizar y eliminar

```bash
curl -X PATCH http://localhost:3000/api/v1/products/PRODUCT_UUID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "price": "120.00", "active": false, "description": null }'

curl -X DELETE http://localhost:3000/api/v1/products/PRODUCT_UUID \
  -H "Authorization: Bearer $TOKEN"
```

`PATCH` admite cualquier combinación no vacía de los campos de creación más `active`. Enviar `description: null` elimina la descripción. Actualizar devuelve `200`; eliminar devuelve `204`. Para descontinuar un producto sin perder su historial, usa `PATCH` con `active: false`.

## Purchases

Representa una compra identificable por su `reference`. Su forma de respuesta es:

```json
{
  "id": "PURCHASE_UUID",
  "reference": "COMP-2026-001",
  "supplierName": "Proveedor Ejemplo S.R.L.",
  "total": "1250.00",
  "purchasedAt": "2026-09-02T00:00:00.000Z",
  "createdAt": "2026-09-02T12:00:00.000Z",
  "updatedAt": "2026-09-02T12:00:00.000Z"
}
```

| Método | Endpoint | Permiso |
| --- | --- | --- |
| `GET` | `/api/v1/purchases` | `purchases:read` |
| `GET` | `/api/v1/purchases/:id` | `purchases:read` |
| `POST` | `/api/v1/purchases` | `purchases:create` |
| `PATCH` | `/api/v1/purchases/:id` | `purchases:update` |
| `DELETE` | `/api/v1/purchases/:id` | `purchases:delete` |

### Listar y consultar

```bash
curl http://localhost:3000/api/v1/purchases \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/v1/purchases/PURCHASE_UUID \
  -H "Authorization: Bearer $TOKEN"
```

La lista se ordena por fecha de compra descendente y no está paginada. Las respuestas exitosas son `200`. Un UUID inválido devuelve `400 VALIDATION_ERROR`; una compra no encontrada devuelve `404 PURCHASE_NOT_FOUND`.

### Crear

```bash
curl -X POST http://localhost:3000/api/v1/purchases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "COMP-2026-001",
    "supplierName": "Proveedor Ejemplo S.R.L.",
    "total": "1250.00",
    "purchasedAt": "2026-09-02T00:00:00.000Z"
  }'
```

`reference` es obligatorio (1–50 caracteres), `supplierName` es obligatorio (1–150), `total` es un decimal con máximo dos decimales y `purchasedAt` debe representar una fecha válida. Envía fechas ISO 8601 para un contrato consistente. La creación devuelve `201`. Una referencia repetida devuelve `409 PURCHASE_REFERENCE_ALREADY_EXISTS`.

### Actualizar y eliminar

```bash
curl -X PATCH http://localhost:3000/api/v1/purchases/PURCHASE_UUID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "supplierName": "Nuevo proveedor", "total": "1300.00" }'

curl -X DELETE http://localhost:3000/api/v1/purchases/PURCHASE_UUID \
  -H "Authorization: Bearer $TOKEN"
```

`PATCH` admite una combinación no vacía de `reference`, `supplierName`, `total` y `purchasedAt`. Actualizar devuelve `200`; eliminar devuelve `204`.

## Errores habituales

| HTTP | Código | Significado |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | UUID, fecha, body o decimal inválido. |
| `401` | `AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN` | Falta el Bearer o Firebase rechazó el token. |
| `403` | `AUTH_USER_NOT_REGISTERED`, `AUTH_USER_INACTIVE`, `AUTH_FORBIDDEN` | Falta usuario local activo o permiso. |
| `404` | `PRODUCT_NOT_FOUND`, `PURCHASE_NOT_FOUND` | El recurso no existe. |
| `409` | `PRODUCT_CODE_ALREADY_EXISTS`, `PURCHASE_REFERENCE_ALREADY_EXISTS` | Se intentó repetir un identificador único. |

Los errores siguen el contrato general de Logger:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "requestId": "REQUEST_UUID"
  }
}
```

Conserva `requestId` al reportar un problema. Las operaciones de creación, actualización y eliminación quedan registradas en la auditoría de Logger.
