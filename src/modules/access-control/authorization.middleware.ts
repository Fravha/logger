import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { AccessControlService } from "./access-control.service.js";

const accessControl = new AccessControlService();

function currentUserOrThrow(user: Express.Request["currentUser"]) {
  if (!user) throw new AppError("AUTH_REQUIRED", "Authentication is required", 401);
  return user;
}

export function requireRole(role: string): RequestHandler {
  return (req, _res, next) => {
    try {
      if (!accessControl.hasRole(currentUserOrThrow(req.currentUser), role)) {
        throw new AppError("AUTH_FORBIDDEN", "You do not have the required role", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permission: string): RequestHandler {
  return (req, _res, next) => {
    try {
      if (!accessControl.hasPermission(currentUserOrThrow(req.currentUser), permission)) {
        throw new AppError("AUTH_FORBIDDEN", "You do not have the required permission", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(...permissions: string[]): RequestHandler {
  return (req, _res, next) => {
    try {
      if (!accessControl.hasAnyPermission(currentUserOrThrow(req.currentUser), permissions)) {
        throw new AppError("AUTH_FORBIDDEN", "You do not have any required permission", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
