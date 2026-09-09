import type { UserStatus } from "../../../core/users/user.types.js";

export interface UserAdminRole {
  id: string;
  code: string;
  name: string;
}

export interface UserAdmin {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  role: UserAdminRole | null;
  createdAt: Date;
  updatedAt: Date;
}
