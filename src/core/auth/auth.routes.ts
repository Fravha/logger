import { Router } from "express";
import type { UserRepository } from "../users/user.repository.js";
import { getCurrentUser } from "./auth.controller.js";
import { authenticate, resolveCurrentUser } from "./auth.middleware.js";
import type { TokenVerifier } from "./auth.types.js";

export function createAuthRouter(tokenVerifier: TokenVerifier, userRepository: UserRepository) {
  const router = Router();
  router.get("/me", authenticate(tokenVerifier), resolveCurrentUser(userRepository), getCurrentUser);
  return router;
}
