export interface CreateUserAdminDto {
  email: string;
  displayName?: string;
  roleIds?: string[];
}

export interface UpdateUserAdminDto {
  email?: string;
  displayName?: string | null;
}
