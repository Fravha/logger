import type { AuditRepository } from "./audit.repository.js";
import type {
  AuditContext,
  AuditEvent,
  AuditRecord,
} from "./audit.types.js";

export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(context: AuditContext, event: AuditEvent): Promise<void> {
    const action = event.action.trim();
    const resourceType = event.resourceType.trim();

    if (!action) {
      throw new Error("Audit action is required");
    }

    if (!resourceType) {
      throw new Error("Audit resource type is required");
    }

    const record: AuditRecord = {
      action,
      resourceType,

      ...(context.actorUserId !== undefined
        ? { actorUserId: context.actorUserId }
        : {}),

      ...(event.resourceId !== undefined
        ? { resourceId: event.resourceId }
        : {}),

      ...(event.metadata !== undefined
        ? { metadata: event.metadata }
        : {}),

      ...(context.ipAddress !== undefined
        ? { ipAddress: context.ipAddress }
        : {}),

      ...(context.requestId !== undefined
        ? { requestId: context.requestId }
        : {}),
    };

    await this.auditRepository.create(record);
  }
}
