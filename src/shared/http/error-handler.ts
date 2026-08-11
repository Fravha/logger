import type { ErrorRequestHandler } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = error instanceof AppError
    ? error
    : new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500);

  const log = appError.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      requestId: req.requestId,
    },
    "request failed",
  );

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      requestId: req.requestId,
      ...(appError.details !== undefined && env.NODE_ENV !== "production"
        ? { details: appError.details }
        : {}),
    },
  });
};
