import type { CreateProductDto, UpdateProductDto } from "./product.dto.js";
import type { Product } from "./product.model.js";

export interface ProductRepository {
  findAll(): Promise<Product[]>;

  findById(id: string): Promise<Product | null>;

  findByCode(code: string): Promise<Product | null>;

  create(data: CreateProductDto): Promise<Product>;

  update(id: string, data: UpdateProductDto): Promise<Product>;

  delete(id: string): Promise<void>;
}