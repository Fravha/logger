import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";

export const getCurrentUser: RequestHandler = (req, res) => {
  if (!req.currentUser) {
    throw new AppError("AUTH_REQUIRED", "Authentication is required", 401);
  }

  res.status(200).json(req.currentUser);
};
