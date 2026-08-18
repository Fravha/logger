import { Router } from "express";
import { requirePermission } from "../../../core/access-control/authorization.middleware.js";
import type { AuditService } from "../../../core/audit/audit.service.js";
import { authenticate, resolveCurrentUser } from "../../../core/auth/auth.middleware.js";
import type { TokenVerifier } from "../../../core/auth/auth.types.js";
import type { PasswordResetSender } from "../../../core/auth/password-reset-sender.js";
import type { UserRepository } from "../../../core/users/user.repository.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../../shared/http/validate-request.js";
import type { IdentityAdmin } from "./identity-admin.js";
import { PrismaUserAdminRepository } from "./prisma-user-admin.repository.js";
import { UserAdminController } from "./user-admin.controller.js";
import { createUserAdminSchema, updateUserAdminSchema, userAdminIdParamsSchema } from "./user-admin.schema.js";
import { UserAdminService } from "./user-admin.service.js";

export function createUserAdminRouter(
  client: PrismaClient,
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  identityAdmin: IdentityAdmin,
  passwordResetSender: PasswordResetSender,
  auditService: AuditService,
) {
  const repository = new PrismaUserAdminRepository(client);
  const service = new UserAdminService(repository, identityAdmin, passwordResetSender, auditService);
  const controller = new UserAdminController(service);
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;

  router.get("/", ...auth, requirePermission("users:read"), controller.list);
  router.get("/:id", ...auth, requirePermission("users:read"), validateRequest({ params: userAdminIdParamsSchema }), controller.getById);
  router.post("/", ...auth, requirePermission("users:manage"), validateRequest({ body: createUserAdminSchema }), controller.create);
  router.patch("/:id", ...auth, requirePermission("users:manage"), validateRequest({ params: userAdminIdParamsSchema, body: updateUserAdminSchema }), controller.update);
  router.post("/:id/activate", ...auth, requirePermission("users:manage"), validateRequest({ params: userAdminIdParamsSchema }), controller.activate);
  router.post("/:id/suspend", ...auth, requirePermission("users:manage"), validateRequest({ params: userAdminIdParamsSchema }), controller.suspend);
  router.post("/:id/send-password-setup", ...auth, requirePermission("users:manage"), validateRequest({ params: userAdminIdParamsSchema }), controller.resendPasswordSetup);

  return router;
}
