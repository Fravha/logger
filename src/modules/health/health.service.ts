import type { PrismaClient } from "../../generated/prisma/client.js";

export class HealthService {
  constructor(private readonly client: PrismaClient) {}

  async databaseIsReady() {
    await this.client.$queryRaw`SELECT 1`;
  }
}
