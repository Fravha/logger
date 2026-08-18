import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateIdentityUserInput, IdentityAdmin } from "../../modules/access-management/users/identity-admin.js";
import { getFirebaseAdminAuth } from "./firebase-admin-auth.js";

export class FirebaseIdentityAdmin implements IdentityAdmin {
  private readonly auth;

  constructor(config: AppConfig) {
    this.auth = getFirebaseAdminAuth(config);
  }

  async createUser(data: CreateIdentityUserInput): Promise<void> {
    try {
      await this.auth.createUser({
        uid: data.uid,
        email: data.email,
        emailVerified: false,
        disabled: false,
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      });
    } catch (error) {
      const code = this.errorCode(error);
      if (code === "auth/email-already-exists") {
        throw new AppError("USER_EMAIL_ALREADY_EXISTS", "A user with this email already exists", 409);
      }
      if (code === "auth/uid-already-exists") {
        throw new AppError("USER_IDENTITY_ALREADY_EXISTS", "The Firebase identity already exists", 409);
      }
      throw new AppError("IDENTITY_PROVIDER_ERROR", "Firebase user operation failed", 502);
    }
  }

  async updateUser(uid: string, data: { email?: string; displayName?: string | null }): Promise<void> {
    try {
      await this.auth.updateUser(uid, {
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      });
    } catch (error) {
      const code = this.errorCode(error);
      if (code === "auth/email-already-exists") {
        throw new AppError("USER_EMAIL_ALREADY_EXISTS", "A user with this email already exists", 409);
      }
      if (code === "auth/user-not-found") {
        throw new AppError("USER_IDENTITY_NOT_FOUND", "Firebase user identity not found", 409);
      }
      throw new AppError("IDENTITY_PROVIDER_ERROR", "Firebase user operation failed", 502);
    }
  }

  async setDisabled(uid: string, disabled: boolean): Promise<void> {
    try {
      await this.auth.updateUser(uid, { disabled });
    } catch (error) {
      if (this.errorCode(error) === "auth/user-not-found") {
        throw new AppError("USER_IDENTITY_NOT_FOUND", "Firebase user identity not found", 409);
      }
      throw new AppError("IDENTITY_PROVIDER_ERROR", "Firebase user operation failed", 502);
    }
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      await this.auth.deleteUser(uid);
    } catch (error) {
      if (this.errorCode(error) === "auth/user-not-found") return;
      throw new AppError("IDENTITY_PROVIDER_ERROR", "Firebase user rollback failed", 502);
    }
  }

  private errorCode(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === "string" ? code : undefined;
    }
    return undefined;
  }
}
