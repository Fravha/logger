export interface CreateRoleDto {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
}

export interface SetRolePermissionsDto {
  permissionIds: string[];
}