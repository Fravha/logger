import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError("ROUTE_NOT_FOUND", `Route ${req.method} ${req.path} was not found`, 404));
};
