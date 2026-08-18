import type { Router } from "express";

import type { AuditService } from "../../core/audit/audit.service.js";
import type { TokenVerifier } from "../../core/auth/auth.types.js";
import type { UserRepository } from "../../core/users/user.repository.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export interface DocTypeDependencies {
  prisma: PrismaClient;
  tokenVerifier: TokenVerifier;
  userRepository: UserRepository;
  auditService: AuditService;
}

export interface RegisteredDocType<TApi = unknown> {
  router: Router;
  api: TApi;
}

export type ResolveDocType = <TApi>(name: string) => TApi;

export interface DocTypePermission {
  code: string;
  name: string;
}

export interface DocType<TApi = unknown> {
  name: string;
  route: `/${string}`;
  permissions: readonly DocTypePermission[];
  dependencies?: readonly string[];
  register(
    dependencies: DocTypeDependencies,
    resolve: ResolveDocType,
  ): RegisteredDocType<TApi>;
}

export interface DocTypeDescriptor {
  name: string;
  route: string;
  permissions: readonly DocTypePermission[];
  dependencies: readonly string[];
}
