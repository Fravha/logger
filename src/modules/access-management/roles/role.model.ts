export interface RolePermissionSummary {
  id: string;
  code: string;
  name: string;
}

export interface RoleModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: RolePermissionSummary[];
  createdAt: Date;
  updatedAt: Date;
}
