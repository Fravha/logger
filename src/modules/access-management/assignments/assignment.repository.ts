export interface AssignmentRepository {
  userExists(userId: string): Promise<boolean>;
  roleExists(roleId: string): Promise<boolean>;
  countRoles(roleIds: string[]): Promise<number>;
  countPermissions(permissionIds: string[]): Promise<number>;
  replaceUserRoles(userId: string, roleIds: string[]): Promise<void>;
  replaceRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  userHasRole(userId: string, roleCode: string): Promise<boolean>;
  countActiveUsersWithRole(roleCode: string): Promise<number>;
  roleCode(roleId: string): Promise<string | null>;
  roleCodes(roleIds: string[]): Promise<string[]>;
  userRoleCodes(userId: string): Promise<string[]>;
  permissionCodes(permissionIds: string[]): Promise<string[]>;
  rolePermissionCodes(roleId: string): Promise<string[]>;
}
