export interface AssignmentRepository {
  userExists(userId: string): Promise<boolean>;
  roleExists(roleId: string): Promise<boolean>;
  replaceUserRole(userId: string, roleId: string): Promise<void>;
  userHasRole(userId: string, roleCode: string): Promise<boolean>;
  countActiveUsersWithRole(roleCode: string): Promise<number>;
  roleCode(roleId: string): Promise<string | null>;
  userRoleCode(userId: string): Promise<string | null>;
}
