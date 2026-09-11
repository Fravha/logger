import type { PrismaClient } from "../../generated/prisma/client.js";
import type { UserRepository } from "./user.repository.js";
import type { AuthenticatedUser } from "./user.types.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByFirebaseUid(firebaseUid: string): Promise<AuthenticatedUser | null> {
    const user = await this.client.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      lastLoginAt: user.lastLoginAt,

      roles: user.roles
        ? [user.roles.role.code]
        : [],

      permissions: user.roles
        ? [
            ...new Set(
              user.roles.role.permissions.map(
                ({ permission }) => permission.code
              )
            ),
          ]
        : [],
    };
  }

  async updateLastLoginAt(
    userId: string,
    lastLoginAt: Date,
  ): Promise<void> {
    await this.client.user.update({
      where: {
        id: userId,
      },
      data: {
        lastLoginAt,
      },
    });
  }
}

