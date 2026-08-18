import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AssignmentRepository } from "./assignment.repository.js";

export class PrismaAssignmentRepository implements AssignmentRepository {
  constructor(private readonly client: PrismaClient) {}

  async userExists(userId: string) {
    return (await this.client.user.count({ where: { id: userId } })) > 0;
  }

  async roleExists(roleId: string) {
    return (await this.client.role.count({ where: { id: roleId } })) > 0;
  }

  countRoles(roleIds: string[]) {
    return this.client.role.count({ where: { id: { in: [...new Set(roleIds)] } } });
  }

  countPermissions(permissionIds: string[]) {
    return this.client.permission.count({ where: { id: { in: [...new Set(permissionIds)] } } });
  }

  async replaceUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      const unique = [...new Set(roleIds)];
      if (unique.length) {
        await tx.userRole.createMany({
          data: unique.map((roleId) => ({ userId, roleId })),
        });
      }
    });
  }

  async replaceRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      const unique = [...new Set(permissionIds)];
      if (unique.length) {
        await tx.rolePermission.createMany({
          data: unique.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    });
  }

  async userHasRole(userId: string, roleCode: string): Promise<boolean> {
    return (await this.client.userRole.count({ where: { userId, role: { code: roleCode } } })) > 0;
  }

  countActiveUsersWithRole(roleCode: string): Promise<number> {
    return this.client.userRole.count({ where: { role: { code: roleCode }, user: { status: "ACTIVE" } } });
  }

  async roleCode(roleId: string): Promise<string | null> {
    return (await this.client.role.findUnique({
      where: { id: roleId },
      select: { code: true },
    }))?.code ?? null;
  }

  async roleCodes(roleIds: string[]): Promise<string[]> {
    const roles = await this.client.role.findMany({
      where: { id: { in: [...new Set(roleIds)] } },
      select: { code: true },
    });
    return roles.map(({ code }) => code);
  }

  async userRoleCodes(userId: string): Promise<string[]> {
    const assignments = await this.client.userRole.findMany({
      where: { userId },
      select: { role: { select: { code: true } } },
    });
    return assignments.map(({ role }) => role.code);
  }

  async permissionCodes(permissionIds: string[]): Promise<string[]> {
    return (await this.client.permission.findMany({
      where: { id: { in: [...new Set(permissionIds)] } },
      select: { code: true },
    })).map(({ code }) => code);
  }

  async rolePermissionCodes(roleId: string): Promise<string[]> {
    const assignments = await this.client.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    });
    return assignments.map(({ permission }) => permission.code);
  }
}
