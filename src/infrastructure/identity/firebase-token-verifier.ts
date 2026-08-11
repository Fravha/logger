import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthIdentity, TokenVerifier } from "../../modules/auth/auth.types.js";

export class FirebaseTokenVerifier implements TokenVerifier {
  private readonly auth;

  constructor(config: AppConfig) {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey: config.FIREBASE_PRIVATE_KEY,
        }),
      });
    }

    this.auth = getAuth();
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
