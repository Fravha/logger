import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { PermissionModel } from "./permission.model.js";
import type { PermissionRepository } from "./permission.repository.js";

export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly client: PrismaClient) {}
  findAll(): Promise<PermissionModel[]> {
    return this.client.permission.findMany({ orderBy: { code: "asc" } });
  }
  findById(id: string): Promise<PermissionModel | null> {
    return this.client.permission.findUnique({ where: { id } });
  }
}
