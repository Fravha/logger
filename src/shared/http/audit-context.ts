import type { Request, Response } from "express";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../errors/app-error.js";

export function buildAuthenticatedAuditContext(
  req: Request,
  res: Response,
): AuthenticatedAuditContext {
  if (!req.currentUser) {
    throw new AppError("AUTH_REQUIRED", "Authentication is required", 401);
  }

  const responseRequestId = res.getHeader("x-request-id");
  const incomingRequestId = req.get("x-request-id");
  const requestId =
    typeof responseRequestId === "string"
      ? responseRequestId
      : incomingRequestId;

  return {
    actorUserId: req.currentUser.id,
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(requestId ? { requestId } : {}),
  };
}
