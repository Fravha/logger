import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../../shared/http/audit-context.js";
import type { AssignmentService } from "./assignment.service.js";

type Params = { id: string };

export class AssignmentController {
  constructor(private readonly service: AssignmentService) {}

  replaceUserRole = async (
    req: Request<Params>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      await this.service.replaceUserRole(req.params.id, req.body.roleId, context);
      res.status(204).send();
    } catch (error) { next(error); }
  };
}
