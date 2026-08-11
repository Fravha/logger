import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as {
  loggerPrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    errorFormat: env.NODE_ENV === "development" ? "pretty" : "minimal",
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.loggerPrisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.loggerPrisma = prisma;
}
