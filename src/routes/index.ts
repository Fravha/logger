import { Router } from "express";

import type { AppConfig } from "../config/env.js";
import { PrismaAuditRepository } from "../core/audit/prisma-audit.repository.js";
import { AuditService } from "../core/audit/audit.service.js";
import type { PasswordResetSender } from "../core/auth/password-reset-sender.js";
import type { TokenVerifier } from "../core/auth/auth.types.js";
import { createAuthRouter } from "../core/auth/auth.routes.js";
import type { UserRepository } from "../core/users/user.repository.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { IdentityAdmin } from "../modules/access-management/users/identity-admin.js";
import { createAccessManagementRouter } from "../modules/access-management/access-management.routes.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import type { HealthService } from "../modules/health/health.service.js";
import { businessDocTypes } from "../modules/doc-types/index.js";
import { DocTypeRegistry } from "../modules/doc-types/doc-type.registry.js";

const API = "/api/v1";

interface RouteDependencies {
  config: AppConfig;
  prisma: PrismaClient;
  tokenVerifier: TokenVerifier;
  userRepository: UserRepository;
  identityAdmin: IdentityAdmin;
  passwordResetSender: PasswordResetSender;
  healthService: HealthService;
}

export function createRoutes(dependencies: RouteDependencies) {
  const router = Router();
  const auditService = new AuditService(
    new PrismaAuditRepository(dependencies.prisma),
  );

  router.use(
    "/health",
    createHealthRouter(
      dependencies.config,
      dependencies.healthService,
    ),
  );

  router.use(
    `${API}/auth`,
    createAuthRouter(
      dependencies.tokenVerifier,
      dependencies.userRepository,
      dependencies.passwordResetSender,
    ),
  );

  router.use(
    API,
    createAccessManagementRouter(
      dependencies.prisma,
      dependencies.tokenVerifier,
      dependencies.userRepository,
      dependencies.identityAdmin,
      dependencies.passwordResetSender,
    ),
  );

  const docTypes = new DocTypeRegistry({
    prisma: dependencies.prisma,
    tokenVerifier: dependencies.tokenVerifier,
    userRepository: dependencies.userRepository,
    auditService,
  });
  docTypes.registerAll(businessDocTypes);
  docTypes.mount(router, API);

  return router;
}
