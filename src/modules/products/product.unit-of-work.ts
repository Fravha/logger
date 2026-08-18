import type { AuditService } from "../../core/audit/audit.service.js";
import type { ProductRepository } from "./product.repository.js";

export interface ProductTransaction {
  products: ProductRepository;
  audit: AuditService;
}

export interface ProductUnitOfWork {
  execute<T>(work: (transaction: ProductTransaction) => Promise<T>): Promise<T>;
}
