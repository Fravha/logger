export interface CreateUserAdminDto {
  email: string;
  displayName?: string;
  roleId: string;
}

export interface UpdateUserAdminDto {
  email?: string;
  displayName?: string | null;
}
