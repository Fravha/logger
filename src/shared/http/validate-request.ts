import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

export function validateRequest(
  schemas: Partial<Record<"body" | "params" | "query", ZodType>>,
): RequestHandler {
  return (req, _res, next) => {
    for (const [location, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[location as "body" | "params" | "query"]);
      if (!result.success) {
        return next(new AppError("VALIDATION_ERROR", "Request validation failed", 400, result.error.flatten()));
      }
    }
    return next();
  };
}
