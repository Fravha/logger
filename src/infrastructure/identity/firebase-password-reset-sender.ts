import type { AppConfig } from "../../config/env.js";
import type { PasswordResetSender } from "../../core/auth/password-reset-sender.js";
import { AppError } from "../../shared/errors/app-error.js";

export class FirebasePasswordResetSender implements PasswordResetSender {
  constructor(private readonly config: AppConfig) {}

  async send(email: string): Promise<void> {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(this.config.FIREBASE_WEB_API_KEY)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
      },
    );

    if (response.ok) return;

    let providerCode: string | undefined;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      providerCode = payload.error?.message;
    } catch {
      // Keep provider details private.
    }

    if (providerCode === "EMAIL_NOT_FOUND") {
      throw new AppError("USER_IDENTITY_NOT_FOUND", "Firebase user identity not found", 409);
    }

    throw new AppError("IDENTITY_PROVIDER_ERROR", "Firebase password email operation failed", 502);
  }
}
