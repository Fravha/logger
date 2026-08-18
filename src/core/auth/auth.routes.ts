import { Router } from "express";
import type { UserRepository } from "../users/user.repository.js";
import { validateRequest } from "../../shared/http/validate-request.js";
import { getCurrentUser } from "./auth.controller.js";
import { authenticate, resolveCurrentUser } from "./auth.middleware.js";
import type { TokenVerifier } from "./auth.types.js";
import type { PasswordResetSender } from "./password-reset-sender.js";
import { createPasswordResetController } from "./password-reset.controller.js";
import { passwordResetSchema } from "./password-reset.schema.js";

export function createAuthRouter(
  tokenVerifier: TokenVerifier,
  userRepository: UserRepository,
  passwordResetSender?: PasswordResetSender,
) {
  const router = Router();
  router.get("/me", authenticate(tokenVerifier), resolveCurrentUser(userRepository), getCurrentUser);

  if (passwordResetSender) {
    router.post(
      "/password-reset",
      validateRequest({ body: passwordResetSchema }),
      createPasswordResetController(passwordResetSender),
    );
  }

  return router;
}
