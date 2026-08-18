import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../../core/access-control/authorization.middleware.js";
import { authenticate, resolveCurrentUser } from "../../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../../core/auth/auth.types.js";
import type { UserRepository } from "../../../core/users/user.repository.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../../shared/http/validate-request.js";
import { PermissionController } from "./permission.controller.js";
import { PermissionService } from "./permission.service.js";
import { PrismaPermissionRepository } from "./prisma-permission.repository.js";

const idParams = z.object({ id: z.string().uuid() });

export function createPermissionRouter(client: PrismaClient, tokenVerifier: TokenVerifier, userRepository: UserRepository) {
  const controller = new PermissionController(new PermissionService(new PrismaPermissionRepository(client)));
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;
  router.get("/", ...auth, requirePermission("rbac:read"), controller.list);
  router.get("/:id", ...auth, requirePermission("rbac:read"), validateRequest({ params: idParams }), controller.getById);
  return router;
}
