import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import { AuditService } from "../../core/audit/audit.service.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaProductRepository } from "./prisma-product.repository.js";
import type {
  ProductTransaction,
  ProductUnitOfWork,
} from "./product.unit-of-work.js";

export class PrismaProductUnitOfWork implements ProductUnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  execute<T>(
    work: (transaction: ProductTransaction) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transaction) => work({
      products: new PrismaProductRepository(transaction),
      audit: new AuditService(new PrismaAuditRepository(transaction)),
    }));
  }
}
