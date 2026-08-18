import {
  Prisma,
  type PrismaClient,
  type Product as PrismaProduct,
} from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateProductDto, UpdateProductDto } from "./product.dto.js";
import type { Product } from "./product.model.js";
import type { ProductRepository } from "./product.repository.js";

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly client: Pick<PrismaClient, "product">) {}

  async findAll(): Promise<Product[]> {
    const products = await this.client.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    return products.map((product) => this.toDomain(product));
  }

  async findById(id: string): Promise<Product | null> {
    const product = await this.client.product.findUnique({ where: { id } });
    return product ? this.toDomain(product) : null;
  }

  async findByCode(code: string): Promise<Product | null> {
    const product = await this.client.product.findUnique({ where: { code } });
    return product ? this.toDomain(product) : null;
  }

  async create(data: CreateProductDto): Promise<Product> {
    try {
      const product = await this.client.product.create({
        data: {
          code: data.code,
          name: data.name,
          price: data.price,
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
        },
      });
      return this.toDomain(product);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    try {
      const product = await this.client.product.update({
        where: { id },
        data: {
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
      });
      return this.toDomain(product);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.product.delete({ where: { id } });
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private toDomain(product: PrismaProduct): Product {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError(
          "PRODUCT_CODE_ALREADY_EXISTS",
          "A product with this code already exists",
          409,
        );
      }
      if (error.code === "P2025") {
        throw new AppError("PRODUCT_NOT_FOUND", "Product not found", 404);
      }
    }
    throw error;
  }
}
