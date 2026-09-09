import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPurchaseRepository } from "./prisma-purchase.repository.js";
import type { PurchaseTransaction, PurchaseUnitOfWork } from "./purchase.unit-of-work.js";

export class PrismaPurchaseUnitOfWork implements PurchaseUnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  execute<T>(work: (transaction: PurchaseTransaction) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (transaction) => work({
      purchases: new PrismaPurchaseRepository(transaction),
      audit: new AuditService(new PrismaAuditRepository(transaction)),
    }));
  }
}
