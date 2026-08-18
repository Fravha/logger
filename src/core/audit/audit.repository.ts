import type { AuditRecord } from "./audit.types.js";

export interface AuditRepository {
  create(record: AuditRecord): Promise<void>;
}
