import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { UserRepository } from "../users/user.repository.js";
import type { TokenVerifier } from "./auth.types.js";

export function extractBearerToken(authorization: string | undefined): string {
  if (!authorization) {
    throw new AppError("AUTH_MISSING_TOKEN", "Authentication token is required", 401);
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match?.[1]) {
    throw new AppError("AUTH_INVALID_HEADER", "Authorization must use Bearer <token>", 401);
  }

  return match[1];
}

export function authenticate(tokenVerifier: TokenVerifier): RequestHandler {
  return async (req, _res, next) => {
    try {
      req.authIdentity = await tokenVerifier.verify(extractBearerToken(req.headers.authorization));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function resolveCurrentUser(userRepository: UserRepository): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.authIdentity) {
        throw new AppError("AUTH_REQUIRED", "Authentication is required", 401);
      }

      const user = await userRepository.findByFirebaseUid(req.authIdentity.uid);
      if (!user) {
        throw new AppError("AUTH_USER_NOT_REGISTERED", "User is not registered in Logger", 403);
      }
      if (user.status !== "ACTIVE") {
        throw new AppError("AUTH_USER_INACTIVE", "User is not active", 403);
      }

      req.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
