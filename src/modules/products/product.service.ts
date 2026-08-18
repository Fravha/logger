import type {
  CreateProductDto,
  UpdateProductDto,
} from "./product.dto.js";

import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";

import type { ProductRepository } from "./product.repository.js";
import type { ProductUnitOfWork } from "./product.unit-of-work.js";
import type { ProductApi } from "./product.api.js";

export class ProductService implements ProductApi {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly unitOfWork: ProductUnitOfWork,
  ) {}

  async list() {
    return this.productRepository.findAll();
  }

  async getById(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new AppError(
        "PRODUCT_NOT_FOUND",
        "Product not found",
        404,
      );
    }

    return product;
  }

  async create(
    data: CreateProductDto,
    context: AuthenticatedAuditContext,
  ) {
    return this.unitOfWork.execute(async ({ products, audit }) => {
      const existingProduct = await products.findByCode(data.code);

      if (existingProduct) {
        throw new AppError(
          "PRODUCT_CODE_ALREADY_EXISTS",
          "A product with this code already exists",
          409,
        );
      }

      const product = await products.create(data);
      await audit.record(context, {
        action: "PRODUCT_CREATED",
        resourceType: "product",
        resourceId: product.id,
        metadata: {
          code: product.code,
          name: product.name,
        },
      });

      return product;
    });
  }

  async update(
    id: string,
    data: UpdateProductDto,
    context: AuthenticatedAuditContext,
  ) {
    return this.unitOfWork.execute(async ({ products, audit }) => {
      const existingProduct = await products.findById(id);

      if (!existingProduct) {
        throw new AppError(
          "PRODUCT_NOT_FOUND",
          "Product not found",
          404,
        );
      }

      if (data.code && data.code !== existingProduct.code) {
        const productWithSameCode = await products.findByCode(data.code);

        if (productWithSameCode) {
          throw new AppError(
            "PRODUCT_CODE_ALREADY_EXISTS",
            "A product with this code already exists",
            409,
          );
        }
      }

      const product = await products.update(id, data);
      await audit.record(context, {
        action: "PRODUCT_UPDATED",
        resourceType: "product",
        resourceId: product.id,
        metadata: {
          code: product.code,
          changedFields: Object.keys(data).sort(),
        },
      });

      return product;
    });
  }

  async delete(id: string, context: AuthenticatedAuditContext) {
    await this.unitOfWork.execute(async ({ products, audit }) => {
      const existingProduct = await products.findById(id);

      if (!existingProduct) {
        throw new AppError(
          "PRODUCT_NOT_FOUND",
          "Product not found",
          404,
        );
      }

      await products.delete(id);
      await audit.record(context, {
        action: "PRODUCT_DELETED",
        resourceType: "product",
        resourceId: existingProduct.id,
        metadata: {
          code: existingProduct.code,
          name: existingProduct.name,
        },
      });
    });
  }
}
