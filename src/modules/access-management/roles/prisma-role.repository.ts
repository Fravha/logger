import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { CreateRoleDto, UpdateRoleDto } from "./role.dto.js";
import type { RoleModel } from "./role.model.js";
import type { RoleRepository } from "./role.repository.js";

const roleSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      permission: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly client: PrismaClient) {}

  async findAll(): Promise<RoleModel[]> {
    const roles = await this.client.role.findMany({
      where: { deletedAt: null },
      select: roleSelect,
      orderBy: { name: "asc" },
    });
    return roles.map((role) => this.toDomain(role));
  }

  async findById(id: string): Promise<RoleModel | null> {
    const role = await this.client.role.findFirst({
      where: { id, deletedAt: null },
      select: roleSelect,
    });
    return role ? this.toDomain(role) : null;
  }

  async findByCode(code: string): Promise<RoleModel | null> {
    // Code remains globally unique, including soft-deleted roles.
    const role = await this.client.role.findUnique({ where: { code }, select: roleSelect });
    return role ? this.toDomain(role) : null;
  }

  async create(data: CreateRoleDto): Promise<RoleModel> {
    const role = await this.client.role.create({ data, select: roleSelect });
    return this.toDomain(role);
  }

  async update(id: string, data: UpdateRoleDto): Promise<RoleModel> {
    const role = await this.client.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      select: roleSelect,
    });
    return this.toDomain(role);
  }

  async delete(id: string): Promise<void> {
    await this.client.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countUsers(id: string): Promise<number> {
    return this.client.userRole.count({ where: { roleId: id } });
  }

  async setPermissions(id: string, permissionIds: string[]): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true,
        });
      }
    });
  }

  private toDomain(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{ permission: { id: string; code: string; name: string } }>;
  }): RoleModel {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map(({ permission }) => permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
