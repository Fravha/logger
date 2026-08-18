export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  roles: string[];
  permissions: string[];
}
