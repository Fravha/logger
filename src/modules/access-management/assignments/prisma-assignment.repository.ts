import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AssignmentRepository } from "./assignment.repository.js";

export class PrismaAssignmentRepository implements AssignmentRepository {
  constructor(private readonly client: PrismaClient) {}

  async userExists(userId: string) {
    return (await this.client.user.count({ where: { id: userId } })) > 0;
  }

  async roleExists(roleId: string) {
    return (await this.client.role.count({ where: { id: roleId, deletedAt: null } })) > 0;
  }

  async replaceUserRole(userId: string, roleId: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId } });
    });
  }

  async userHasRole(userId: string, roleCode: string): Promise<boolean> {
    return (await this.client.userRole.count({
      where: { userId, role: { code: roleCode, deletedAt: null } },
    })) > 0;
  }

  countActiveUsersWithRole(roleCode: string): Promise<number> {
    return this.client.userRole.count({
      where: { role: { code: roleCode, deletedAt: null }, user: { status: "ACTIVE" } },
    });
  }

  async roleCode(roleId: string): Promise<string | null> {
    return (await this.client.role.findFirst({
      where: { id: roleId, deletedAt: null },
      select: { code: true },
    }))?.code ?? null;
  }

  async userRoleCode(userId: string): Promise<string | null> {
    return (await this.client.userRole.findUnique({
      where: { userId },
      select: { role: { select: { code: true } } },
    }))?.role.code ?? null;
  }
}
