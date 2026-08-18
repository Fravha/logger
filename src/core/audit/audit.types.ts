export type AuditJsonPrimitive = string | number | boolean | null;

export type AuditJsonValue =
  | AuditJsonPrimitive
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export type AuditMetadata = Record<string, AuditJsonValue>;

export interface AuditContext {
  actorUserId?: string;
  ipAddress?: string;
  requestId?: string;
}

export interface AuthenticatedAuditContext extends AuditContext {
  actorUserId: string;
}

export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: AuditMetadata;
}

export interface AuditRecord {
  action: string;
  resourceType: string;
  actorUserId?: string;
  resourceId?: string;
  metadata?: AuditMetadata;
  ipAddress?: string;
  requestId?: string;
}
