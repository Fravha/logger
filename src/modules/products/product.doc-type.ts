import type { DocType } from "../doc-types/doc-type.js";
import type { ProductApi } from "./product.api.js";
import { PrismaProductRepository } from "./prisma-product.repository.js";
import { PrismaProductUnitOfWork } from "./prisma-product.unit-of-work.js";
import { createProductRouter } from "./product.routes.js";
import { ProductService } from "./product.service.js";

export const productDocType: DocType<ProductApi> = {
  name: "products",
  route: "/products",
  permissions: [
    { code: "products:read", name: "Read products" },
    { code: "products:create", name: "Create products" },
    { code: "products:update", name: "Update products" },
    { code: "products:delete", name: "Delete products" },
  ],
  register(dependencies) {
    const service = new ProductService(
      new PrismaProductRepository(dependencies.prisma),
      new PrismaProductUnitOfWork(dependencies.prisma),
    );

    return {
      api: service,
      router: createProductRouter(
        dependencies.tokenVerifier,
        dependencies.userRepository,
        service,
      ),
    };
  },
};
