import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { PermissionModel } from "./permission.model.js";
import type {
  CreatePermissionInput,
  PermissionRepository,
  UpdatePermissionInput,
} from "./permission.repository.js";

export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly client: PrismaClient) {}

  findAll(): Promise<PermissionModel[]> {
    return this.client.permission.findMany({ orderBy: { code: "asc" } });
  }

  findById(id: string): Promise<PermissionModel | null> {
    return this.client.permission.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<PermissionModel | null> {
    return this.client.permission.findUnique({ where: { code } });
  }

  create(data: CreatePermissionInput): Promise<PermissionModel> {
    return this.client.permission.create({ data });
  }

  update(id: string, data: UpdatePermissionInput): Promise<PermissionModel> {
    return this.client.permission.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.client.permission.delete({ where: { id } });
  }
}
