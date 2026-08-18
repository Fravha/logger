import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AuditRepository } from "../src/core/audit/audit.repository.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import type {
  AuditRecord,
  AuthenticatedAuditContext,
} from "../src/core/audit/audit.types.js";
import type { CreateProductDto, UpdateProductDto } from "../src/modules/products/product.dto.js";
import type { Product } from "../src/modules/products/product.model.js";
import type { ProductRepository } from "../src/modules/products/product.repository.js";
import { ProductService } from "../src/modules/products/product.service.js";
import type { ProductUnitOfWork } from "../src/modules/products/product.unit-of-work.js";

const context: AuthenticatedAuditContext = {
  actorUserId: "actor-id",
  ipAddress: "127.0.0.1",
  requestId: "request-id",
};

class MemoryProductRepository implements ProductRepository {
  private records = new Map<string, Product>();
  private nextId = 1;

  findAll(): Promise<Product[]> {
    return Promise.resolve([...this.records.values()]);
  }

  findById(id: string): Promise<Product | null> {
    return Promise.resolve(this.records.get(id) ?? null);
  }

  findByCode(code: string): Promise<Product | null> {
    return Promise.resolve(
      [...this.records.values()].find((product) => product.code === code) ?? null,
    );
  }

  create(data: CreateProductDto): Promise<Product> {
    const product: Product = {
      id: `product-${this.nextId++}`,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    this.records.set(product.id, product);
    return Promise.resolve(product);
  }

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    const current = await this.findById(id);
    assert.ok(current);
    const updated: Product = {
      ...current,
      ...data,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    this.records.set(id, updated);
    return updated;
  }

  delete(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }

  snapshot(): Map<string, Product> {
    return new Map(this.records);
  }

  restore(snapshot: Map<string, Product>): void {
    this.records = snapshot;
  }
}

class MemoryAuditRepository implements AuditRepository {
  readonly records: AuditRecord[] = [];

  constructor(private readonly failure?: Error) {}

  create(record: AuditRecord): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    this.records.push(record);
    return Promise.resolve();
  }
}

class MemoryProductUnitOfWork implements ProductUnitOfWork {
  constructor(
    private readonly products: MemoryProductRepository,
    private readonly auditRepository: MemoryAuditRepository,
  ) {}

  async execute<T>(
    work: Parameters<ProductUnitOfWork["execute"]>[0],
  ): Promise<T> {
    const snapshot = this.products.snapshot();
    try {
      return await work({
        products: this.products,
        audit: new AuditService(this.auditRepository),
      }) as T;
    } catch (error) {
      this.products.restore(snapshot);
      throw error;
    }
  }
}

function createSubject(auditFailure?: Error) {
  const products = new MemoryProductRepository();
  const audit = new MemoryAuditRepository(auditFailure);
  const service = new ProductService(
    products,
    new MemoryProductUnitOfWork(products, audit),
  );
  return { products, audit, service };
}

describe("ProductService auditing", () => {
  it("records create, update and delete with safe metadata", async () => {
    const { audit, service } = createSubject();
    const created = await service.create({
      code: "PROD-001",
      name: "Product one",
      price: "10.00",
    }, context);

    await service.update(created.id, { active: false, name: "Updated" }, context);
    await service.delete(created.id, context);

    assert.deepEqual(audit.records, [
      {
        action: "PRODUCT_CREATED",
        resourceType: "product",
        actorUserId: "actor-id",
        resourceId: created.id,
        metadata: { code: "PROD-001", name: "Product one" },
        ipAddress: "127.0.0.1",
        requestId: "request-id",
      },
      {
        action: "PRODUCT_UPDATED",
        resourceType: "product",
        actorUserId: "actor-id",
        resourceId: created.id,
        metadata: { code: "PROD-001", changedFields: ["active", "name"] },
        ipAddress: "127.0.0.1",
        requestId: "request-id",
      },
      {
        action: "PRODUCT_DELETED",
        resourceType: "product",
        actorUserId: "actor-id",
        resourceId: created.id,
        metadata: { code: "PROD-001", name: "Updated" },
        ipAddress: "127.0.0.1",
        requestId: "request-id",
      },
    ]);
  });

  it("rolls back the product mutation when auditing fails", async () => {
    const { products, service } = createSubject(new Error("audit unavailable"));

    await assert.rejects(
      service.create({ code: "PROD-002", name: "Product two", price: "20.00" }, context),
      /audit unavailable/,
    );
    assert.equal(await products.findByCode("PROD-002"), null);
  });
});
