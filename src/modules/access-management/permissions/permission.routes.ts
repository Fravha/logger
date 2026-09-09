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

const permissionCode = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9:_-]+$/, "Invalid permission code format");

const createPermissionBody = z.object({
  code: permissionCode,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
});

const updatePermissionBody = z
  .object({
    code: permissionCode.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export function createPermissionRouter(
  client: PrismaClient,
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
) {
  const controller = new PermissionController(
    new PermissionService(new PrismaPermissionRepository(client)),
  );
  const router = Router();
  const auth = [authenticate(tokenVerifier), resolveCurrentUser(userRepository)] as const;

  router.get(
    "/",
    ...auth,
    requirePermission("rbac:read"),
    controller.list
  );
  
  router.get(
    "/:id",
    ...auth,
    requirePermission("rbac:read"),
    validateRequest({ params: idParams }),
    controller.getById,
  );

  router.post(
    "/",
    ...auth,
    requirePermission("rbac:manage"),
    validateRequest({ body: createPermissionBody }),
    controller.create,
  );

  router.patch(
    "/:id",
    ...auth,
    requirePermission("rbac:manage"),
    validateRequest({ params: idParams, body: updatePermissionBody }),
    controller.update,
  );

  router.delete(
    "/:id",
    ...auth,
    requirePermission("rbac:manage"),
    validateRequest({ params: idParams }),
    controller.delete,
  );

  return router;
}