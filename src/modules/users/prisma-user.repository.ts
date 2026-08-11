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
      roles: user.roles.map(({ role }) => role.code),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
    };
  }
}
