import type { CreatePurchaseDto, UpdatePurchaseDto } from "./purchase.dto.js";
import type { Purchase } from "./purchase.model.js";

export interface PurchaseRepository {
  findAll(): Promise<Purchase[]>;
  findById(id: string): Promise<Purchase | null>;
  findByReference(reference: string): Promise<Purchase | null>;
  create(data: CreatePurchaseDto): Promise<Purchase>;
  update(id: string, data: UpdatePurchaseDto): Promise<Purchase>;
  delete(id: string): Promise<void>;
}
