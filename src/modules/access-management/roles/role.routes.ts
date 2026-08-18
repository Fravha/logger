import { Router } from "express";
import { requirePermission } from "../../../core/access-control/authorization.middleware.js";
import type { AuditService } from "../../../core/audit/audit.service.js";
import { authenticate, resolveCurrentUser } from "../../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../../core/auth/auth.types.js";
import type { UserRepository } from "../../../core/users/user.repository.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../../shared/http/validate-request.js";
import { PrismaRoleRepository } from "./prisma-role.repository.js";
import { RoleController } from "./role.controller.js";
import { createRoleSchema, roleIdParamsSchema, updateRoleSchema } from "./role.schema.js";
import { RoleService } from "./role.service.js";

export function createRoleRouter(
  client: PrismaClient,
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  auditService: AuditService,
) {
  const controller = new RoleController(new RoleService(new PrismaRoleRepository(client), auditService));
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;

  router.get("/", ...auth, requirePermission("rbac:read"), controller.list);
  router.get("/:id", ...auth, requirePermission("rbac:read"), validateRequest({ params: roleIdParamsSchema }), controller.getById);
  router.post("/", ...auth, requirePermission("rbac:manage"), validateRequest({ body: createRoleSchema }), controller.create);
  router.patch("/:id", ...auth, requirePermission("rbac:manage"), validateRequest({ params: roleIdParamsSchema, body: updateRoleSchema }), controller.update);
  router.delete("/:id", ...auth, requirePermission("rbac:manage"), validateRequest({ params: roleIdParamsSchema }), controller.delete);

  return router;
}
