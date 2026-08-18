import { Router } from "express";
import { requirePermission } from "../../../core/access-control/authorization.middleware.js";
import type { AuditService } from "../../../core/audit/audit.service.js";
import { authenticate, resolveCurrentUser } from "../../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../../core/auth/auth.types.js";
import type { UserRepository } from "../../../core/users/user.repository.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../../shared/http/validate-request.js";
import { AssignmentController } from "./assignment.controller.js";
import { PrismaAssignmentRepository } from "./prisma-assignment.repository.js";
import {
  assignmentIdParamsSchema,
  replaceRolePermissionsSchema,
  replaceUserRolesSchema,
} from "./assignment.schema.js";
import { AssignmentService } from "./assignment.service.js";

export function createAssignmentRouter(
  client: PrismaClient,
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  auditService: AuditService,
) {
  const controller = new AssignmentController(
    new AssignmentService(new PrismaAssignmentRepository(client), auditService),
  );
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;

  router.put(
    "/users/:id/roles",
    ...auth,
    requirePermission("rbac:manage"),
    validateRequest({ params: assignmentIdParamsSchema, body: replaceUserRolesSchema }),
    controller.replaceUserRoles,
  );

  router.put(
    "/roles/:id/permissions",
    ...auth,
    requirePermission("rbac:manage"),
    validateRequest({ params: assignmentIdParamsSchema, body: replaceRolePermissionsSchema }),
    controller.replaceRolePermissions,
  );

  return router;
}
