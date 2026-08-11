import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../../infrastructure/logging/logger.js";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestedId = req.header("x-request-id")?.trim();
  req.requestId = requestedId || randomUUID();
  res.setHeader("x-request-id", req.requestId);

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        actorUserId: req.currentUser?.id,
      },
      "request completed",
    );
  });

  next();
}
