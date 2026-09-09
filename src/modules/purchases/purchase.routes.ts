import { Router } from "express";
import { requirePermission } from "../../core/access-control/authorization.middleware.js";
import { authenticate, resolveCurrentUser } from "../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { PurchaseController } from "./purchase.controller.js";
import { createPurchaseSchema, purchaseIdParamsSchema, updatePurchaseSchema } from "./purchase.schema.js";
import type { PurchaseService } from "./purchase.service.js";

export function createPurchaseRouter(tokenVerifier: TokenVerifier, userRepository: UserRepository, purchaseService: PurchaseService) {
  const controller = new PurchaseController(purchaseService);
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;
  router.get("/", ...auth, requirePermission("purchases:read"), controller.list);
  router.get("/:id", ...auth, requirePermission("purchases:read"), validateRequest({ params: purchaseIdParamsSchema }), controller.getById);
  router.post("/", ...auth, requirePermission("purchases:create"), validateRequest({ body: createPurchaseSchema }), controller.create);
  router.patch("/:id", ...auth, requirePermission("purchases:update"), validateRequest({ params: purchaseIdParamsSchema, body: updatePurchaseSchema }), controller.update);
  router.delete("/:id", ...auth, requirePermission("purchases:delete"), validateRequest({ params: purchaseIdParamsSchema }), controller.delete);
  return router;
}
