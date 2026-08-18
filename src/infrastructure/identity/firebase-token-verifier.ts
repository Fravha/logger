import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthIdentity, TokenVerifier } from "../../core/auth/auth.types.js";
import { getFirebaseAdminAuth } from "./firebase-admin-auth.js";

export class FirebaseTokenVerifier implements TokenVerifier {
  private readonly auth;
  constructor(config: AppConfig) {
    this.auth = getFirebaseAdminAuth(config);
  }

  async verify(token: string): Promise<AuthIdentity> {
    try {
      const decoded = await this.auth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        ...(decoded.email ? { email: decoded.email } : {}),
        ...(decoded.auth_time ? { authTime: decoded.auth_time } : {}),
      };
    } catch {
      throw new AppError("AUTH_INVALID_TOKEN", "Invalid or expired authentication token", 401);
    }
  }
}
