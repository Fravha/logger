import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import type { TokenVerifier } from "../core/auth/auth.types.js";
import { createAuthRouter } from "../core/auth/auth.routes.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import type { HealthService } from "../modules/health/health.service.js";
import type { UserRepository } from "../core/users/user.repository.js";

interface RouteDependencies {
  config: AppConfig;
  tokenVerifier: TokenVerifier;
  userRepository: UserRepository;
  healthService: HealthService;
}

export function createRoutes(dependencies: RouteDependencies) {
  const router = Router();
  router.use("/health", createHealthRouter(dependencies.config, dependencies.healthService));
  router.use("/api/v1/auth", createAuthRouter(dependencies.tokenVerifier, dependencies.userRepository));
  return router;
}
