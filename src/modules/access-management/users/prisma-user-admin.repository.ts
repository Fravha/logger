import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { UserStatus } from "../../../core/users/user.types.js";
import type { CreateLocalUserInput, UserAdminRepository } from "./user-admin.repository.js";
import type { UpdateUserAdminDto } from "./user-admin.dto.js";
import type { UserAdmin } from "./user-admin.model.js";

const userSelect = {
  id: true,
  firebaseUid: true,
  email: true,
  displayName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: {
        select: { id: true, code: true, name: true },
      },
    },
  },
} as const;

export class PrismaUserAdminRepository implements UserAdminRepository {
  constructor(private readonly client: PrismaClient) {}

  async findAll(): Promise<UserAdmin[]> {
    const users = await this.client.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
    return users.map((user) => this.toDomain(user));
  }

  async findById(id: string): Promise<UserAdmin | null> {
    const user = await this.client.user.findUnique({ where: { id }, select: userSelect });
    return user ? this.toDomain(user) : null;
  }

  async findByEmail(email: string): Promise<UserAdmin | null> {
    const user = await this.client.user.findUnique({ where: { email }, select: userSelect });
    return user ? this.toDomain(user) : null;
  }

  async create(data: CreateLocalUserInput): Promise<UserAdmin> {
    const user = await this.client.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firebaseUid: data.firebaseUid,
          email: data.email,
          status: "ACTIVE",
          ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        },
        select: { id: true },
      });

      if (data.roleIds?.length) {
        await tx.userRole.createMany({
          data: [...new Set(data.roleIds)].map((roleId) => ({ userId: created.id, roleId })),
        });
      }

      return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect });
    });

    return this.toDomain(user);
  }

  async update(id: string, data: UpdateUserAdminDto): Promise<UserAdmin> {
    const user = await this.client.user.update({
      where: { id },
      data: {
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      },
      select: userSelect,
    });
    return this.toDomain(user);
  }

  async setStatus(id: string, status: UserStatus): Promise<UserAdmin> {
    const user = await this.client.user.update({ where: { id }, data: { status }, select: userSelect });
    return this.toDomain(user);
  }

  async delete(id: string): Promise<void> {
    await this.client.user.delete({ where: { id } });
  }

  countRoles(roleIds: string[]): Promise<number> {
    return this.client.role.count({ where: { id: { in: [...new Set(roleIds)] } } });
  }

  async userHasRole(userId: string, roleCode: string): Promise<boolean> {
    return (await this.client.userRole.count({ where: { userId, role: { code: roleCode } } })) > 0;
  }

  countActiveUsersWithRole(roleCode: string): Promise<number> {
    return this.client.userRole.count({ where: { role: { code: roleCode }, user: { status: "ACTIVE" } } });
  }


  private toDomain(user: {
    id: string;
    firebaseUid: string;
    email: string;
    displayName: string | null;
    status: UserStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: { id: string; code: string; name: string } }>;
  }): UserAdmin {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map(({ role }) => role),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
