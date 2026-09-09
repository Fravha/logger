import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import type { CreatePurchaseDto, UpdatePurchaseDto } from "./purchase.dto.js";
import type { Purchase } from "./purchase.model.js";

export interface PurchaseApi {
  list(): Promise<Purchase[]>;
  getById(id: string): Promise<Purchase>;
  create(data: CreatePurchaseDto, context: AuthenticatedAuditContext): Promise<Purchase>;
  update(id: string, data: UpdatePurchaseDto, context: AuthenticatedAuditContext): Promise<Purchase>;
  delete(id: string, context: AuthenticatedAuditContext): Promise<void>;
}
