import type { AuditService } from "../../core/audit/audit.service.js";
import type { PurchaseRepository } from "./purchase.repository.js";

export interface PurchaseTransaction {
  purchases: PurchaseRepository;
  audit: AuditService;
}

export interface PurchaseUnitOfWork {
  execute<T>(work: (transaction: PurchaseTransaction) => Promise<T>): Promise<T>;
}
