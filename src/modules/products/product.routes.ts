import { Router } from "express";

import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import {
  authenticate,
  resolveCurrentUser,
} from "../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { ProductController } from "./product.controller.js";
import {
  createProductSchema,
  productIdParamsSchema,
  updateProductSchema,
} from "./product.schema.js";
import type { ProductService } from "./product.service.js";

export function createProductRouter(
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  productService: ProductService,
) {
  const controller = new ProductController(productService);
  const router = Router();
  const auth = [
    authenticate(tokenVerifier),
    resolveCurrentUser(userRepository),
  ] as const;

  router.get(
    "/",
    ...auth,
    requirePermission("products:read"),
    controller.list,
  );
  router.get(
    "/:id",
    ...auth,
    requirePermission("products:read"),
    validateRequest({ params: productIdParamsSchema }),
    controller.getById,
  );
  router.post(
    "/",
    ...auth,
    requirePermission("products:create"),
    validateRequest({ body: createProductSchema }),
    controller.create,
  );
  router.patch(
    "/:id",
    ...auth,
    requirePermission("products:update"),
    validateRequest({
      params: productIdParamsSchema,
      body: updateProductSchema,
    }),
    controller.update,
  );
  router.delete(
    "/:id",
    ...auth,
    requirePermission("products:delete"),
    validateRequest({ params: productIdParamsSchema }),
    controller.delete,
  );

  return router;
}
