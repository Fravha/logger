import type { UserStatus } from "../../../core/users/user.types.js";
import type { CreateUserAdminDto, UpdateUserAdminDto } from "./user-admin.dto.js";
import type { UserAdmin } from "./user-admin.model.js";

export interface CreateLocalUserInput extends CreateUserAdminDto {
  firebaseUid: string;
}

export interface UserAdminRepository {
  findAll(): Promise<UserAdmin[]>;
  findById(id: string): Promise<UserAdmin | null>;
  findByEmail(email: string): Promise<UserAdmin | null>;
  create(data: CreateLocalUserInput): Promise<UserAdmin>;
  update(id: string, data: UpdateUserAdminDto): Promise<UserAdmin>;
  setStatus(id: string, status: UserStatus): Promise<UserAdmin>;
  delete(id: string): Promise<void>;
  countRoles(roleIds: string[]): Promise<number>;
  userHasRole(userId: string, roleCode: string): Promise<boolean>;
  countActiveUsersWithRole(roleCode: string): Promise<number>;
}
