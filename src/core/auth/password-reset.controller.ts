import type { NextFunction, Request, Response } from "express";
import type { PasswordResetSender } from "./password-reset-sender.js";
import { AppError } from "../../shared/errors/app-error.js";

export function createPasswordResetController(sender: PasswordResetSender) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await sender.send(req.body.email);
      res.status(202).json({ accepted: true });
    } catch (error) {
      // Do not reveal whether an email exists in Firebase.
      if (error instanceof AppError && error.code === "USER_IDENTITY_NOT_FOUND") {
        res.status(202).json({ accepted: true });
        return;
      }
      next(error);
    }
  };
}
