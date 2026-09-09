import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { PurchaseApi } from "./purchase.api.js";
import type { CreatePurchaseDto, UpdatePurchaseDto } from "./purchase.dto.js";
import type { PurchaseRepository } from "./purchase.repository.js";
import type { PurchaseUnitOfWork } from "./purchase.unit-of-work.js";

export class PurchaseService implements PurchaseApi {
  constructor(private readonly purchaseRepository: PurchaseRepository, private readonly unitOfWork: PurchaseUnitOfWork) {}

  async list() { return this.purchaseRepository.findAll(); }

  async getById(id: string) {
    const purchase = await this.purchaseRepository.findById(id);
    if (!purchase) throw new AppError("PURCHASE_NOT_FOUND", "Purchase not found", 404);
    return purchase;
  }

  async create(data: CreatePurchaseDto, context: AuthenticatedAuditContext) {
    return this.unitOfWork.execute(async ({ purchases, audit }) => {
      if (await purchases.findByReference(data.reference)) {
        throw new AppError("PURCHASE_REFERENCE_ALREADY_EXISTS", "A purchase with this reference already exists", 409);
      }
      const purchase = await purchases.create(data);
      await audit.record(context, { action: "PURCHASE_CREATED", resourceType: "purchase", resourceId: purchase.id, metadata: { reference: purchase.reference, supplierName: purchase.supplierName } });
      return purchase;
    });
  }

  async update(id: string, data: UpdatePurchaseDto, context: AuthenticatedAuditContext) {
    return this.unitOfWork.execute(async ({ purchases, audit }) => {
      const existingPurchase = await purchases.findById(id);
      if (!existingPurchase) throw new AppError("PURCHASE_NOT_FOUND", "Purchase not found", 404);
      if (data.reference !== undefined && data.reference !== existingPurchase.reference) {
        if (await purchases.findByReference(data.reference)) {
          throw new AppError("PURCHASE_REFERENCE_ALREADY_EXISTS", "A purchase with this reference already exists", 409);
        }
      }
      const purchase = await purchases.update(id, data);
      await audit.record(context, { action: "PURCHASE_UPDATED", resourceType: "purchase", resourceId: purchase.id, metadata: { reference: purchase.reference, changedFields: Object.keys(data).sort() } });
      return purchase;
    });
  }

  async delete(id: string, context: AuthenticatedAuditContext): Promise<void> {
    await this.unitOfWork.execute(async ({ purchases, audit }) => {
      const purchase = await purchases.findById(id);
      if (!purchase) throw new AppError("PURCHASE_NOT_FOUND", "Purchase not found", 404);
      await purchases.delete(id);
      await audit.record(context, { action: "PURCHASE_DELETED", resourceType: "purchase", resourceId: purchase.id, metadata: { reference: purchase.reference, supplierName: purchase.supplierName } });
    });
  }
}
