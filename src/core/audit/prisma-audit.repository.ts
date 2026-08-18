import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditRecord } from "./audit.types.js";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly client: Pick<PrismaClient, "auditLog">) {}

  async create(record: AuditRecord): Promise<void> {
    await this.client.auditLog.create({
      data: {
        action: record.action,
        resourceType: record.resourceType,

        ...(record.actorUserId !== undefined
          ? { actorUserId: record.actorUserId }
          : {}),

        ...(record.resourceId !== undefined
          ? { resourceId: record.resourceId }
          : {}),

        ...(record.metadata !== undefined
          ? { metadata: record.metadata as Prisma.InputJsonValue }
          : {}),

        ...(record.ipAddress !== undefined
          ? { ipAddress: record.ipAddress }
          : {}),

        ...(record.requestId !== undefined
          ? { requestId: record.requestId }
          : {}),
      },
    });
  }
}
