import { Prisma, type PrismaClient, type Purchase as PrismaPurchase } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreatePurchaseDto, UpdatePurchaseDto } from "./purchase.dto.js";
import type { Purchase } from "./purchase.model.js";
import type { PurchaseRepository } from "./purchase.repository.js";

export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly client: Pick<PrismaClient, "purchase">) {}

  async findAll(): Promise<Purchase[]> {
    const purchases = await this.client.purchase.findMany({ orderBy: { purchasedAt: "desc" } });
    return purchases.map((purchase) => this.toDomain(purchase));
  }

  async findById(id: string): Promise<Purchase | null> {
    const purchase = await this.client.purchase.findUnique({ where: { id } });
    return purchase ? this.toDomain(purchase) : null;
  }

  async findByReference(reference: string): Promise<Purchase | null> {
    const purchase = await this.client.purchase.findUnique({ where: { reference } });
    return purchase ? this.toDomain(purchase) : null;
  }

  async create(data: CreatePurchaseDto): Promise<Purchase> {
    try {
      return this.toDomain(await this.client.purchase.create({ data }));
    } catch (error) { this.rethrowWriteError(error); }
  }

  async update(id: string, data: UpdatePurchaseDto): Promise<Purchase> {
    try {
      const purchase = await this.client.purchase.update({
        where: { id },
        data: {
          ...(data.reference !== undefined ? { reference: data.reference } : {}),
          ...(data.supplierName !== undefined ? { supplierName: data.supplierName } : {}),
          ...(data.total !== undefined ? { total: data.total } : {}),
          ...(data.purchasedAt !== undefined ? { purchasedAt: data.purchasedAt } : {}),
        },
      });
      return this.toDomain(purchase);
    } catch (error) { this.rethrowWriteError(error); }
  }

  async delete(id: string): Promise<void> {
    try { await this.client.purchase.delete({ where: { id } }); }
    catch (error) { this.rethrowWriteError(error); }
  }

  private toDomain(purchase: PrismaPurchase): Purchase {
    return { ...purchase, total: purchase.total.toString() };
  }

  private rethrowWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new AppError("PURCHASE_REFERENCE_ALREADY_EXISTS", "A purchase with this reference already exists", 409);
      if (error.code === "P2025") throw new AppError("PURCHASE_NOT_FOUND", "Purchase not found", 404);
    }
    throw error;
  }
}
