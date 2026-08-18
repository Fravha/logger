import { Router } from "express";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import { AuditService } from "../../core/audit/audit.service.js";
import type { PasswordResetSender } from "../../core/auth/password-reset-sender.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { IdentityAdmin } from "./users/identity-admin.js";
import { createAssignmentRouter } from "./assignments/assignment.routes.js";
import { createPermissionRouter } from "./permissions/permission.routes.js";
import { createRoleRouter } from "./roles/role.routes.js";
import { createUserAdminRouter } from "./users/user-admin.routes.js";

export function createAccessManagementRouter(
  client: PrismaClient,
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  identityAdmin: IdentityAdmin,
  passwordResetSender: PasswordResetSender,
) {
  const router = Router();
  const auditService = new AuditService(new PrismaAuditRepository(client));

  router.use(
    "/users",
    createUserAdminRouter(
      client,
      tokenVerifier,
      userRepository,
      identityAdmin,
      passwordResetSender,
      auditService,
    ),
  );

  router.use(
    "/roles",
    createRoleRouter(client, tokenVerifier, userRepository, auditService),
  );

  router.use(
    "/permissions",
    createPermissionRouter(client, tokenVerifier, userRepository),
  );

  router.use(
    createAssignmentRouter(client, tokenVerifier, userRepository, auditService),
  );

  return router;
}
