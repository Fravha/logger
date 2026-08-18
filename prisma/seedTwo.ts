import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const permissions = [
  { code: "users:read", name: "Read users" },
  { code: "users:manage", name: "Manage users" },
  { code: "rbac:manage", name: "Manage roles and permissions" },
] as const;

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name },
      create: permission,
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: "admin" },
    update: { name: "Administrator" },
    create: {
      code: "admin",
      name: "Administrator",
      description: "Full access to starter-kit administration",
    },
  });

  const storedPermissions = await prisma.permission.findMany({
    where: { code: { in: permissions.map(({ code }) => code) } },
    select: { id: true },
  });

  for (const permission of storedPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
