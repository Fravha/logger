import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import type { CreateProductDto, UpdateProductDto } from "./product.dto.js";
import type { Product } from "./product.model.js";

export interface ProductApi {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product>;
  create(
    data: CreateProductDto,
    context: AuthenticatedAuditContext,
  ): Promise<Product>;
  update(
    id: string,
    data: UpdateProductDto,
    context: AuthenticatedAuditContext,
  ): Promise<Product>;
  delete(id: string, context: AuthenticatedAuditContext): Promise<void>;
}
