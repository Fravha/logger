import type { AuthenticatedUser } from "./user.types.js";

export interface UserRepository {
  findByFirebaseUid(
    firebaseUid: string
  ): Promise<AuthenticatedUser | null>;

  updateLastLoginAt(
    userId: string,
    lastLoginAt: Date,
  ): Promise<void>;
}
